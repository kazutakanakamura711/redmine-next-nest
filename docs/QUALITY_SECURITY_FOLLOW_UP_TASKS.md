# 品質・セキュリティのフォローアップタスク

最終更新: 2026-10-16

## 目的

プロジェクト管理機能のレビューで見つかった改善点を、次の作業スレッドでも再開できるように記録する。各タスクは原則として別ブランチ・別 Pull Request で進め、完了したらこの文書の状態を更新する。

この文書は作業メモであり、正式な仕様は [REQUIREMENTS.md](./REQUIREMENTS.md)、[DOMAIN_MODEL.md](./DOMAIN_MODEL.md)、[UI_API.md](./UI_API.md) を優先する。

## 現在の前提

- プロジェクトの作成・一覧・詳細・更新・アーカイブ・解除が実装済み。
- Task CRUD は未実装。タスク 1〜4 は `develop` にマージ済み。
- 認証基盤（Supabase Auth の token 検証、アプリ側 User、`GET /api/auth/me`、Auth E2E）は PR #18 の CI 通過後、`develop` にマージ済み。
- 共通 AuthGuard、ProjectMember / owner の migration、作成者の owner 登録、全 Project API の認証保護は PR #20 を `develop` にマージ済み。区切り3の Web 認証基盤、ログイン・登録画面、全 Project API 呼び出しへの token 付与、メール確認後の自動ログイン、未ログイン・ログアウト導線、名前の同期、PC と狭い画面のナビゲーション・本人表示は PR #21 を `develop` にマージ済み。区切り4の参加者だけの一覧・詳細取得と owner だけの設定更新・アーカイブ・解除は PR #22 を `develop` にマージ済み。
- 区切り5の owner によるメンバー一覧・追加 API は PR #23・#24 を `develop` にマージ済み。PR #24 の CI と標準 build は成功し、追加とアーカイブの競合対策も確認済み。続く role 変更 API は `feat/phase-2/project-members-role-update` で実装し、API E2E 53件追加・全183件が成功した。Bruno・手動確認・全体レビューと品質チェックを実施し、修正が必要なレビュー指摘はなかった。ユーザーが実行した標準の `pnpm build` も API・Web ともに成功し、環境制限による build の確認待ちは解消済み。コミット・PR 作成・CI は未実施。メンバー削除 API とメンバー管理 Web UI は未実装。
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

- 状態: 対応中（区切り1〜4と区切り5のメンバー一覧・追加は PR #18・#20・#21・#22・#23・#24 を `develop` にマージ済み。role 変更 API は `feat/phase-2/project-members-role-update` で実装済み、API E2E 53件追加・全183件成功。メンバー削除 API とメンバー管理 Web UI は未実装）
- 優先度: 高。Task CRUD と外部公開より前に完了する。

#### 背景

着手時の Projects API には認証 guard と Project membership の認可チェックがなく、認証なしでプロジェクトを閲覧・変更できた。PR #20 のマージ後は全 Project API を AuthGuard で保護している。現在は参加者だけの一覧・詳細取得と owner だけの設定更新・アーカイブ・解除を実装し、API E2E で確認済みである。

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

1. 認証基盤（PR #18、`develop` にマージ済み）。ローカル・CI の Supabase Auth 設定、テストユーザーの作成・削除、User migration、API の token 検証、`GET /api/auth/me` と API E2E を対象にする。
2. ProjectMember / owner の migration、Project 作成時の owner 登録、全 Project API の認証保護（PR #20、`develop` にマージ済み）。Project と owner membership は同じ transaction で作る。開発用 DB の既存 Project は削除済みのため、所有者を推測して割り当てる処理は入れない。
3. Next.js のログイン・登録画面と、既存 Project API 呼び出しへの token 付与、未ログイン・ログアウト時の画面導線（PR #21、`develop` にマージ済み）。
4. Project の一覧・詳細は参加者だけ、設定更新・アーカイブ・解除は owner だけに許可し、API E2E で権限ごとの成功・失敗を確認する。
5. メンバーの追加・閲覧・role変更・削除を owner 権限で実装する。

各区切りはさらに小さな Pull Request に分けてよい。既存 Project API の認証と membership・role による認可が揃うまでは外部公開しない。

#### 実施メモ（2026-10-02）

- `feat/phase-2/auth-foundation` に、ローカル Supabase の設定と、Supabase Auth の UUID を主キーとするアプリ側 `User` の migration を追加した。Supabase 自身の DB と、Prisma が使うアプリの開発用・テスト用 DB は分離している。
- NestJS の `AuthController -> AuthService -> AuthRepository -> PrismaService` で `GET /api/auth/me` を実装した。受け取った Bearer token を `supabase.auth.getUser(token)` に渡して本人を確認し、確認済みメールアドレスを持つ User を取得・初回作成する。この段階では既存 User のメールアドレスを更新し、任意の `name` は保持した。名前の同期は 2026-10-09 の実施メモを参照する。
- token なし・無効 token は `401`、有効な token でもメールアドレスが未設定・未確認なら `403` にする。Auth E2E では token なし・無効 token の `401` と、有効な token の `200`・本人の `id` / `email` を確認した。`403` のケースはまだ E2E に追加していない。
- Auth E2E はローカル Supabase の管理 API で確認済みの一時ユーザーを作成し、Publishable key のクライアントでログインして access token を取得する。実行ごとに異なるメールとランダムなパスワードを使い、`finally` でアプリ側 User と Supabase Auth ユーザーの削除を試みる。HTTP の loopback 接続先だけを許可し、固定ユーザーやクラウドの認証データは使用しない。
- ローカルの `pnpm test:e2e` は Health 1 件、Projects 22 件、Auth 3 件の合計 26 件が通過した。
- PR 前のコードレビュー、`pnpm install --frozen-lockfile`、Prisma Client 生成、`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（API 5 件・Web 28 件）、`pnpm build` が完了した。workflow の YAML と各 `run` step の shell 構文、`git diff --check` も確認した。
- GitHub Actions の `api_e2e` job に、Supabase の起動、起動した URL・Publishable key・Secret key の環境変数への設定、テスト後の `supabase stop --no-backup` を追加した。キーをログへ出す処理を避け、後続のログでもマスクする。PR #18 の [CI 実行](https://github.com/kazutakanakamura711/redmine-next-nest/actions/runs/37001772093) で `quality` と `api_e2e` が成功し、Supabase の起動・環境変数設定・Auth を含む API E2E・Supabase の停止がすべて通過した。
- ローカルの準備、環境変数、一時ユーザーの扱い、CI の流れを [API README](../apps/api/README.md) に記載した。

#### 実施メモ（2026-10-05）

- `feat/phase-2/project-auth-foundation` に、Project の必須 `ownerId`、ProjectMember、`ProjectMemberRole`（`owner` / `member` / `viewer`）の migration を追加し、開発用・E2E 専用 DB に適用した。ProjectMember は `projectId` と `userId` の組み合わせを一意にする。
- 共通 AuthGuard で Bearer token を検証し、確認済みメールアドレスを持つアプリ側 User を `request.user` に設定する。`GET /api/auth/me` と、Project の一覧・詳細・作成・更新・アーカイブ・解除で利用する。
- Project 作成時は `request.user.id` を Controller → Service → Repository に渡し、Project と作成者の `role: owner` の ProjectMember を同じ transaction で保存する。owner はクライアントの入力から決めない。
- Projects E2E は各テストでローカル Supabase の一時ユーザーを作成してログインし、有効な token を取得する。終了時に ProjectMember → Project → User を削除し、Supabase Auth の一時ユーザーも削除する。
- Projects E2E 34 件が通過。全 6 API の token なし・無効 token の `401`（12 件）、Project と owner membership の保存、認証失敗時に DB が変わらないこと、既存の成功・入力エラー・対象 ID のエラーを確認した。API ごとの 6 つの `describe()` に整理している。
- E2E の初回実行では 1 件の `beforeEach` が 10 秒でタイムアウトしたが、該当ケースの単独実行と、その後の 34 件の実行は成功した。タイムアウトの原因は未特定で、再発時は準備処理のどの段階で遅延するかを確認する。
- Swagger に Auth の説明・User レスポンス、全 Project API の Bearer 認証と `401`・`403`、Project レスポンスの `ownerId`（UUID）を記載した。Bruno に Supabase のログイン・パスワード変更、Auth の本人取得、全 Project API の Bearer token 設定と README を用意し、ユーザーによる API の手動確認も完了した。
- PR 前の最終確認で、`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（API 12 件・Web 28 件）、`pnpm build` が成功した。`pnpm test:e2e` も専用 DB で 38 件（Health 1 件・Auth 3 件・Projects 34 件）が通過した。
- この変更は PR #20 として `develop` にマージ済み。区切り2は完了し、タスク 5 全体はログイン画面・Project 権限・メンバー管理が残るため対応中とする。

#### Web 認証基盤の実施メモ（2026-10-05）

- 最新の `develop`（PR #20 マージ済み）から `feat/phase-2/web-auth` を作成した。区切り3を、Web 認証基盤 → ログイン画面 → 全 Project API への token 付与 → 登録・メール確認 → 未ログイン・ログアウト導線の順に、説明・実装・確認を行いながら進める。
- Web に `@supabase/supabase-js@2.117.2` と `@supabase/ssr@0.12.7` を固定バージョンで追加した。API と同じ URL・Publishable key を `apps/web/.env.local` で使い、設定例と手順を Web README に用意した。
- ブラウザ用・リクエストごとのサーバー用クライアントと、Next.js 16 の Proxy を追加した。SDK の `getClaims()` でセッションを確認・更新し、更新 Cookie を後続の画面処理とブラウザへ渡す。複数回の Cookie 書き込みでもキャッシュ制御ヘッダーを保持する。
- Web の Vitest 37 件（新規のセッション基盤 9 件）、Web lint・typecheck、対象の format check が通過した。Cookie の読み取り専用状態、リクエスト間の分離、更新 Cookie のリクエスト・レスポンスへの反映、複数回の更新時のキャッシュ制御、Proxy の対象 URL を確認した。ローカル Supabase の Auth 設定取得は `200` となり、実 SDK の未ログイン状態も確認できた。
- 通常の `next build` は Turbopack の内部処理がポート作成時の `Operation not permitted` で停止し、制限外での再実行でも同じエラーになった。検証コマンドを `pnpm --filter @redmine-next-nest/web build --webpack` に変えると、Proxy を含む build が成功した。通常の build スクリプトは変更していない。実ユーザーでのログイン・セッション更新・画面導線は、ログイン画面を実装する段階で確認する。
- この段階は接続と Cookie セッション更新の土台まで。ログイン・登録画面、API への token 付与、未ログイン時のリダイレクト、ログアウトは未実装。membership・role の認可とメンバー管理は後続 PR で扱う。

#### ログイン・Project API への token 付与の実施メモ（2026-10-06）

- `(auth)/login` に Server Component のページと Client Component のフォームを追加した。shadcn/ui、Zod、React Hook Form を使い、入力エラー・認証エラー・送信中の状態とパスワードの表示切り替えを用意した。
- `signInWithPassword()` が返すセッションから access token を取り出し、NestJS の `GET /api/auth/me` で本人取得が成功した後に `router.replace('/projects')` と `router.refresh()` で一覧を表示する。Cookie の保存はブラウザ用 SDK に任せる。
- Project の一覧・詳細はサーバー用クライアント、作成・更新・アーカイブ・解除はブラウザ用クライアントから `getSession()` で token を取得し、全 6 API に Bearer ヘッダーを付けた。セッションがない場合や取得に失敗した場合は Project API を呼ばない。token の検証は引き続き NestJS の AuthGuard が行う。
- `create-project.ts` を `projects/_lib` に移し、作成フォームと既存テストの import・mock パスを更新した。
- ユーザーによるブラウザ確認で、ログインと `/api/auth/me` の `200`、一覧・詳細表示、作成の `201`、更新・アーカイブ・解除の `200` と Bearer ヘッダーを確認した。
- Web の Vitest 106 件、Web lint・typecheck、対象コードの format check が通過した。ログインの成功・失敗と本人取得待ち、セッションなし・取得失敗時の通信停止、各 Project API の URL・method・Bearer ヘッダー、API エラーを確認した。
- ログインから一覧表示までの説明と Mermaid の図を [WEB_AUTH_LOGIN_FLOW.md](./WEB_AUTH_LOGIN_FLOW.md) に残した。

#### 登録・メール確認の実施メモ（2026-10-08）

- `(auth)/register` に Server Component のページと Client Component のフォームを追加した。shadcn/ui、Zod、React Hook Form で必須入力・メール形式・パスワード8文字以上・確認用パスワードとの一致を検証し、送信中の状態と成功・失敗の案内を表示する。
- `signUp()` にメールアドレス・パスワード・`user_metadata.name` を渡す。確認用パスワードは送らず、パスワードを trim しない。この段階では名前のアプリ側 User への同期はまだ行っていない。
- ローカル Supabase の `[auth.email].enable_confirmations` を `true` に変更し、`supabase/templates/confirmation.html` を確認メールのテンプレートとして指定した。Mailpit で日本語の件名・本文を確認した。
- `(auth)/confirm/route.ts`（URL は `/confirm`）で `token_hash` と `type=email` を読み、`verifyOtp()` で確認する。成功するとサーバー用 SDK が Cookie にセッションを保存し、ログイン画面を経由せず `/projects` へ `307` で移動する。
- Supabase の検証エラーは `/login?error=confirmation_failed` に移動し、ログイン画面に固定の案内を表示する。確認情報の不足や `type` の不正は、Supabase を呼ばず `400` を返す。
- リダイレクト先に確認情報や利用者指定の外部 URL を引き継がず、応答に `Cache-Control: private, no-store` と `Referrer-Policy: no-referrer` を付ける。
- ユーザーによる手動確認で、新規登録の `signup` の `200`、Mailpit の受信、メール確認後の自動ログイン・一覧表示、再読み込み後のセッション維持、ログイン画面の確認失敗メッセージを確認した。
- 登録フォーム13件と確認 Route Handler 10件を追加した。SDK はモックし、入力検証・送信内容・案内・二重送信防止、検証の成功・失敗、不正入力での通信停止、移動先とヘッダーを確認する。Cookie 保存そのもののブラウザ確認は上記の手動確認による。
- Web 全体の Vitest 129 件、Web lint・typecheck・build（`--webpack`）が通過した。登録・メール確認の説明と Mermaid の図を [WEB_AUTH_REGISTRATION_FLOW.md](./WEB_AUTH_REGISTRATION_FLOW.md) に残した。

#### 未ログイン・ログアウト・本人表示の実施メモ（2026-10-09）

- Proxy の `getClaims()` で検証済みの claims が得られない場合、`/projects` とその配下から `/login` へ `307` で移動する。ログイン画面をこの移動の対象にせず、SDK が更新した Cookie とキャッシュ制御ヘッダーをリダイレクトにも付ける。
- shadcn/ui の DropdownMenu を追加し、サイドバーに `UserMenu` と `LogoutButton` を配置した。`LogoutButton` が `signOut({ scope: 'local' })` で現在のセッションを終了し、Cookie の更新を SDK に任せ、`router.replace('/login')` と `router.refresh()` で画面を切り替える。
- ログアウト処理中は二重操作を防ぎ、失敗時は固定のエラーと再試行できる状態を表示する。メニューを閉じて再度開いても処理中の状態・エラーを保持する。`button.test.tsx` でメニューを通した `LogoutButton` の振る舞いを確認する。
- 本人取得の `get-current-user.ts` とテストをログイン画面の `_lib` から `src/lib/auth` に移し、ログインフォームの import・mock と学習メモのリンクを更新した。
- Server Component の `ProjectsSidebarContainer` で Cookie のセッションから token を取得し、`getCurrentUser()` で `/api/auth/me` を呼ぶ。名前とメールを `ProjectsSidebar` → `UserMenu` に props で渡し、名前が `null` なら「ユーザー」と表示する。token 自体は表示用 props に渡さない。
- AuthService が検証済み Supabase ユーザーの `user_metadata.name` を正規化し、AuthRepository が User の作成・更新時にメールと名前を保存する。文字列なら trim し、未設定・空白・文字列以外なら `null` にして既存の名前も更新する。この処理は共通 AuthGuard を通る Project API でも行う。名前は表示用に限り、認可判断には使わない。
- ユーザーによるブラウザ確認で、未ログインの `/projects`・`/projects/new` からログイン画面への移動とループしないこと、ログアウト後のログイン画面への移動、再度 `/projects` を直接開いた場合のログイン画面への移動、本人のメールと名前の表示を確認した。
- Web の対象テスト（セッション基盤・Proxy 22件、ログアウト7件、サイドバー7件、共通の本人取得6件）、対象 lint・format、Web typecheck が通過した。ブラウザ全体の自動テストは Playwright 導入時に追加する。
- Auth E2E を3件から12件に増やし、実際のローカル Supabase と専用 DB で名前の保存・trim・更新、未設定や不正な型の `null`、既存の名前を `null` に更新することを確認した。一時ユーザーの準備・後片付けをファイル内の `withTestUser()` にまとめ、Auth E2E 12件、API typecheck、対象 lint・format が通過した。
- Swagger、API / Web README、Bruno の説明、認証の学習メモを現在の実装に合わせて更新した。
- コミット前の確認で、Web の Vitest 149件、API の単体テスト12件、API E2E 47件（Health 1件・Projects 34件・Auth 12件）、API / Web の lint・typecheck、ルートの format check が通過した。

#### 狭い画面のヘッダー・共通ナビゲーションの実施メモ（2026-10-09）

- 2026-10-08 の画面確認で見つかった狭い画面用ヘッダーの欠落に対応した。`lg`（64rem / 通常1024px）未満で `AppHeader` を表示し、左にハンバーガーメニュー、中央にロゴと `Redmine Nest`、右に名前の先頭文字のアイコンを置く。右のアイコンには操作を持たせない。
- shadcn/ui の Sheet を追加し、一覧・各プロジェクトへのリンク、選択中の青色表示、アーカイブ済みの表示、最下部の `UserMenu` を実装した。リンク選択で Sheet を閉じ、リストだけをスクロール可能にする。背景はぼかさず暗くする。
- Sheet を `keepMounted` にしてログアウト処理中の状態とエラーを保持する。開閉を管理する `AppHeader` から `UserMenu` の開閉も制御し、Sheet の閉鎖や PC 幅への切り替えで小メニューだけが残ることを防ぐ。ログアウト処理自体は既存の `LogoutButton` を使う。
- `layout.tsx` の取得処理を Server Component の `ProjectsNavigationContainer` にまとめ、一覧と本人情報を並行して取得する。同じ `navigationProps` を `ProjectsSidebar` と `AppHeader` に渡し、token 自体は表示用 props に含めない。
- 共通の取得処理を一つの `Suspense` で囲み、サイドバーとヘッダーの fallback を両方渡す。Tailwind CSS で PC と狭い画面の表示を切り替え、取得中もサイドバーの幅・ヘッダーの高さ48pxを確保する。
- AppHeader 12件・サイドバー7件・ログアウト7件の計26件、対象コードの lint・format、Web typecheck が通過した。Sheet の開閉・キーボード操作・フォーカス復帰・PC 幅への切り替え、選択表示、Sheet を閉じて再び開いた時のログアウト処理中状態の保持と二重送信防止を確認した。共通の親へ整理した後の `layout.tsx` も lint・format・typecheck を確認した。
- ユーザーによるブラウザ確認で、PC とスマホ幅のプロジェクト・本人表示、選択時の詳細への遷移と Sheet の閉鎖、スマホ側からのログアウト、ログアウト後に `/projects` を直接開いた時の `/login` への移動を確認した。
- Web README、構成・画面仕様、ログインと登録の学習メモを更新し、図にも共通の親から Sidebar と Header へデータを渡す流れを反映した。
- ユーザーが `pnpm --filter @redmine-next-nest/web test` を実行し、この区切りの Web 全体のテストが通過したことを確認した。
- PR #21 の初回 CI では format・lint・typecheck・単体テスト（Web 161件・API 12件）が通過したが、Web build は Supabase の公開設定2項目が未設定のため失敗した。`quality` の build step にローカル URL とビルド確認専用の Publishable key の値を設定し、CI で確認する。この成果物はデプロイには使わず、認証の結合確認は既存の `api_e2e` job で起動するローカル Supabase を使う。

#### Project 一覧の参加者による絞り込みの実施メモ（2026-10-09）

- PR #21 マージ済みの `develop`（`6f80cbb`）から `feat/phase-2/project-authorization` を作成した。区切り4は一覧 → 詳細 → 設定更新 → アーカイブ → 解除の順に、1 endpoint ずつ説明・相談・実装・確認・テストを行う。
- `GET /api/projects` の Controller で検証済みの `request.user.id` を取得し、Service → Repository に渡す。Repository の `projectMembers.some.userId`（2026-10-11 に関連名を変更）で、本人が ProjectMember として参加している Project だけを取得する。owner・member・viewer を対象にし、既存の作成日時降順とアーカイブ済み Project の表示を維持する。参加 Project がなければ `200` と空配列を返す。
- 詳細・変更操作は、存在しない Project と非参加者に同じ `404` 応答を返し、Project の存在を知らせない方針で合意した。参加者である member・viewer の設定更新・アーカイブ・解除は `403` にする。正式な API 契約を `UI_API.md` に記載したが、これらの endpoint の認可は次の実装対象である。
- 一覧の API E2E を10件に増やし、3 role の取得、非参加 Project の除外、参加ゼロの空配列、`ownerId` が本人でも参加情報がなければ取得できないこと、アーカイブ済み・並び順・既存の `401` を確認した。別ユーザーはローカル Supabase の一時ユーザーとして用意し、後片付けは ProjectMember → Project → User → Supabase Auth の順に行う。
- API E2E 52件（Projects 39件・Auth 12件・Health 1件）、API lint・typecheck、変更コードと API README の format check、`git diff --check` が通過した。DB schema・migration・依存関係・Web は変更していない。詳細・設定更新・アーカイブ・解除の認可は未実装である。
- 後続の拒否操作のテストでは、Project と ProjectMember の値・更新日時が変わらないことを確認する。既存 AuthGuard は認可より前に User のプロフィールを同期するため、認証済みの拒否操作でも User の更新日時は変わり得る。

#### Prisma の関連フィールドの命名変更（2026-10-11）

- `Project.members` と `User.projectMemberships` を、参照するモデルが分かる `projectMembers` に揃えた。所有者の ID と関連を表す `Project.ownerId` / `Project.owner`、所有する Project 一覧を表す `User.ownedProjects` は維持した。
- Repository の一覧絞り込みと、既存 API E2E の参加情報の作成・取得・保存結果の確認を新しい関連名に揃えた。Prisma Client を再生成した。
- Prisma schema の検証が成功し、変更前後の `prisma migrate diff --script --exit-code` は空の migration（exit code 0）となった。DB のテーブル・カラム・外部キーと既存データは変更せず、新しい migration は作成していない。
- API の `oxlint src/ test/`、`tsc --noEmit`、Repository と API E2E ファイルの `prettier --check` が通過した。Prisma はインストール済みの CLI で `format`・`validate`・`generate` を実行した。
- 通常の `pnpm test:e2e` は51件成功・1件失敗となった。既存の「更新時に無効な token を401で拒否し、DBを変更しない」で、期待した401に対して404が返った。該当ケースの単独実行は成功し、その後の `vitest run --config vitest.config.e2e.ts --no-file-parallelism` は全52件が通過した。初回の404の原因は未特定であり、並列実行が原因だとは断定しない。認証・テスト設定の修正は行わず、再発時は応答内容と実行条件を確認する。

#### Project 詳細の参加者による認可の実施メモ（2026-10-11）

- ユーザーが Repository → Service → Controller の順に実装し、各段階でコードレビューを行った。Repository の `findByIdForMember()` は ID と本人の `projectMembers.some.userId` を同時に検索条件にし、Service の `findOneForMember()` は取得できなければ既存と同じメッセージの `NotFoundException` を返す。
- Controller の `GET /api/projects/:projectId` は、AuthGuard が確認した `request.user.id` を認可付き Service に渡す。同じ GET ルートが2件ある状態をレビューで指摘し、ユーザーが旧ハンドラーを削除した。Service の既存 `findOne()` は、後続で扱う更新・アーカイブ・解除の存在確認のため維持している。
- 詳細の API E2E を4件から9件に更新した。owner・member・viewer の取得、viewer によるアーカイブ済み Project の取得、参加情報がなければ `ownerId` が本人でも404になること、既存の token なし・無効 token の401を確認する。
- 別 Project に参加していても対象 Project に参加していなければ取得できず、存在しない ID と同じ404本文を返すことを確認する。拒否の前後で対象 Project と ProjectMember の値・更新日時も比較する。User のプロフィール同期はこの不変性の確認対象に含めない。
- 別ユーザーを作る既存の `createOtherUser()` を、一覧・詳細のテストで共有できるよう同じファイルの親 `describe()` に移した。テスト終了時のローカル Supabase と専用 DB の後片付けは維持した。
- 詳細取得の API E2E 9件、通常の `pnpm test:e2e` の全57件（Projects 44件・Auth 12件・Health 1件）が通過した。Project の Controller / Service / Repository と API E2E の対象 lint・format、API typecheck、API README の format、`git diff --check` も通過した。Prisma の関連名変更時に記録した予想外の404は、今回の通常実行では再現しなかった。

#### Project 設定更新の owner による認可の実施メモ（2026-10-11）

- Repository → Service → Controller を段階的に実装・確認した。Repository の `findProjectMember(projectId, userId)` は複合 unique 条件で本人の参加情報を取得する。Controller は AuthGuard が確認した `request.user.id` を Service の `update()` に渡す。
- Service は参加情報がなければ既存と同じ404本文を返し、参加者である member・viewer は403で拒否する。owner の場合だけ更新項目を確認して保存する。本文が `{}` の場合も先に認可を行い、owner には400、member・viewer には403、非参加者・存在しない ID には404を返す。
- 更新の API E2E を8件から13件に更新した。既存の成功・入力エラーの準備に owner の ProjectMember を追加し、owner の更新・DB 保存、アーカイブ済み Project の設定更新、member・viewer の403を確認する。
- 別 Project の owner でも非参加 Project は更新できず、存在しない ID と同じ404本文を返すこと、`ownerId` が本人でも参加情報がなければ404になることを確認する。401・403・404と既存の400の拒否では、対象の Project と ProjectMember の値・更新日時が変わらないことも比較する。認証済みの拒否操作で行われる User のプロフィール同期は、この不変性の確認対象に含めない。
- 更新の API E2E 13件、通常の `pnpm test:e2e` の全62件（Projects 49件・Auth 12件・Health 1件）が通過した。対象テストの lint・format、API typecheck、API README の format、`git diff --check` も通過した。今回のテスト更新では、API 実装・Prisma schema・migration・依存関係・Web は変更していない。

#### Project アーカイブ・解除の owner による認可の実施メモ（2026-10-11）

- ユーザーが Service と Controller を実装し、コードレビューで確認した。Controller は AuthGuard が確認した `request.user.id` を渡し、Service の `archive()` / `unarchive()` は本人の参加情報を取得する。参加情報がなければ同じ404本文、member・viewer なら操作に応じたメッセージの403を返し、owner の場合だけ Repository に保存を依頼する。
- アーカイブの API E2E を5件から13件、解除を4件から13件に更新した。既存の成功ケースに owner の ProjectMember を追加し、owner の成功・DB 保存と参加情報の維持、アーカイブ済みの再アーカイブ・解除済みの再解除の成功を確認する。
- member・viewer の403、別 Project の owner による非参加 Project の操作が存在しない ID と同じ404になること、`ownerId` が本人でも参加情報がなければ404になることを追加した。アーカイブ状態が `true`・`false` のどちらでも認可を確認し、同じ状態への再操作でも権限不足を見逃さない。
- 401・403・404で拒否された操作では、Project と ProjectMember の値・更新日時を操作前後で比較する。別 Project に参加しているケースでは本人の参加先も変わらないことを確認する。AuthGuard による User のプロフィール同期はこの比較に含めない。
- 対象 Vitest のアーカイブ13件・解除13件と、通常の `pnpm test:e2e` の全79件（Projects 66件・Auth 12件・Health 1件）が通過した。対象テストの lint・format、API typecheck、API README の format、`git diff --check` も通過した。今回のテスト更新では、API 実装・Prisma schema・migration・依存関係・Web は変更していない。

#### Project 認可の Swagger 説明の更新（2026-10-11）

- 設定更新・アーカイブ・解除の `ApiOperation` に owner のみと明記した。各操作の `ApiForbiddenResponse` は、AuthGuard のメール未設定・未確認と参加者の role が owner 以外の場合を説明する。詳細取得を含む4 API の `ApiNotFoundResponse` は、Project が存在しない場合と非参加者の場合を説明する。
- API build 後の Controller から `SwaggerModule.createDocument()` で実際にドキュメントを生成し、3 API の概要・403、4 API の404、全6 API の Bearer 認証・401を確認した。生成確認は Controller のみを用意して行い、DB と Supabase Auth は使用していない。
- 対象 Controller の lint・format、API typecheck・build、API README の format、`git diff --check` が通過した。今回は説明用の注釈と docs を更新し、API E2E は再実行していない。直前の認可確認では全79件が通過している。PR 前の全体確認は後続で行う。

#### Project 認可の PR 前の全体確認（2026-10-11）

- `pnpm format:check`・`pnpm lint`・`pnpm typecheck`、`pnpm test`（API 12件・Web 161件）、`pnpm test:e2e`（Projects 66件・Auth 12件・Health 1件の全79件）が通過した。API E2E は通常のファイル並列設定で実行し、過去に記録した無効 token に対する予想外の404は再現しなかった。
- `pnpm build` は Web・API ともに通過した。Web は CI と同じローカル URL と公開用のダミー設定で確認し、Supabase へ接続する画面操作は行っていない。`pnpm test` は sandbox のレジストリ接続制限で初回起動が停止し、制限外で再実行して成功した。
- Prisma schema の `validate`・Client の `generate` と、`develop` の schema に対する `migrate diff --script --exit-code` を再確認した。差分は空の migration（exit code 0）で、DB のテーブル・カラム・外部キーを変えず、migration の追加は不要である。
- 認証済みの ID と対象 Project の membership・role を使う呼び出し経路、非参加者の404と参加者の権限不足の403、拒否時の Project・ProjectMember の不変性をレビューし、修正が必要な指摘はなかった。`git diff --check` も通過した。テストのファイル分割は合意どおり後続の整理 PR で扱う。

#### Project メンバー一覧の実施メモ（2026-10-11）

- PR #22 マージ済みの `develop` から作成したブランチを `feat/phase-2/project-members-list` に変更し、区切り5の最初の endpoint として `GET /api/projects/:projectId/members` を実装した。Repository → Service → DTO → Controller の順に確認し、API 契約を `UI_API.md` に記録した。
- Controller は AuthGuard が確認した `request.user.id` を Service に渡す。Service は対象 Project の本人の参加情報を取得し、非参加者・存在しない Project は同じ404本文、参加者の member・viewer は403で拒否する。owner だけが本人を含むメンバー一覧を取得できる。`ownerId` や表示用の名前だけで許可しない。
- Repository は対象 `projectId` に限定して、ProjectMember の `id`・`userId`・`role`・`createdAt` と、アプリ側 User の `name`・`email` を取得する。role は既存の PostgreSQL enum の定義順で owner → member → viewer、同じ role は参加日時の古い順、日時も同じなら ProjectMember ID の昇順で返す。未設定の名前は `null` とする。
- `ProjectMemberResponseDto` と、内側の User 表示情報を表す `ProjectMemberUserResponseDto` を追加した。role は生成済みの `ProjectMemberRole` を使い、Controller の Swagger はメンバー DTO の配列と、Bearer 認証・401・403・404を説明する。
- メンバー一覧の API E2E を10件追加し、全 role を含む owner の200、返却項目・名前の `null`、3段階の並び順、別 Project の参加情報の除外、member・viewer の403を確認した。token なし・形式不正・無効の401、別 Project の owner による非参加 Project と存在しない ID の同じ404、`ownerId` が本人でも参加情報がなければ404になることも確認した。
- 拒否された操作では Project と ProjectMember の値・更新日時を比較し、対象 Project と参加情報が変わらないことを確認した。認証済みリクエストの AuthGuard による User のプロフィール同期は、この比較に含めない。
- メンバー一覧の10件と、通常の `pnpm test:e2e` の全89件（Projects 76件・Auth 12件・Health 1件）が通過した。対象テストの lint・format、API typecheck、`git diff --check` も通過した。DB schema・migration・依存関係・Web は変更していない。

#### Project メンバー一覧の PR 前の全体確認（2026-10-11）

- インストール済み CLI でルートの Prettier（`--check --ignore-unknown .`）、Web の ESLint・API の `oxlint src/ test/`、Web・API の `tsc --noEmit`、Vitest（API 12件・Web 161件）が通過した。docs は既存の Prettier 除外設定に従い、差分を直接確認した。
- CI と同じ公開用のローカル URL・ダミーキーを指定した `pnpm build` は、Web・API ともに通過した。
- API build 後の Controller から Swagger を生成し、メンバー DTO の配列、role の enum、日時・UUID の形式、User の名前の nullable、Bearer 認証・401・403・404を確認した。ドキュメント生成だけの確認として、DB と Supabase Auth へ接続しない構成で実行した。
- 認証済みユーザーの ID、対象 Project の membership・owner role、Project ごとの絞り込み、返却項目と並び順、拒否時の DB 不変性を最終レビューし、修正が必要な指摘はなかった。API 実装・テストは直前の全89件成功時から変更していないため、その API E2E の結果を使用した。`git diff --check` も通過した。

#### Project メンバー追加の実施メモ（2026-10-13）

- PR #23 マージ済みの `develop`（`84c94be`）から `feat/phase-2/project-members-add` を作成し、`POST /api/projects/:projectId/members` を Repository → Service → DTO → Controller → API E2E の順に実装・確認した。構成は既存の Controller → Service → Repository → PrismaService を維持している。
- 追加対象は email で指定する。文字列の前後の空白だけを除き、大文字・小文字を変換せず、アプリ側 User.email と完全一致で検索する。Supabase Auth の登録とアプリ側 User の作成は別であり、アプリ側 User が存在する人だけを対象にする。追加処理で対象 User を作成・同期しない。
- 追加可能な role は member・viewer に限定した。Repository の入力型には `Exclude<ProjectMemberRole, typeof ProjectMemberRole.owner>`、DTO の実行時検証には `IsIn` を使う。email の Transform は文字列のときだけ trim し、null・数値などは `IsEmail` で400にする。
- Controller は AuthGuard が確認した実行者の `request.user.id` と DTO の email・role を Service に渡す。Service は本人の membership・owner role を確認し、非参加者・存在しない Project は同じ404本文、member・viewer は403にする。認可後にアーカイブ状態と追加対象を確認し、アーカイブ済みなら409、対象 User が存在しなければ404、参加済みなら409にする。
- 保存には追加対象 User の ID を使い、実行者の ID と区別する。同じ Project と User の複合 unique 制約を維持し、保存時の `P2002` も409へ変換する。追加 API で既存参加者の role を変更しない。成功時は201と、既存の `ProjectMemberResponseDto` による単一メンバーを返す。
- API build 後の Controller から Swagger を生成し、POST の route、AuthGuard・入力 DTO の関連付け、email の形式、member・viewer の enum、201の単一メンバー、名前の nullable、Bearer 認証、400・401・403・404・409を確認した。このドキュメント生成確認では DB・Supabase Auth へ接続していない。
- 追加 API の E2E を39件追加した。member・viewer の201と返却項目・名前の null・DB保存、前後空白の除去、別 Project に参加済みの User の追加を確認した。401・403・404・400・409、Supabase Auth だけに登録済みの対象、メールの大文字・小文字の違い、owner 自身を含む参加済みの3 role、同時追加の201・409と参加情報1件を確認した。
- 拒否時は Project・ProjectMember の値・更新日時を比較し、別 Project を用意したケースではそちらも不変であることを確認した。成功時も Project と既存参加情報を維持する。AuthGuard による User のプロフィール同期は比較に含めない。既存の一時ユーザー作成・後片付けを使い、ファイル分割・共通 helper の導入は行っていない。
- 通常の `pnpm test:e2e` は全128件（Projects 115件・Auth 12件・Health 1件）が通過した。変更対象の format・lint、API typecheck・build、`git diff --check` も通過した。DB schema・migration・依存関係・Web は変更していない。PR 前のレビュー・品質チェックの結果は下記の実施メモを参照する。PR 作成・CI は未実施である。
- 本メモの更新時に、API 契約を `UI_API.md`、業務ルールを `DOMAIN_MODEL.md`、追加 API と検証内容を API README に反映した。今回は docs の変更だけであり、直前の全128件成功の結果を使用する。

#### Project メンバー追加の PR 前レビュー・品質確認（2026-10-13）

- ユーザーが Bruno で作成した `get-project-members.yml`・`add-project-member.yml` をレビューした。メソッド・URL・JSON 本文・seq・Bearer 設定が正しく、token は `{{accessToken}}` を参照し、実際の JWT は保存されていない。2ファイルは既存の Prettier 形式に整え、Bruno README に2ユーザーの準備・owner の token への切り替え・一覧と追加・エラー時の確認を追記した。ユーザーによる一覧200・追加成功・一覧再取得で owner と member の2人を確認した結果も記録した。
- `pnpm format:check`・`pnpm lint`・`pnpm typecheck` が通過した。`pnpm test` は API 12件・Web 161件、通常の `pnpm test:e2e` は全128件（Projects 115件・Auth 12件・Health 1件）が通過した。docs の JSON 例・ローカルリンク・コードブロックと `git diff --check` も確認した。
- API build は通過した。標準の `pnpm build` は Web の Google Fonts 取得で停止し、制限外での再実行は Turbopack の CSS 処理におけるポート作成の `Operation not permitted` で失敗した。CLI の `--webpack` を確認して Web build を別途実行し、コンパイル・型チェック・ページ生成は通過した。公開設定は CI と同じローカル URL とダミーキーを使った。標準 Turbopack build の成功とは扱わず、PR 前または CI で再確認する。
- 全体レビューで、メンバー追加のアーカイブ確認と保存の間に別リクエストのアーカイブが完了すると、アーカイブ済み Project にメンバーが追加される問題を再現した。リポジトリ外の一時テストで対象 User 検索の進行だけを制御し、本物の token・HTTP リクエスト・E2E 専用 DB を使った。結果は追加201、`isArchived: true`、参加情報2件で、期待する409・参加情報1件の確認が失敗した。通常の128件とは別の再現確認である。
- このレビューでは競合を指摘し、API 実装は変更しなかった。競合の修正・回帰テストの確認結果は、下記の2026-10-15の実施メモに記録した。Bruno の2ファイルには修正が必要な動作上の指摘はなかった。

#### Project メンバー追加とアーカイブの競合修正・回帰確認（2026-10-15）

- Repository の `createProjectMember` を transaction 化した。`SELECT … FOR UPDATE` で対象 Project 行をロックし、Project の存在・アーカイブ状態の再確認とメンバー保存を同じ transaction 内で行う。`$queryRaw` のタグ付きテンプレートで Project ID をパラメーターとして渡し、transaction の終了まで行ロックを保持する。
- Repository は `created`・`project_archived`・`project_not_found` を返し、Service は作成したメンバー・409・既存と同じ404本文へ変換する。Service の事前の認可・業務ルール確認の順序と、重複時の `P2002` → 409を維持した。既存のアーカイブ UPDATE と行ロックで待ち合わせるため、アーカイブ API の実装変更は不要だった。
- 既存の `projects.e2e-spec.ts` のメンバー追加グループに回帰テストを2件追加した。Service の事前確認後にアーカイブが完了した場合、追加を409で拒否し、アーカイブ後の Project・ProjectMember の値・更新日時を維持する。追加が先に Project 行をロックした場合は、保存までアーカイブが DB でロック待ちとなり、追加201・アーカイブ200と DB 保存を確認する。HTTP レスポンスの到着順を保証するテストではない。
- 本物のローカル Supabase token と E2E 専用 PostgreSQL の構成を維持した。保存前の進行制御と PostgreSQL のロック待ちの確認で順序を再現し、固定時間の待機には頼らない。失敗時も待機・ロック・spy を解除してから既存の後片付けへ進む。User のプロフィール同期は不変性の比較に含めず、ファイル分割・共通 helper の導入は行っていない。
- 追加2件の対象実行と、通常の `pnpm test:e2e` の全130件（Projects 117件・Auth 12件・Health 1件）が通過した。メンバー追加のテストは39件から41件になった。Repository・Service 修正時の format・lint・API typecheck・build、回帰テスト追加時の format・lint・API typecheck・`git diff --check` も通過した。
- 本メモと `DOMAIN_MODEL.md`・`UI_API.md`・API README を更新し、保存時の状態確認・競合時の動作・最新テスト件数を反映した。docs 更新時は直前の全130件成功の結果を使用する。DB schema・migration・依存関係・Web は変更していない。
- 修正後の PR 前レビューで、認証・認可、重複防止、行ロックによる競合対策、拒否時の DB 不変性、Swagger・Bruno・docs の整合性を再確認した。新たに修正が必要な指摘はなかった。`pnpm format:check`・`pnpm lint`・`pnpm typecheck`・`pnpm test`（API 12件・Web 161件）・`pnpm test:e2e`（全130件）が通過した。Swagger の生成結果、docs の JSON 例・ローカルリンク、`git diff --check` も確認した。
- ユーザーによる標準 `pnpm build` の成功ログを確認し、Codex 側でも同じコマンドを再実行した。API build と Web の標準 Turbopack build がともに通過した。2026-10-13 の環境制限による build の再確認待ちは解消した。

#### Project メンバー追加のマージ済み状況（2026-10-16確認）

- PR #24 は `develop` にマージ済みで、CI の Quality checks・API E2E は両方成功している。ユーザーがローカルの `develop` も更新し、HEAD `7525564`・作業ツリーがクリーンであることを確認した上で、次の role 変更作業を開始した。
- 上記の追加 API の実施メモにある PR 準備・CI 確認待ちは、その時点の記録である。標準の `pnpm build` の確認待ちも解消済みである。

#### Project メンバーrole変更の実施メモ（2026-10-16）

- PR #24 マージ済みの `develop`（`7525564`）から `feat/phase-2/project-members-role-update` を作成した。`PATCH /api/projects/:projectId/members/:memberId` を Repository → Service → DTO → Controller → API E2E の順に、仕様を相談しながら実装・確認した。
- `memberId` は User ID ではなく ProjectMember.id とした。Repository の `findProjectMemberById(projectId, projectMemberId)` と更新処理の両方で、指定 Project への所属を検索条件に含める。内部の引数名は User ID と区別するため `projectMemberId` とした。
- `updateProjectMemberRole` は transaction 内で Project 行を `SELECT … FOR UPDATE` によりロックし、Project 不在 → アーカイブ済み → 対象不在 → owner 保護 → 同じ role → 更新の順で判定する。Repository は `project_not_found`・`project_archived`・`member_not_found`・`owner_protected`・`unchanged`・`updated` を返し、HTTP の例外を扱わない。
- Service は AuthGuard が確認した実行者の ID と対象 Project の membership・owner role で認可する。非参加・Project 不在の404、member・viewer の403、アーカイブ済み・owner 対象の409、対象不在・別 Project の参加情報の同じ404を、合意した順序・本文で返す。同じ role でも Service から早期に成功を返さず、保存時の再確認へ進む。
- `UpdateProjectMemberRoleDto` は role のみを必須とし、`IsIn` と `Exclude<ProjectMemberRole, typeof ProjectMemberRole.owner>` で member・viewer に限定する。空白除去・大文字小文字の変換は行わず、owner・manager・null・型不正・定義外の項目を400にする。成功時は200と既存の `ProjectMemberResponseDto` による単一メンバーを返す。同じ role は UPDATE せず、更新日時も維持する。
- Controller は AuthGuard・DTO・Service を接続し、`request.user.id` を渡す。Swagger の PATCH ルート、projectId・memberId、role 必須と2種類の enum、200の単一メンバー・名前の nullable、Bearer 認証、400・401・403・404・409を生成結果で確認した。
- 既存の `projects.e2e-spec.ts` に role 変更53件を追加した。member ↔ viewer と同じ role の200、返却項目、名前の null、対象だけの更新、認証・認可・入力・Project 所属・owner 保護・判定順を確認する。拒否時と変更不要時は Project・ProjectMember の値と更新日時を比較し、User のプロフィール同期を含めない。
- 保存直前の Project・参加情報の削除に対する404を2件、アーカイブとの競合を3件、同時 role 変更を2件追加した。アーカイブ完了後は同じ role でも409となり、role 変更が先に Project 行をロックした場合は、アーカイブが保存まで待機する。同時変更は、2件目が Project 行を待つことを確認してから再開し、最新の role に後の指定を適用する。処理の進行・DB のロック待ちで順序を再現し、固定時間の待機は使わない。失敗時も待機・ロック・spy を解除して既存の後片付けへ戻す。
- 本物のローカル Supabase token と E2E 専用 PostgreSQL を使い、追加グループの53件と通常の `pnpm test:e2e` の全183件（Projects 170件・Auth 12件・Health 1件）が成功した。API typecheck、変更した TypeScript の lint・format、API build、`git diff --check` も通過した。DB schema・migration・依存関係・Web は変更していない。テストのファイル分割・共通 helper 導入も行っていない。
- `DOMAIN_MODEL.md`・`UI_API.md`・API README と本メモに仕様・進捗・検証結果を反映した。文書更新時は直前の全183件成功の結果を使用する。この時点では role 変更用の Bruno リクエストと手動確認、PR 前の全体レビュー・品質チェック、PR 作成・CI は未実施であり、後の結果は下記に記録する。

#### Project メンバーrole変更の手動確認・PR前確認（2026-10-16）

- ユーザーが Bruno で作成した `update-project-member-role.yml` を確認した。PATCH のメソッド、role のみの JSON 本文、Bearer 認証、既存リクエストと重複しない seq が適切で、token は `{{accessToken}}` を参照している。実際の token は保存されていない。
- ユーザーから role 変更の手動成功の報告を受けた。Bruno README にリクエストへのリンク、owner の token の利用、URL の `<projectId>`・`<projectMemberId>` を実際の ID に置き換える手順、ProjectMember.id と User.id の違い、成功・失敗時の確認を追記した。
- Controller・DTO・Service・Repository・API E2E・関連 docs・Bruno の差分全体をレビューした。認証・owner 認可、Project 所属、owner 保護、同じ role の不変性、アーカイブ・同時 role 変更のロック順、失敗時の後片付けを確認し、修正が必要な指摘はなかった。
- `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（Web 161件・API 12件）、`git diff --check` が成功した。Bruno の12リクエストの seq 重複・role リクエストの本文と token 参照、関連文書の JSON 例16件・ローカルリンク28件・コードブロック・エラー本文の整合性も確認した。`docs/` は Prettier の対象外のため、文書の整合性確認とフォーマット確認を区別している。
- API E2E は、同じ実装・テストで直前に成功した全183件（Projects 170件・Auth 12件・Health 1件）の結果を使用した。以降は docs と Bruno のみを更新しており、この PR 前確認では API E2E を再実行していない。
- 公開用ダミーの Supabase 設定を指定した標準の `pnpm build` は、API が成功した後、Web の Google Fonts 取得で失敗した。制限外での再実行でも、Turbopack の CSS 処理で `creating new process` → `binding to a port` → `Operation not permitted (os error 1)` により停止した。この時点では標準 Web build の成功確認を保留し、PR #24 の成功結果で代用しなかった。
- 補助確認として、同じ公開用ダミー設定で `pnpm --filter @redmine-next-nest/web exec next build --webpack` を実行し、コンパイル・TypeScript・静的ページ生成を含め成功した。build script・依存関係・Web の実装は変更していない。
- その後、ユーザーが実行した標準の `pnpm build` の成功ログを確認した。API の `nest build` と Web の `next build`（標準 Turbopack）がともに成功しており、今回の環境制限による build の確認待ちは解消した。Codex 側で同じコマンドの再実行は行っていない。

#### 後続作業

- 区切り1〜4と区切り5のメンバー一覧・追加は PR #24 まで `develop` にマージ済み。role 変更 API は作業ブランチで実装・API E2E 全183件・Bruno 手動成功・文書更新・全体レビュー・PR 前の品質チェックまで完了した。標準の `pnpm build` もユーザーの実行ログで API・Web ともに成功を確認済み。次はコミット・push・PR 作成後に CI を確認する。コミット・push・PR 作成・マージはユーザーが依頼した段階で行う。
- 確認待ちの画面でフォームを残す現在の構成は、今後、案内を中心とした表示や確認メールの再送導線を必要に応じて検討する。
- `token_hash` は秘密の値として扱う。本番では HTTPS とアクセスログのクエリ除外・マスキングを確認する。現在のテストはログ収集基盤の設定までは検証していない。
- メンバー削除 API、owner 自身の削除を防ぐ処理、メンバー管理 Web UI は区切り5の後続 PR で進める。role 変更側の owner 保護は実装・確認済みである。後続の各操作も、権限と拒否時の DB 不変性を API E2E で確認する。
- Projects API E2E のファイル分割・共通 helper の導入は、ユーザーがテスト構成を理解してから再検討する。現在は整理 PR を保留し、既存ファイルの構成を維持して機能追加を進める。
- 現在のローカル設定は `[auth.email].enable_confirmations = true` である。Auth / Project の API E2E は管理 API の `email_confirm: true` で一時ユーザーを作るため、メール確認そのもののブラウザ E2E は Playwright 導入時に追加する。

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

> `docs/REQUIREMENTS.md`、`docs/DOMAIN_MODEL.md`、`docs/UI_API.md` と本書のタスク 5 を読んでください。PR #24 まで `develop` にマージ済みで、`feat/phase-2/project-members-role-update` では role 変更 API・API E2E 53件追加と全183件成功・仕様書と Bruno README の更新・ユーザーによる Bruno 手動成功・全体レビューまで完了しています。format・lint・typecheck・単体テストは成功し、標準の `pnpm build` もユーザーの実行ログで API・Web ともに成功を確認済みです。環境制限による build の確認待ちは解消しています。現在の差分と検証結果を確認し、コミット・PR 準備の進め方を説明してください。ファイル変更・コミット・push・PR 作成は、明示的に依頼した段階で行ってください。

最初のタスク以外に着手する場合は、依頼文でタスク名を指定する。この文書の状態と完了条件を、新しいスレッドの作業基準として使う。
