# 品質・セキュリティのフォローアップタスク

最終更新: 2026-09-27

## 目的

プロジェクト管理機能のレビューで見つかった改善点を、次の作業スレッドでも再開できるように記録する。各タスクは原則として別ブランチ・別 Pull Request で進め、完了したらこの文書の状態を更新する。

この文書は作業メモであり、正式な仕様は [REQUIREMENTS.md](./REQUIREMENTS.md)、[DOMAIN_MODEL.md](./DOMAIN_MODEL.md)、[UI_API.md](./UI_API.md) を優先する。

## 現在の前提

- プロジェクトの作成・一覧・詳細・更新・アーカイブ・解除が実装済み。
- Task CRUD は未実装。タスク 1〜4 は `develop` にマージ済み。
- Supabase Auth と Project membership による API 認証・認可は未実装で、外部公開前に必要。
- ルートの `pnpm test` は API と Web の Vitest を実行する。`pnpm test:e2e` は Supertest による API 結合テストで、タスク 3 の PR #14 から GitHub Actions の CI でも実行する。
- Playwright と Storybook は未導入。API E2E（Supertest）だけでは、画面遷移やユーザー操作を通した確認はできない。
- 2026-09-27 に、認証・Project 権限を Task CRUD より先に実装すると決めた。認証後に Playwright と Storybook を導入し、Task 実装時に対象を広げる。正式仕様の順序もこの方針に揃えた。
- タスク 4 の更新後も Prisma CLI 経由の監査警告 3 件が残る。保留理由と再確認の時期はタスク 4 の実施メモに記録した。

## タスク一覧

### 1. プロジェクト名を正規化して検証する

- 状態: 完了（PR #12 を `develop` にマージ、API E2E 23件確認済み）
- 優先度: 高（Task API を増やす前に対応）

#### 背景

Project の作成 DTO は空文字を拒否するが、空白だけの文字列は通る。更新 DTO も同様で、Service は `name` を trim せず保存する。そのため、空白だけの名前や前後に空白が付いた名前が DB に登録される可能性がある。

アーカイブ確認 UI は入力を trim した値と保存済みの名前を比較する。保存済みの名前に前後空白があると、画面上で表示された名前を入力しても比較に失敗し、アーカイブ操作を完了できない。

#### 作業内容

- API の作成・更新で、前後空白を除いた名前を検証・保存する。
- trim 後に空文字になる名前を `400 Bad Request` にする。
- trim 後の文字数に対して 1〜100 文字の制約を適用する。
- UI の入力ルールと API の保存ルールを一致させる。
- 既存 DB に前後空白付きの名前があるか確認し、必要ならデータ修正方法を決める。既存データを無断で一括変更しない。

#### 実施メモ（2026-09-26）

- PR #12 で、作成・更新 DTO は検証前に名前を trim し、Service でも保存時に trim するようにした。Web の作成・設定フォームも trim 後の 1〜100 文字で検証する。設定フォームの HTML `maxLength` は、trim 前の入力を切り詰めてルールと食い違うため外した。
- Prisma の `Project` モデルは `@@map("projects")` により、DB 上では `projects` テーブルを使う。ルート `.env` を読み込んだ接続先を読み取り専用で確認すると、`projects` テーブルと既存データ 6 件があり、JavaScript の `trim()` と 1〜100 文字のルールで修正が必要な名前は 0 件だった。画面を表示する API が同じ接続先を使っているかは未確認。
- Web の対象テスト 3 ファイル・15 件、API build、Web typecheck、API lint、対象の Web lint が通過。DB を使わない DTO の実行確認では、前後空白の除去、空白だけの拒否、trim 後 100 文字の許可・101 文字の拒否、更新時の `null` 拒否を確認した。
- API E2E テストは PR #12 に追加したが、DB への保存まで通す実行確認はまだできていない。タスク 2 を `develop` にマージしてから PR #12 のブランチへ取り込み、テスト専用 DB 上で実行する。

#### 実施メモ（2026-09-27）

- タスク 2 を `develop` にマージし、最新の `develop` を PR #12 のブランチへ取り込んだ後、テスト専用 DB で `pnpm test:e2e` を実行した。
- migration は適用済みで、health E2E 1 件と projects E2E 22 件の合計 23 件が通過した。作成・更新時の名前の trim と、trim 後の入力制約を含む API E2E を確認できた。

#### 完了条件

- 作成・更新で空白だけの名前を送ると `400` になる。
- 作成・更新で前後空白付きの名前を送ると、正規化された名前が保存される。
- trim 後に 100 文字を超える名前は `400` になる。
- プロジェクト名の確認によるアーカイブ操作が、正規化後の名前で成功する。
- 上記を API E2E と必要なフォームテストで確認する。

### 2. API E2E テスト用 DB を開発 DB から分離する

- 状態: 完了（PR #13 を `develop` にマージ、CI への組み込みはタスク 3 で完了）
- 優先度: 高（タスク API の結合テストを増やす前）

#### 背景

`apps/api/test/setup-env.ts` はアプリ本体と同じルート `.env` を読む。接続先を別に設定しない限り、E2E テストが開発用の `DATABASE_URL` を使用する。現在の後片付けはランダムなテストキーに限定されているが、テスト専用 DB に分けた方が誤操作の影響を抑えられる。

#### 作業内容

- E2E 専用の `TEST_DATABASE_URL` と DB 初期化手順を用意する。
- テスト DB の接続先が未指定、または通常の開発 DB と同じ場合は、テストを開始せず明確なエラーで止める。
- migration を適用してから API E2E を実行できるようにする。
- テスト専用 DB の準備後、タスク 1 で保留している API E2E を実行し、正規化したプロジェクト名が DB に保存されることを確認する。結果をタスク 1 の状態・実施メモに反映する。
- Prisma 接続をアプリ終了時に閉じ、繰り返しテストしても接続が残らないことを確認する。
- ローカルと CI の両方で、同じ安全な実行手順を使う。

#### 完了条件

- `pnpm test:e2e` が専用 DB 以外に接続しない。
- 専用 DB の URL がない場合や通常 DB を指している場合、テストが安全に失敗する。
- migration 適用後に E2E を繰り返しても、テストデータが残らず他の開発データに影響しない。
- タスク 1 の保留中 API E2E が専用 DB 上で通り、正規化した値の保存まで確認できる。

#### 実施メモ（2026-09-26）

- `test/api-e2e-db-isolation` で Compose の `db-test`、`TEST_DATABASE_URL` の接続先検証、migration 後に Vitest を実行する共通コマンド、NestJS 終了時の Prisma 切断を追加した。
- `TEST_DATABASE_URL` がない場合と、開発用 DB と同じ接続先を指す場合は、migration より前に停止することを確認した。
- 専用 DB（host port 5433）で `pnpm test:e2e` を 2 回実行し、既存の API E2E 19 件が両方通過。各実行後の `projects` は 0 件、残存 DB 接続は 0 件だった。同じ Vitest worker で 2 ファイルを順番に実行した場合も 19 件が通過した。
- ローカルの Git 管理外 `.env` に専用 DB の接続情報を設定し、環境変数を一時指定しない `pnpm test:e2e` でも 19 件が通過した。
- タスク 1 で追加した E2E ケースは PR #12 のブランチにあるため、このブランチでは未実行。タスク 2 を `develop` にマージした後、PR #12 へ取り込んで確認する。CI への組み込みはタスク 3 で行う。
- 2026-09-27 に PR #12 のブランチへタスク 1 のコードを取り込んだ状態で E2E を実行し、専用 DB 上で合計 23 件が通過した。GitHub Actions への組み込みはタスク 3 で行う。

### 3. API E2E テストを GitHub Actions CI で実行する

- 状態: 完了（PR #14 を `develop` にマージ、分割後の CI 通過）
- 優先度: 高（タスク 2 に依存）

#### 背景

`.github/workflows/ci.yml` は format、lint、typecheck、`pnpm test`、build を実行するが、PostgreSQL を起動せず、`pnpm test:e2e` も実行していない。現在の CI では API と DB の結合動作を確認できない。

#### 作業内容

- CI job に一時的な PostgreSQL service と health check を追加する。
- タスク 2 のテスト専用 DB 設定を使い、migration を適用してから API E2E を実行する。
- 既存の lint、typecheck、unit test、build の確認を維持する。

#### 実施メモ（2026-09-27）

- `ci/api-e2e` の初回構成では、既存の quality job に PostgreSQL 17 の一時 service と health check を追加した。開発用 `DATABASE_URL` と専用 `TEST_DATABASE_URL` は異なる DB 名を指し、テスト用の固定値だけを使う。
- 既存の `pnpm test:e2e` を CI に追加した。このコマンドが接続先を検証し、専用 DB に migration を適用してから API E2E を実行する。format、lint、typecheck、unit test、build の既存 step は維持した。
- ローカルの専用 DB で 23 件が通過した。さらに CI と同じ設定の空の一時 PostgreSQL を起動し、初回 migration と API E2E 23 件が通過した。一時コンテナは確認後に停止・削除した。
- PR #14 の [CI 実行](https://github.com/kazutakanakamura711/redmine-next-nest/actions/runs/36309461013) で PostgreSQL の health check、初回 migration、API E2E、既存の品質チェックがすべて成功した。job 終了時に一時コンテナが削除されたこともログで確認した。
- レビューを受けて、既存チェックを `quality`、PostgreSQL を使う結合テストを `api_e2e` に分割した。両 job は独立して実行される。分割後の [CI 実行](https://github.com/kazutakanakamura711/redmine-next-nest/actions/runs/36318466787) では両 job が成功した。

#### 完了条件

- Pull Request の CI で migration と `pnpm test:e2e` が実行される。
- DB 起動に失敗した場合や API E2E が失敗した場合、CI が失敗として報告する。
- CI の DB は job 終了後に破棄され、実データや秘密情報を必要としない。

### 4. 依存関係監査の警告を確認して対応する

- 状態: 完了（PR #15 を `develop` にマージ、ローカル検証・CI 通過）
- 優先度: 高（外部公開・ファイルアップロード導入の前に再確認）

#### 背景

2026-09-26 に実行した `pnpm audit --prod` は、計 7 件（High 5、Moderate 1、Low 1）を報告した。lockfile 上では次の間接依存が含まれていた。

| パッケージ | lockfile のバージョン | 報告された影響 |
| --- | --- | --- |
| `multer` | `2.2.0` | High 3 件、Low 1 件。multipart 入力時の DoS など |
| `mysql2` | `3.15.3` | High 1 件、Moderate 1 件。認証情報の漏えい、圧縮入力の DoS など |
| `deepmerge-ts` | `7.1.5` | High 1 件。再帰オブジェクト処理による stack exhaustion |

当時の advisory: [multer DoS](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm)、[multer file descriptor leak](https://github.com/advisories/GHSA-qfvm-cv95-jqjf)、[multer oversized index DoS](https://github.com/advisories/GHSA-535w-7cp7-47q4)、[multer fileFilter race](https://github.com/advisories/GHSA-qvfw-j98x-7q72)、[mysql2 cleartext credentials](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr)、[mysql2 decompression DoS](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3)、[deepmerge-ts stack exhaustion](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)。

監査で検出されたことは、アプリの現在のコード経路で全てが悪用可能であることを意味しない。特に upload と MySQL は現時点でアプリコードから使っていないため、どの実行経路に含まれるかを確認してから更新方針を決める。

#### 作業内容

- `pnpm audit --prod` を再実行し、現在の lockfile と advisory の内容を確認する。
- 該当依存の親パッケージ、実行経路、アプリでの使用有無を調べる。
- 互換性を確認して、親パッケージの更新を優先する。理由なく lockfile override だけで依存を置き換えない。
- 更新後に install、lint、typecheck、test、build を実行する。

#### 実施メモ（2026-09-27）

- 着手時の `pnpm audit --prod --json` は計 7 件（High 5、Moderate 1、Low 1）で、上記スナップショットと同じだった。`pnpm why --recursive multer mysql2 deepmerge-ts` と lockfile で親パッケージを確認した。
- `multer@2.2.0` は本番 API が使う `@nestjs/platform-express@12.0.1` の依存。現時点で API コードに multipart / upload 用の interceptor やエンドポイントはないが、Express アダプターは実行時に使うため、親パッケージを互換性のある `12.0.3` に更新した。これにより `multer@2.4.0` となり、該当する 4 件（High 3、Low 1）は再監査から消えた。override は使っていない。
- 更新後の `pnpm audit --prod --json` は計 3 件（High 2、Moderate 1）。`@prisma/client@7.10.0` の optional peer dependency として `prisma@7.10.0` が監査の本番依存経路に含まれ、そこから `@prisma/config@7.10.0 -> deepmerge-ts@7.1.5` と `mysql2@3.15.3` が検出される。

| 保留する警告 | 現在の影響を限定する根拠 | 再確認するタイミング |
| --- | --- | --- |
| `mysql2` High 1、Moderate 1 | `mysql2` は Prisma CLI の依存で、アプリの Prisma datasource と adapter は PostgreSQL / `@prisma/adapter-pg`。MySQL 接続と圧縮プロトコルを使うコード経路はない。現行の安定版 `prisma@7.10.0` 自体が `mysql2@3.15.3` を固定しており、修正版 `>=3.23.1` への親パッケージ更新はまだできない。 | Prisma の次の安定版更新時、MySQL の導入を検討する前、外部公開前の依存監査時。 |
| `deepmerge-ts` High 1 | `@prisma/config` は Prisma CLI の設定読み込みに使われる。現在の Prisma 設定はリポジトリ内の静的ファイルで、外部入力から循環参照を含む設定オブジェクトを作らない。この advisory の再帰オブジェクト入力がアプリの HTTP 経路から届かない。現行の `@prisma/config@7.10.0` は `deepmerge-ts@7.1.5` を固定し、修正版 `>=8.0.0` はメジャー更新となる。 | Prisma の次の安定版更新時、設定を外部入力から生成する変更の前、外部公開前の依存監査時。 |

- `pnpm install --frozen-lockfile`、`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（API 5 件、Web 28 件）、`pnpm build` が通過。専用 PostgreSQL で `pnpm test:e2e`（23 件）も通過した。
- PR #15 の [GitHub Actions CI](https://github.com/kazutakanakamura711/redmine-next-nest/actions/runs/36320604183) で `quality` と `api_e2e` の両 job が通過した。ファイルアップロードを導入する前にも `pnpm audit --prod` を再実行し、multipart の入力制限を設計する。

#### 完了条件

- 現行の audit 結果と、対応・保留それぞれの理由が記録されている。
- 到達可能な問題は修正版へ更新され、必要な確認が CI を含めて通る。
- 保留する警告には、現在のコードで影響が限定される根拠と再確認のタイミングが記録されている。

### 5. Supabase Auth と Project 権限を実装する

- 状態: 未着手
- 優先度: 次に着手。Task CRUD と外部公開より前に完了する。

#### 背景

現在の Projects API には認証 guard と Project membership の認可チェックがない。ネットワークから API に到達できる状態では、認証なしでプロジェクトを閲覧・変更できる。

#### 作業内容

- Next.js から Supabase Auth で登録・ログインできるようにする。
- ローカル開発と CI で使う Supabase の設定、認証用テストユーザーの作成・後片付け、API E2E で使う token の用意を決める。秘密情報は Git に含めない。
- Supabase access token を API で検証し、ユーザーを特定する。
- 既存の Project API 呼び出しに token を付け、未ログイン時とログアウト後の画面導線を整える。
- User と ProjectMember の DB model、migration、Project 作成時の owner 登録を実装する。Project と owner membership は同じ transaction で作る。
- 既存 Project には作成者の記録がなく、開発用 DB の 6 件は試作データだったため削除済み。開発用 DB では owner 必須の migration に既存データへの所有者割り当ては不要。他の環境へ適用する前には既存 Project の有無を確認する。今後は認証済みの作成者を owner にする。
- Project の取得は membership を確認し、別ユーザーのプロジェクトを ID 指定で取得できないようにする。
- Project の設定更新、アーカイブ、アーカイブ解除は owner のみ許可する。
- メンバーの追加・削除・role変更は owner のみ許可し、owner 自身の削除・role変更を防ぐ。
- API の権限確認を実装し、UI の表示制御だけに依存しない。
- 認証が完了するまではローカル開発の API と DB を loopback に限定する方法を確認する。デプロイ環境では認証を有効にしてから外部公開する。
- Task の owner/member/viewer 権限は、Task CRUD の各 endpoint を実装するときに同時に追加する。

#### 実装の区切り

1. User / ProjectMember と owner の migration を設計する。開発用 DB の既存 Project は削除済みのため、所有者を推測して割り当てる処理は入れない。
2. Supabase のログイン・登録、API の token 検証、`GET /api/auth/me` を実装する。
3. Project 作成時の owner 登録と、一覧・詳細・更新・アーカイブ・解除の権限を操作ごとに実装する。
4. メンバーの追加・閲覧・role変更・削除を owner 権限で実装する。

各区切りはさらに小さな Pull Request に分けてよい。既存 Project API の保護が揃うまでは外部公開しない。

#### 完了条件

- token なし・無効 token は `401` になる。
- Project 作成時に認証済みの作成者が owner として登録される。
- membership がないユーザーは Project にアクセスできず、別プロジェクト ID を使った越境操作もできない。
- viewer の更新、member の owner 専用操作が `403` になり、owner は許可された操作を実行できる。
- 権限ごとの成功・失敗を API E2E で確認し、ログイン済みユーザーで既存の Project 画面を操作できる。

### 6. Playwright で主要なユーザー操作をブラウザE2Eテストする

- 状態: 未着手
- 優先度: 高（タスク 5 の後、Task CRUD の前に導入する）

#### 背景

現在の `pnpm test:e2e` は Supertest を使った API 結合テストであり、ブラウザ上の画面遷移、入力、表示更新までは確認しない。Playwright の設定やテストもまだないため、フロントエンドと API をつないだ主要導線を自動で回帰確認できるようにする。

#### 作業内容

- Playwright の設定、実行スクリプト、テスト用の起動・終了手順を追加する。
- テストデータと接続先を開発 DB・本番データから分離し、タスク 2 のテスト DB 方針と整合させる。
- テスト用の認証ユーザーとセッションを再現できる方法を決め、本番の認証データを使わずにローカルと CI で実行する。
- ログインからプロジェクト作成、設定更新、アーカイブ、アーカイブ解除までをブラウザから確認する。
- 画面表示だけでなく、保存後のヘッダー・パンくず・サイドバーへの反映、再読み込み後の永続性、成功・失敗時の表示を確認する。
- Task CRUD 実装後はタスクの主要導線も追加する。
- GitHub Actions で必要なアプリ/API/DBを起動し、Playwright テストを実行する。CI に組み込む際は、失敗時に原因を調べられるよう Playwright のレポートや trace を必要に応じて保存する。

#### 完了条件

- ローカルで決まったコマンドから Playwright のブラウザE2Eを実行できる。
- ログインとプロジェクトの作成・設定更新・アーカイブ・解除の主要導線が成功することを確認できる。
- テストは専用データを使い、開発 DB や本番データを変更しない。
- Pull Request の CI で Playwright が実行され、失敗時は CI が失敗として報告する。
- Task CRUD の導入後も、該当する重要なユーザー導線を追加・更新する。

### 7. Storybook で再利用 UI の状態を確認できるようにする

- 状態: 未着手
- 優先度: Task 画面を増やす前に導入する。

#### 背景

shadcn/ui を土台にした UI 部品はあるが、Storybook の設定・story・実行コマンドはまだない。画面の操作テストとは別に、再利用 UI の代表的な状態を確認する場所を用意する。

#### 作業内容

- Web に Storybook の設定と実行・build コマンドを追加する。
- 既存の再利用 UI（例: Button、Badge、AlertDialog）から対象を絞り、通常・disabled・長文など必要な状態の story を作る。
- CI で Storybook の build を確認する。Task UI を実装するときは、再利用する部品の story を追加する。

#### 完了条件

- ローカルで Storybook を起動し、対象部品の状態を確認できる。
- Pull Request の CI で Storybook の build が通る。
- UI の操作・API との接続は Vitest / Playwright で確認する役割分担が保たれている。

## 推奨する着手順

1. タスク 1〜4: 完了。Project 入力、API E2E 専用 DB と CI、依存関係監査に対応した。
2. タスク 5: Supabase Auth、User / ProjectMember、作成者の owner 登録、Project API と画面の権限を実装する。
3. タスク 6: 認証済み Project の主要導線を Playwright で確認し、CI に追加する。
4. タスク 7: Storybook を導入し、既存の再利用 UI を登録する。
5. Task CRUD: ProjectMember の role とアーカイブ状態を各 Task API で検証しながら操作ごとに実装する。Playwright と Storybook の対象も広げる。

各タスクは個別のスレッド・ブランチ・PRで進め、実装後にこの文書の状態、正式仕様、確認結果を更新する。

## 次の Codex スレッドへの引き継ぎ

新しいスレッドで、このリポジトリを開いて次のように依頼する。

> `docs/REQUIREMENTS.md`、`docs/DOMAIN_MODEL.md`、`docs/UI_API.md` と本書のタスク 5 を読み、認証・Project 権限の最初の実装範囲を決めてください。開発用 DB の既存 Project は試作データとして削除済みです。作成者を owner に登録する設計とし、認証と権限の API E2E は専用 DB で実行してください。

最初のタスク以外に着手する場合は、依頼文でタスク名を指定する。この文書の状態と完了条件を、新しいスレッドの作業基準として使う。
