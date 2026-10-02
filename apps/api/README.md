# API

NestJS による REST API です。

## 開発

以下のコマンドはすべてリポジトリのルートで実行します。Docker Desktop を起動し、
依存関係を `pnpm install --frozen-lockfile` でインストールしてください。

ルートの `.env` に [.env.example](../../.env.example) を参考に接続情報を設定します。
`.env` がない場合は `.env.example` をコピーして作成し、既存の `.env` は上書きしないでください。

### ローカル Supabase Auth

設定は [supabase/config.toml](../../supabase/config.toml) で管理しています。
このリポジトリでは初期化済みなので、`supabase init` を再実行する必要はありません。

初回のみ、公開ポートの既定の IPv4 アドレスを loopback にする Docker network を作成します。
`redmine-local-network` を作成済みの場合は、このコマンドを省略してください。

```bash
docker network create \
  --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 \
  redmine-local-network
```

Supabase を起動し、接続先とキーを確認します。

```bash
pnpm exec supabase start --network-id redmine-local-network
pnpm exec supabase status
```

表示された値をルートの `.env` に設定します。

| 環境変数                   | 設定する値                                           | 使用箇所                               |
| -------------------------- | ---------------------------------------------------- | -------------------------------------- |
| `SUPABASE_URL`             | Project URL（ローカルでは `http://127.0.0.1:54321`） | API と Auth E2E                        |
| `SUPABASE_PUBLISHABLE_KEY` | Authentication Keys の Publishable                   | API の token 検証、Auth E2E のログイン |
| `SUPABASE_SECRET_KEY`      | Authentication Keys の Secret                        | Auth E2E のユーザー作成・削除          |

Secret key はテストの管理 API 用です。ブラウザ側や `NEXT_PUBLIC_*` に設定せず、
`.env` と実際のキーは Git に含めないでください。`status` の出力にもキーが含まれます。

Supabase の DB と、Prisma が接続するアプリ用 DB は別です。

| 用途                                         | ローカルの host port | 接続設定            |
| -------------------------------------------- | -------------------- | ------------------- |
| アプリの開発用 DB（Compose の `db`）         | 5432                 | `DATABASE_URL`      |
| アプリの E2E 専用 DB（Compose の `db-test`） | 5433                 | `TEST_DATABASE_URL` |
| Supabase 自身の DB                           | 54322                | Supabase CLI が管理 |

`status` に表示される Supabase の Database URL で `DATABASE_URL` を置き換えないでください。

作業終了時は次のコマンドで、このプロジェクトのローカル Supabase を停止できます。
通常の停止ではデータを保持します。

```bash
pnpm exec supabase stop
```

コマンドの仕様は [Supabase CLI の公式リファレンス](https://supabase.com/docs/reference/cli/introduction) を参照してください。

### アプリ用 DB と API の起動

開発用 PostgreSQL を起動し、migration と Prisma Client の生成後に API を起動します。

```bash
docker compose up -d db
pnpm --filter @redmine-next-nest/api exec prisma migrate dev
pnpm --filter @redmine-next-nest/api exec prisma generate
pnpm dev:api
```

起動確認には `GET http://localhost:3001/api/health` を使用します。

## 認証 API

`GET /api/auth/me` は、次のリクエストヘッダーで Supabase の access token を受け取ります。

```http
Authorization: Bearer <access_token>
```

API は `supabase.auth.getUser(token)` で本人を確認し、Supabase Auth のユーザー ID と
確認済みメールアドレスから、アプリ用 DB の `User` を取得・初回作成します。
既存の User がある場合はメールアドレスを更新し、`name` は変更しません。

| 条件                                                 | 応答                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| 有効な token と確認済みメールアドレス                | `200`。アプリ側の User（`id`、`email`、`name`、`createdAt`、`updatedAt`） |
| token なし、Bearer 形式の不備、無効な token          | `401`                                                                     |
| token は有効だが、メールアドレスが未設定または未確認 | `403`                                                                     |

ログイン画面、Project API の認証保護、owner・membership による権限確認は後続の PR で実装します。

## 確認コマンド

```bash
pnpm --filter @redmine-next-nest/api typecheck
pnpm --filter @redmine-next-nest/api lint
```

### API E2E

API E2E では開発用 DB を使用しません。ルートの `.env` に `.env.example` の
`TEST_DATABASE_URL` と `POSTGRES_TEST_*` に加えて、上記の Supabase 用環境変数 3 つを設定します。
`redmine-local-network` を作成してから、Supabase と専用 DB を起動してください。

```bash
pnpm exec supabase start --network-id redmine-local-network
docker compose --profile test up -d db-test
docker compose --profile test ps db-test
pnpm test:e2e
```

`pnpm test:e2e` はテスト用 URL を検証し、専用 DB に migration を適用してから
Supertest を実行します。`TEST_DATABASE_URL` が未設定、開発用 DB と同じ、または
DB 名が `_test` で終わらない場合は DB 操作前に停止します。

Auth E2E は実際のローカル Supabase Auth に接続して、次の 3 件を確認します。

- token なしで `/api/auth/me` を呼ぶと `401` になる。
- 無効な token を送ると `401` になる。
- 一時ユーザーでログインした token を送ると `200` になり、本人の `id` と `email` が返る。

成功ケースは、実行ごとに異なるメールアドレスとランダムなパスワードを使います。
Secret key の管理クライアントで `email_confirm: true` のユーザーを作成し、
Publishable key のクライアントで `auth.signInWithPassword()` を呼びます。
取得した `session.access_token` を NestJS に送り、`finally` で今回作成した
アプリ側 User と Supabase Auth のユーザーの削除を試みます。固定のテストユーザーは不要です。

ユーザーを作成・削除するため、成功ケースの接続先は HTTP の `localhost`、`127.0.0.1`、
`[::1]` に限定しています。クラウドの Supabase や本番ユーザーは使用しません。
メール送信・確認リンクの操作は、この E2E の確認対象に含めていません。

ローカルでは `pnpm test:e2e` 自体は Supabase を起動・停止しないため、上記の準備が必要です。

### GitHub Actions

[ci.yml](../../.github/workflows/ci.yml) の `api_e2e` job は、一時的な PostgreSQL と
ローカル Supabase を用意し、同じ `pnpm test:e2e` を実行する構成です。

- loopback を既定の IPv4 アドレスとする専用ネットワークで Supabase を起動する。
- `supabase status --output json` から URL とキーを取得し、キーをログでマスクして `GITHUB_ENV` に設定する。
- アプリのテスト専用 DB に migration を適用し、Health・Projects・Auth の API E2E を実行する。
- `if: always()` の終了処理で `supabase stop --no-backup` を実行し、CI 用の Supabase とそのデータを片付ける。

CI は起動したローカル Supabase のキーを使うため、クラウドのキーや個人の `.env` は必要ありません。
CI の `--no-backup` はデータを削除するので、データを保持するローカルの停止には付けません。
