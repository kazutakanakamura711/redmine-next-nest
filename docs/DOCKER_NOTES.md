# Docker / Docker Compose 運用メモ

## このプロジェクトでの方針

初期は **PostgreSQL だけを Docker Compose で起動**する。

```text
Next.js    : ローカルで pnpm dev
NestJS     : ローカルで pnpm dev
PostgreSQL : Docker Compose の db service（API E2E では db-test）
```

Web と API まで Docker に入れると、ログ、hot reload、環境変数、volume の管理が一度に必要になる。まずは DB だけを Docker 化し、アプリケーションの実装をシンプルに保つ。

## 用語

| 用語 | 意味 |
| --- | --- |
| Dockerfile | 1つの container image を作るためのレシピ。Node.js の version、依存 package、起動 command などを書く。 |
| Image | Dockerfile から作られる実行環境のひな形。 |
| Container | Image から実際に起動した process と実行環境。 |
| docker-compose.yml | DB、API、Web のような複数 service を、network・port・volume と一緒に定義するファイル。 |
| Volume | Container を消しても残せるデータ領域。PostgreSQL のデータを保持するために使う。 |

## 初期の Compose に必要なもの

このプロジェクトの `docker-compose.yml` は、開発用の `db` と、`test` profile で起動する API E2E 用の `db-test` を定義している。それぞれ別の volume を使う。DB 接続値は `.env.example` を `.env` へコピーして設定する。

- `image`: PostgreSQL の version を固定する
- `environment`: DB user、password、database 名を渡す
- `ports`: host の `5432` と Container の `5432` をつなぐ
- `volumes`: DB データを `postgres_data` に保存する
- `healthcheck`: PostgreSQL が接続受付できるまで待つための確認

API / Web を Compose へ追加するのは、ローカル起動が安定し、container 化する目的が明確になってからにする。

## 日常的な command

```bash
# DB をバックグラウンドで起動する
docker compose up db -d

# 起動状態と health を見る
docker compose ps

# DB の直近 log を見る
docker compose logs --tail=100 db

# DB を停止・削除する（volume のデータは残る）
docker compose down

# DB の中に入り、接続を確認する
docker compose exec db psql -U <POSTGRES_USER> -d <POSTGRES_DB>
```

Prisma migration は、初期方針では host 側から実行する。そのとき `DATABASE_URL` は `localhost` を使う。

```text
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<database>?schema=public
```

## 特に詰まりやすい点

### `localhost` と `db` は実行場所で異なる

| Prisma を実行する場所 | DATABASE_URL の host |
| --- | --- |
| Mac の terminal（host） | `localhost` |
| Compose 内の API container | `db` |

Compose の service 名 `db` は、Compose network の中でだけ通じる名前である。host の terminal で `@db:5432` を使うと接続できない。

### PostgreSQL の初期化値と volume

`POSTGRES_USER`、`POSTGRES_PASSWORD`、`POSTGRES_DB` は、**空の volume を初めて初期化したとき**に使われる。後から `.env` を変更して Container を再起動しても、既存 DB のユーザー・password・database 名は自動で変わらない。

認証エラーが起きたら、すぐ volume を消さずに次を確認する。

1. `.env` の `DATABASE_URL` と Compose の user / password / database 名が一致しているか
2. 既存 volume が古い初期設定を持っていないか
3. 接続したい DB が本当にこの Compose の DB か

### port の競合

`5432` がすでに別の PostgreSQL や別プロジェクトに使われていると、Compose は起動できない。

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
```

別の port を使う場合は、Compose の host 側 port と `.env` の `DATABASE_URL` を必ず同時に変える。片方だけ変えると Prisma が別の接続先を見に行く。

### `.env` を変更しても反映されない

Compose が環境変数を読むのは Container 作成時である。DB 接続先や port を変えたときは、対象 Container を作り直す。

```bash
docker compose down
docker compose up db -d
```

これは volume を消さないため DB データは残る。

### `docker compose down -v` は最後の手段

```bash
docker compose down -v
```

`-v` は `postgres_data` や `postgres_test_data` など Compose の volume も削除する。migration 済みのローカルデータも消えるため、データを失ってよいと確認できた時だけ実行する。

### healthcheck を起動完了の基準にする

Container が `running` でも、PostgreSQL が接続を受け付ける前とは限らない。`docker compose ps` で `healthy` を確認してから migration や API を起動する。

接続失敗時は、固定の sleep を増やす前に `docker compose ps` と `docker compose logs --tail=100 db` を確認する。

## Prisma とテスト DB

API E2E 用に `db-test` service を用意している。通常の `docker compose up db -d` では
起動せず、必要なときだけ Compose の `test` profile で起動する。

```text
開発用 DB: DATABASE_URL       -> host port 5432
テスト用 DB: TEST_DATABASE_URL -> host port 5433
```

テスト DB は専用 volume を使う。ルート `.env` に `.env.example` の `POSTGRES_TEST_*`
と `TEST_DATABASE_URL` を設定し、次の順に実行する。

```bash
docker compose --profile test up -d db-test
docker compose --profile test ps db-test
pnpm test:e2e
```

`pnpm test:e2e` は接続先を検証してからテスト DB に migration を適用し、API E2E を
実行する。`TEST_DATABASE_URL` が未設定、開発用 `DATABASE_URL` と同じ DB、または
DB 名が `_test` で終わらない場合は停止する。接続先の比較ではユーザー名・password・
URL の query parameter の違いは別 DB と見なさない。CI に PostgreSQL service を
追加するタスクでも、この `pnpm test:e2e` を使う。

## API / Web を Docker 化する時の注意

後で API / Web も container 化する場合は、次を確認する。

- API から DB へは `localhost` ではなく `db` で接続する。
- source を bind mount した場合、host と Container の `node_modules` を混ぜない。Container 用の named volume を分ける。
- package を追加した後は image / Container 内の依存が古い可能性がある。必要に応じて `docker compose up --build` を使う。
- macOS で source 変更が反映されない場合は、file watch の polling 設定を検討する。
- Supabase の URL や key を required environment variable にした場合、認証実装前の起動まで止めないよう、導入時期と Compose 設定をそろえる。

## 問題が起きた時の順番

1. `docker compose ps` で対象 service と health を確認する。
2. `docker compose logs --tail=100 <service>` で最初の意味のある error を読む。
3. port、`.env`、`DATABASE_URL` の host / user / password / database 名を確認する。
4. Prisma migration の対象が開発 DB かテスト DB かを確認する。
5. 最小 command で再現する。例: DB 接続だけ、migration だけ、API health だけ。

同じ失敗 command を繰り返す前に、原因の仮説を1つ立ててから次の確認を行う。
