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

### 段階2: タスク管理

| URL | 目的 |
| --- | --- |
| `/projects/[projectId]` | Project の基本情報とタスク一覧を表示する |
| `/projects/[projectId]/tasks/new` | タスクを作成する |
| `/projects/[projectId]/tasks/[taskId]` | タスクを表示・編集する |

### 段階3: 認証・メンバー

| URL | 目的 |
| --- | --- |
| `/login` | Supabase Auth でログインする |
| `/register` | ユーザー登録をする |
| `/projects/[projectId]/members` | メンバーの追加・閲覧・role変更をする |

ログイン画面を先に作ること自体は問題ない。ただし、認証・Cookie・token 検証が重なるため、CRUD とは別の小さな機能として扱う。

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
- 認証導入後、保護する API には `Authorization: Bearer <access token>` を付ける。
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
- 認証導入後は、一覧・詳細を ProjectMember に限定し、作成者を owner にする

### 段階2: Tasks

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

担当者指定、絞り込み、ページネーション、親子タスクは基本 CRUD の後に追加する。

### 段階3: Auth と Members

```text
GET    /api/auth/me
GET    /api/projects/:projectId/members
POST   /api/projects/:projectId/members
PATCH  /api/projects/:projectId/members/:memberId
DELETE /api/projects/:projectId/members/:memberId
```

- ログイン・登録そのものは Next.js から Supabase Auth を呼ぶ。
- NestJS は access token を検証し、アプリ側の User を取得または初回作成する。
- member の追加・削除・role変更は owner のみ許可する。

## 後続段階の API

基本機能が完成した後に、必要性を確認して追加する。

```text
GET/POST/PATCH/DELETE /api/projects/:projectId/tasks/:taskId/comments
GET                    /api/projects/:projectId/tasks/:taskId/history
```

Task の filter、ページネーション、Task number、親子タスク、履歴の自動作成もこの段階で扱う。
