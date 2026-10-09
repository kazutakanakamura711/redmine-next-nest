# 画面と REST API の仕様

## この資料の使い方

画面と API は、最初から全て作らない。各段階で必要な route と endpoint だけを実装し、動作確認とテストを終えてから次へ進む。

## 画面の実装順

### 段階1: 最小の画面

| URL | 目的 |
| --- | --- |
| `/` | アプリの入口。ヘルスチェック結果または簡単な案内を表示する |
| `/projects` | プロジェクト一覧を表示する |
| `/projects/new` | プロジェクトを作成する |

### 段階2: 認証・メンバー

| URL | 目的 |
| --- | --- |
| `/login` | Supabase Auth でログインする |
| `/register` | ユーザー登録をする |
| `/confirm` | 確認メールの情報を検証し、確認後にアプリへ移動する Route Handler |
| `/projects/[projectId]/members` | メンバーの追加・閲覧・role変更をする |

登録画面は名前・メールアドレス・パスワード・確認用パスワードを受け付ける。
名前とメールアドレスは trim し、パスワードは8文字以上・確認用との一致を検証する。
Supabase へ送るのはメールアドレス・パスワードと、`user_metadata.name` に保存する名前である。
メール確認が必要な設定では、登録後に確認メールを開く案内を表示する。

`GET /confirm` は `token_hash` と `type=email` を受け取り、Supabase の `verifyOtp()` で検証する。
成功時はセッションを Cookie に保存して `/projects` へ `307` で移動する。
Supabase の検証エラー時は `/login?error=confirmation_failed` へ `307` で移動し、固定の案内を表示する。
確認情報がない場合や `type` が不正な場合は、Supabase を呼ばず `400` の JSON を返す。
移動先には `token_hash` や利用者指定のリダイレクト先を引き継がない。

未ログインで `/projects` またはその配下を開くと、Proxy が `/login` へ移動する。
ログイン画面自体はこのリダイレクトの対象にしない。
PC 幅ではサイドバー、`lg`（64rem / 通常1024px）未満では高さ48pxのヘッダーを表示する。
ヘッダーは左にハンバーガーメニュー、中央にロゴと `Redmine Nest`、右に名前の先頭文字のアイコンを置く。
右のアイコンには操作を持たせず、ハンバーガーメニューから Sheet を開く。
Sheet はプロジェクト一覧と各プロジェクトへのリンクを表示し、現在の項目を青色にする。
リンクを選ぶと遷移して Sheet を閉じる。リストはスクロール可能にし、ユーザーメニューを最下部に置く。
サイドバーと Sheet のユーザーメニューはログインユーザーの名前・メールアドレスを表示し、名前が `null` の場合は「ユーザー」と表示する。
ユーザーメニューのログアウトは現在のセッションを終了して `/login` へ移動する。
処理中は二重操作を防ぎ、失敗時はエラーと再試行できる状態を表示する。
Sheet を閉じてもログアウト処理中の状態とエラーを保持し、PC 幅へ切り替えると Sheet と小メニューを閉じる。

認証済みの Project 操作が使えるようになったら、Playwright でログインと Project の主要導線を確認し、既存の再利用 UI を Storybook に登録する。

### 段階3: タスク管理

| URL | 目的 |
| --- | --- |
| `/projects/[projectId]` | 既存の Project 詳細画面にタスク一覧を追加する |
| `/projects/[projectId]/tasks/new` | タスクを作成する |
| `/projects/[projectId]/tasks/[taskId]` | タスクを表示・編集する |

認証・権限を整えた Project に Task を追加し、Task の主要導線を Playwright に、再利用する Task UI を Storybook に追加する。

## 初期 UI のルール

- Next.js App Router と Tailwind CSS を使う。
- Button、Input、Select、Dialog、Table などは shadcn/ui を土台にする。
- `StatusBadge`、`PriorityBadge` のように、複数画面で使うアプリ固有の部品は `components/common` に置く。
- 再利用する UI 部品には Storybook の story を追加し、通常・長文・空・disabled などの状態を確認する。
- フォームには label と分かりやすいエラー表示を付ける。
- 削除・アーカイブ前には確認 Dialog を出す。
- 一覧には loading、empty、error の状態を用意する。
- desktop と mobile の両方を確認する。狭い画面では、表をカード表示に切り替えるか、重要な列だけを残す。

## API の共通ルール

- Base URL は `/api`、データ形式は JSON とする。
- 入力値は NestJS の DTO と `class-validator` で検証する。
- API は成功時に JSON を返し、失敗時は HTTP status code とエラー内容を返す。
- 段階2から、保護する API には `Authorization: Bearer <access token>` を付ける。
- API 側でも Project の閲覧・編集権限を確認する。
- DB のカラム名をそのまま画面の都合へ広げず、必要な形で response を返す。

エラー response の例:

```json
{
  "statusCode": 400,
  "message": "入力内容を確認してください",
  "errors": [
    {
      "field": "name",
      "message": "プロジェクト名は必須です"
    }
  ]
}
```

## 段階ごとの API

### 段階0: Health check

```text
GET /api/health
```

NestJS API が起動していることを確認するための endpoint である。

### 段階1: Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
POST   /api/projects/:projectId/archive
POST   /api/projects/:projectId/unarchive
```

`POST /api/projects` の入力例:

```json
{
  "name": "Task Management App",
  "key": "APP",
  "description": "タスク管理アプリ"
}
```

初期に扱うルール:

- `name` は前後の空白を除いた後、1〜100文字。保存時も前後の空白を除く
- `key` は英数字1〜20文字で、重複しない
- `description` は任意で2,000文字以内
- `POST /api/projects/:projectId/archive` は `isArchived` を `true` にする論理アーカイブ操作とする
- `POST /api/projects/:projectId/unarchive` は `isArchived` を `false` に戻す
- アーカイブ・解除の POST はリクエスト本文を持たず、成功時は更新後の Project を `200` で返す
- `DELETE /api/projects/:projectId` は将来の物理削除用とし、現時点では未実装
- 段階2から、作成は認証済みユーザーに限定し、作成者を owner にする
- 段階2から、一覧・詳細は ProjectMember に限定する
- 段階2から、更新・アーカイブ・解除は owner のみ許可する

### 段階2: Auth と Members

```text
GET    /api/auth/me
GET    /api/projects/:projectId/members
POST   /api/projects/:projectId/members
PATCH  /api/projects/:projectId/members/:memberId
DELETE /api/projects/:projectId/members/:memberId
```

- ログイン・登録そのものは Next.js から Supabase Auth を呼ぶ。
- NestJS は access token を検証し、アプリ側の User を取得または初回作成する。
- 共通 AuthGuard で User のメールアドレスと `user_metadata.name` の名前を同期する。名前は trim し、未設定・空白・文字列以外なら `null` にする。既存の名前も更新する。
- member の追加・削除・role変更は owner のみ許可する。owner 自身の削除・role変更は許可しない。

### 段階3: Tasks

```text
GET    /api/projects/:projectId/tasks
POST   /api/projects/:projectId/tasks
GET    /api/projects/:projectId/tasks/:taskId
PATCH  /api/projects/:projectId/tasks/:taskId
DELETE /api/projects/:projectId/tasks/:taskId
```

`POST /api/projects/:projectId/tasks` の入力例:

```json
{
  "title": "ログイン画面を作る",
  "description": "メールアドレスとパスワードを入力できる画面を作成する",
  "status": "todo",
  "priority": "normal",
  "startDate": "2026-09-20",
  "dueDate": "2026-09-25"
}
```

初期に扱うルール:

- `title` は1〜200文字
- `status` は `todo`、`in_progress`、`done`
- `priority` は `low`、`normal`、`high`
- `dueDate` は `startDate` より前にできない
- URL の `projectId` と Task の所属 Project が一致しない場合は取得・更新・削除できない
- ProjectMember でなければ取得できない。owner・member は作成・更新でき、削除は owner のみ、viewer は閲覧だけできる
- アーカイブ済み Project には Task を作成・更新できない

担当者指定、絞り込み、ページネーション、親子タスクは基本 CRUD の後に追加する。

## 後続段階の API

基本機能が完成した後に、必要性を確認して追加する。

```text
GET/POST/PATCH/DELETE /api/projects/:projectId/tasks/:taskId/comments
GET                    /api/projects/:projectId/tasks/:taskId/history
```

Task の filter、ページネーション、Task number、親子タスク、履歴の自動作成もこの段階で扱う。
