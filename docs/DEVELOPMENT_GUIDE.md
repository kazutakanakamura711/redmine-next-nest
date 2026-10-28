# 機能を実装する順番

## Project 基本操作の次に進める順番

Project の作成・一覧・詳細・更新・アーカイブ・解除、認証と Project 権限、メンバー管理 API と Web の一覧・追加・権限変更・削除 UI は PR #30 まで `develop` にマージ済み。Playwright の専用環境・ブラウザテスト6件・CIはPR #31でマージ済みで、マージ後のCIも3 jobが成功している。

Storybookの最小設定・Button・CI・[手順書](./STORYBOOK_SETUP_GUIDE.md)はPR #32、Input＋LabelはPR #33、BadgeはPR #34、AlertはPR #35、AlertDialogはPR #36で `develop` にマージ済みである。今回予定した代表部品まで導入が完了し、PR #36のマージ後CIも3 jobが成功している。検証結果は `QUALITY_SECURITY_FOLLOW_UP_TASKS.md` のタスク7を参照する。

| 順番 | 対象 | 到達点 |
| --- | --- | --- |
| 1 | Supabase Auth と Project 権限 | ログイン、API の token 検証、User / ProjectMember、owner 登録、参加者だけの閲覧、owner だけの設定・アーカイブ操作を実装する。メンバー管理と権限別の API E2E も確認する。 |
| 2 | Playwright の導入 | ログインと Project の作成・更新・アーカイブ・解除を、専用データを使うブラウザE2Eとしてローカルと CI で確認する。 |
| 3 | Storybook の導入 | 既存の再利用 UI から story を作り、代表的な状態を画面から切り離して確認できるようにする。カタログの build を CI でも確認する。 |
| 4 | Task CRUD と Task 権限 | Project に属する Task の API と画面を操作ごとに追加する。最初から ProjectMember の role、別 Project へのアクセス、アーカイブ状態を検証し、主要導線と再利用 UI の確認も拡張する。 |

開発用 DB の既存 Project 6 件は試作データとして削除済み。作成者を記録していなかったため、所有者を推測して割り当てる移行処理は入れない。新規 Project は認証済みの作成者を owner として登録する。認証・権限・DB変更の影響と確認方法は実装前に明確にする。

各段階は複数の小さな Pull Request に分けてよい。Task の権限判定は Task API と同じ変更で入れ、認証なしの Task endpoint を新たに追加しない。
Task は一覧・詳細、作成、更新、削除を操作ごとに進め、対応する画面と API E2E を追加する。主要導線が増えた時点で Playwright、再利用 UI が増えた時点で Storybook も更新する。

### Task 一覧 API の区切り（2026-10-27）

Task モデル・migration と `GET /api/projects/:projectId/tasks` は PR #37 で `develop` にマージ済みである。その区切りで Task 一覧の API E2E は25件、既存を含む API E2E 全体は245件が専用環境で成功した。ユーザーは Swagger で token なしの401、参加 Project の200と空配列、存在しない Project の404を確認している。この時点では詳細・作成・更新・削除 API と Web は後続としていた。

次の機能は Task 一覧画面 → 詳細 → 作成 → 更新 → 削除の順で、小さく進める。
一覧画面を作るときに Table、フォームを作るときに Textarea の story を追加し、Task 作成の主要導線ができた段階で Playwright を拡張する。一覧 API だけの変更では story を追加しない。

### Task 一覧 Web の区切り（2026-10-28）

認証付きの Task 一覧取得と、一覧・空状態・loading・error は PR #38 で `develop` にマージ済みである。
タスクは `/projects/[projectId]/tasks`、設定は `/projects/[projectId]/setting` に分け、それぞれのページでデータを取得し、画面に合う loading を表示する。Project の入口 URL はタスク一覧へ転送する。
ユーザーは、開発用データによる PC・モバイルの一覧表示、0件の表示、エラーから再試行での復旧と、`pnpm test`・`pnpm lint`・`pnpm typecheck`・`pnpm build` の成功を確認している。
PR 前にエージェントが format check、Storybook build、ブラウザ E2E 用 build、変更したタブ導線・設定更新・アーカイブ解除の Playwright 2件の成功を確認した。専用 DB・Supabase の実行前後のデータ件数は0件である。
その後、画面の利用範囲に合わせた配置整理は PR #39、共通の状態・優先度・権限定義の `features` 配下への移動は PR #40 で `develop` にマージ済みである。

### Task 詳細 API の区切り（2026-10-29）

`feat/phase-2/task-detail-api` では、`GET /api/projects/:projectId/tasks/:taskId` を実装済みである。
既存の Controller → Service → Repository → PrismaService の構成に追加し、DB 定義・migration の変更や DDD・クリーンアーキテクチャへの移行は行っていない。
本人の参加情報を確認した後、Task ID と Project ID の両方で1件を取得する。owner・member・viewer とアーカイブ状態の6通りで閲覧でき、Task 不在・所属違いは同じ404とする。

詳細の API E2E は15件を追加し、専用 DB・Supabase で一覧25件と合わせて40件の成功を確認した。認証・メール条件、Project 不在・非参加、参加情報削除後の拒否、返却する10項目と日付・日時、取得前後のデータ維持を確認している。
最終確認では既存を含む API E2E 全260件・4ファイル、API 単体テスト16件、API lint・typecheck・buildが成功した。実行前後の専用 DB の User・Project・ProjectMember・Task と専用 Supabase の Auth ユーザーはすべて0件で、確認後は専用環境を終了した。
ユーザーは Swagger で、参加 Project の実在する Task の200、Task 不在の404、Project 不在の404、token なしの401を手動確認し、問題がないことを報告した。
Web の変更はないため、この区切りでは Web テスト・Web build・Storybook build・Playwright は再実行していない。
API 契約と検証内容の詳細は [UI_API.md](./UI_API.md#タスク詳細-get-apiprojectsprojectidtaskstaskid) と [API README](../apps/api/README.md#task-詳細の-api-e2e) を参照する。

次は `/projects/[projectId]/tasks/[taskId]` の閲覧画面と一覧からのリンクを、別の小さな変更として進める。作成・更新・削除は、その後の操作として扱う。

## 例: プロジェクト作成 API

新しい CRUD 機能は、毎回次の小さな順番で進める。

1. Prisma schema に必要な Model を書き、migration を作る。
2. `CreateProjectDto` を作り、API が受け取る値と入力チェックを定義する。
3. `ProjectsRepository.create()` を作り、Prisma で保存する処理を書く。
4. `ProjectsService.create()` を作り、入力の確認や必要な業務ルールを記述する。
5. `ProjectsController.create()` を作り、DTO を受けて Service を呼ぶ。
6. REST API の結合テスト（Vitest + Supertest）で、成功・入力エラー・存在しないデータなどを確認する。

```text
POST /projects
  -> CreateProjectDto
  -> ProjectsController.create()
  -> ProjectsService.create()
  -> ProjectsRepository.create()
  -> PrismaService
  -> PostgreSQL
```

## 作成・取得・更新・削除で最初に確認すること

| 操作 | 最初に考えること |
| --- | --- |
| 作成 | 必須項目は何か、重複を許すか、誰が作成できるか |
| 一覧取得 | 誰が閲覧できるか、並び順、ページネーションは必要か |
| 1件取得 | 対象が存在するか、閲覧権限があるか |
| 更新 | 更新できる項目、更新権限、不正な状態変更がないか |
| 削除 | 削除権限、関連データをどう扱うか、物理削除か論理削除か |

## テストの最小方針

最初は「API が期待どおり使えるか」を確認する結合テストを優先する。

- `POST /projects` が正しい入力で `201` を返す。
- 必須の `name` がなければ `400` を返す。
- 存在しない ID の `GET /projects/:id` は `404` を返す。
- 権限がないユーザーの更新・削除は `403` を返す。

単体テストは、計算、状態遷移、権限判定など、独立していて間違いやすいルールに絞る。Repository の内部実装や、単に別の関数を呼ぶだけの Controller のためにテストを量産しない。

## フロントエンドの確認手順

フロントエンドの機能を追加するときは、次の順番を目安にする。

1. shadcn/ui を土台に必要な UI 部品を追加・調整する。
2. 複数画面で使う UI は Storybook の story を作り、通常・空・disabled・エラーなどの状態を確認する。
3. フォーム入力、ボタン操作、表示の切り替えは Vitest + React Testing Library で確認する。
4. API との接続を含む主要導線だけを Playwright で確認する。

例えば `CreateProjectForm` なら、入力欄やバリデーション表示は Vitest、フォーム部品の見た目の確認は Storybook、実際にプロジェクトが作成できることは Playwright で確認する。

## 実装時の進め方

- 1回に1 endpoint だけ作る。
- 各ファイルを作る前に、「このファイルの責務」を1文で説明する。
- 先に完成コードを大量に貼らず、実装後に `Controller -> Service -> Repository` の流れを追う。
- 分からない用語は、その場で止めて確認する。
- 動作確認は Swagger / OpenAPI または Bruno などを使い、実際に API を呼ぶ。

## 初期セットアップの確認順

実装を始める前に、次を順番に確認する。

1. Docker Compose で PostgreSQL を起動する。
2. Prisma migration を適用し、NestJS から DB へ接続できることを確認する。
3. Next.js と NestJS をローカルの開発サーバーとして起動する。
4. `lint`、`typecheck`、最小のテストが実行できることを確認する。
5. Husky と lint-staged を導入し、commit 前に変更ファイルのフォーマット・lint が確認されるようにする。

Husky はミスを早く見つける補助であり、CI やテストの代わりではない。hook が遅くなり過ぎないよう、全テストや build は PR 前・CI で実行する。

Docker Compose、volume、`localhost` と `db` の接続先の違い、Prisma migration の切り分けは [DOCKER_NOTES.md](./DOCKER_NOTES.md) を参照する。

## 今回はまだ導入しないもの

- 全 Repository の interface 化
- 1操作ごとの UseCase class
- Mapper の一律導入
- CQRS、Event Sourcing、Microservices
- 複雑な汎用 BaseRepository

これらは悪い設計ではないが、必要性が明確になった段階で導入した方が構成を保ちやすい。
