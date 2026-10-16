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
- 一覧は owner・member・viewer として参加している Project を作成日時の新しい順で返す。アーカイブ済みも含み、参加 Project がなければ `200` と空配列を返す
- 段階2から、更新・アーカイブ・解除は owner のみ許可する
- 存在しない Project と非参加者による詳細・更新・アーカイブ・解除は、同じ `404` 応答で扱い、Project の存在を知らせない
- 参加者の member・viewer による更新・アーカイブ・解除は `403` を返す

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

#### メンバー一覧: GET /api/projects/:projectId/members

指定した Project の owner に、owner 自身を含むメンバー一覧を返す。
認可には検証済み token で特定した User の ID と、対象 Project の ProjectMember の role を使う。
表示用の名前は認可判断に使わない。

成功時は `200` と次の形式の配列を返す。

```json
[
  {
    "id": "cmua3r1ik00032ed8lasbg1jj",
    "userId": "11111111-1111-4111-8111-111111111111",
    "role": "owner",
    "createdAt": "2026-10-11T10:00:00.000Z",
    "user": {
      "name": "中村",
      "email": "owner@example.test"
    }
  }
]
```

| 項目 | 意味 |
| --- | --- |
| `id` | ProjectMember の ID。role 変更 API と後続の削除 API の `memberId` に使う |
| `userId` | 参加している User の ID（UUID） |
| `role` | `owner`・`member`・`viewer` |
| `createdAt` | 参加日時（ProjectMember の作成日時）。ISO 8601 形式の文字列 |
| `user.name` | アプリ側 User に保存された表示名。未設定は `null` |
| `user.email` | アプリ側 User に保存されたメールアドレス |

並び順は次の優先順位とする。

1. role は `owner` → `member` → `viewer`。
2. 同じ role では、参加日時の古い順。
3. 参加日時も同じなら、ProjectMember の ID の昇順。

| 条件 | 応答 |
| --- | --- |
| 有効な token・確認済みメールアドレスを持つ owner | `200`・メンバー一覧 |
| token なし・形式不正・無効 | `401` |
| token は有効だがメールアドレスが未設定・未確認 | `403` |
| 参加者の role が member・viewer | `403` |
| 存在しない Project、または非参加者 | 同じ `404` 本文 |

存在しない Project と非参加者には、既存 Project API と同じ次の本文を返す。

```json
{
  "message": "プロジェクトが見つかりません",
  "error": "Not Found",
  "statusCode": 404
}
```

#### メンバー追加: POST /api/projects/:projectId/members

指定した Project の owner が、登録済みのアプリ側 User をメンバーとして追加する。
認可には AuthGuard が確認した実行者の User ID と、対象 Project の ProjectMember.role を使う。
追加対象は本文の email で検索し、取得した User.id を参加情報に保存する。

リクエスト本文:

```json
{
  "email": "member@example.test",
  "role": "member"
}
```

| 項目 | 入力ルール |
| --- | --- |
| `email` | 必須。メールアドレス形式を検証し、文字列の前後の空白を除く。大文字・小文字は変換せず、保存された User.email と完全一致で検索する |
| `role` | 必須。`member`・`viewer` のみ。`owner`・`manager`・その他の値は拒否する |

null・型が不正な値・定義外の項目も `400` で拒否する。本文に `userId`・`ownerId`・`projectId` は指定しない。
認証 → DTO 検証 → 実行者の membership・owner 確認 → アーカイブ確認 → 追加対象 User の取得・重複確認 → 保存時の Project 状態の再確認・メンバー追加の順で処理する。
本文が不正なら認証後に `400` を返す。追加対象 User の有無・参加状況は、実行者の認可後に判定する。

Supabase Auth の登録と、アプリ側 User の作成は別である。
アプリ側 User は、確認済みメールアドレスを持つ本人が、有効な token で AuthGuard を通る API を初めて呼んだときに作成される。
Supabase Auth だけに登録されているユーザーは追加できず、この追加 API で対象 User を作成・同期しない。

成功時は `201 Created` と、メンバー一覧の各要素と同じ形式の単一オブジェクトを返す。
role は指定した `member` または `viewer`、名前が未設定の場合は `null` とする。

```json
{
  "id": "cmua3r1ik00042ed8lasbg1jk",
  "userId": "22222222-2222-4222-8222-222222222222",
  "role": "member",
  "createdAt": "2026-10-13T01:00:00.000Z",
  "user": {
    "name": null,
    "email": "member@example.test"
  }
}
```

| 条件 | 応答 |
| --- | --- |
| 有効な token・確認済みメールを持つ owner が、未参加のアプリ側 User を非アーカイブ Project に追加 | `201`・追加したメンバー |
| token なし・形式不正・無効 | `401` |
| token は有効だがメールアドレスが未設定・未確認 | `403` |
| 本文の必須項目が未指定、形式・型・role が不正、または定義外の項目がある | `400` |
| 参加者の role が member・viewer | `403`・「プロジェクトに参加者を追加する権限がありません」 |
| 存在しない Project、または非参加者 | メンバー一覧と同じ `404` 本文・「プロジェクトが見つかりません」 |
| owner がアーカイブ済み Project に追加（事前確認後にアーカイブされた場合を含む） | `409`・「アーカイブ済みのプロジェクトにメンバーを追加できません」 |
| 追加対象のアプリ側 User が存在しない、またはメールの大文字・小文字が一致しない | `404`・「追加対象のユーザーが見つかりません」 |
| 追加対象が owner・member・viewer として既に参加している | `409`・「指定したユーザーはすでに参加しています」 |

上表の membership・業務ルールの応答は、DTO 検証を通過した本文に対するものである。
owner 自身の重複追加も `409` とし、既存の role を変更しない。
対象 User が別 Project に参加していても、追加先に未参加であれば追加できる。
同じ User を同じ Project に同時追加した場合も、複合 unique 制約で重複を防ぎ、保存時の該当する Prisma エラー `P2002` は `409` に変換する。

保存時は対象 Project の行をロックし、状態の再確認とメンバー保存を同じ transaction で行う。
アーカイブが先に保存された場合、追加は `409` となり、アーカイブ後の Project・ProjectMember の値と更新日時を変更しない。
追加が先に行ロックを取得した場合、アーカイブは追加の transaction が終わるまで待機し、メンバー保存後にアーカイブできる。
この場合、追加は `201`、アーカイブは `200` で成功する。DB の保存順を保証するものであり、HTTP レスポンスが届く順序は保証しない。
保存時に対象 Project が存在しなければ、既存と同じ `404` 本文を返す。

拒否された操作では Project・ProjectMember の値と更新日時を変更しない。
認証時に行う実行者の User プロフィール同期は、この不変性の対象に含めない。
メンバーの role 変更は次節を参照する。メンバー削除 API とメンバー管理 Web UI は後続で扱う。

#### メンバーの role 変更: PATCH /api/projects/:projectId/members/:memberId

対象 Project の owner が、指定した参加情報の role を `member`・`viewer` に変更する。
実行者は AuthGuard が検証した User ID と対象 Project の ProjectMember.role で認可し、`ownerId` や表示用の名前だけで許可しない。

| パラメーター | 意味 |
| --- | --- |
| `projectId` | 操作する Project の ID |
| `memberId` | 変更対象の ProjectMember.id。メンバー一覧の各要素の `id` を使う。User.id とは異なる |

対象の検索・更新は、`projectId` と ProjectMember の ID の両方で限定する。
別 Project の `memberId` と存在しない `memberId` は、同じ対象404本文で扱う。
実行者が両方の Project の owner でも、別 Project の参加情報は変更できない。

リクエスト本文:

```json
{
  "role": "viewer"
}
```

`role` は必須で、`member`・`viewer` のみを受け付ける。
`owner`・`manager`・未知の値・null・型が不正な値は `400` とする。
role の前後の空白や大文字・小文字は変換せず、`" member "` や `"MEMBER"` も拒否する。
空の本文と定義外の項目も `400` とし、本文に `userId`・`ownerId`・`projectId`・`memberId`・`email` は指定しない。

判定順は次のとおりとする。

1. AuthGuard による token・メールの確認と、実行者の User の同期。
2. DTO による本文の検証。
3. 実行者の対象 Project の membership・owner 権限の確認。
4. Project のアーカイブ状態の確認。
5. 対象の Project 所属・存在と、対象が owner ではないことの確認。
6. transaction 内で Project 行をロックし、Project の存在・アーカイブ状態、対象の所属・存在・owner 保護を同じ順で再確認する。
7. ロック後の最新の role と比較し、同じなら更新せず、異なれば保存する。

成功時は `200 OK` と、一覧の各要素と同じ形式の単一メンバーを返す。
同じ role の指定も同じ成功形式とし、`updatedAt` はレスポンスに含めない。

```json
{
  "id": "cmua3r1ik00042ed8lasbg1jk",
  "userId": "22222222-2222-4222-8222-222222222222",
  "role": "viewer",
  "createdAt": "2026-10-13T01:00:00.000Z",
  "user": {
    "name": null,
    "email": "member@example.test"
  }
}
```

| 条件 | 応答 |
| --- | --- |
| owner が非アーカイブ Project 内の member・viewer の role を指定 | `200`・処理後のメンバー。同じ role なら更新しない |
| token なし・形式不正・無効 | 既存 AuthGuard の `401` |
| token は有効だがメールアドレスが未設定・未確認 | `403`・「確認済みのメールアドレスが必要です。」 |
| role の未指定・値や型の不正、または定義外の項目 | `400`・既存 ValidationPipe のエラー本文。`message` は配列 |
| 実行者が member・viewer | `403`・「プロジェクトのメンバーの role を変更する権限がありません」 |
| Project が存在しない、または実行者が非参加者 | 既存と同じ `404` 本文・「プロジェクトが見つかりません」 |
| Project がアーカイブ済み（保存時の再確認を含む） | `409`・「アーカイブ済みのプロジェクトではメンバーの role を変更できません」 |
| 指定 Project 内に対象が存在しない、別 Project の memberId、または User.id の指定 | `404`・「変更対象のメンバーが見つかりません」 |
| 対象の role が owner | `409`・「owner の role は変更できません」 |

本文が不正な場合は、認証後に membership・業務ルールの確認より先に `400` を返す。
本文が有効なら、非参加者はアーカイブ状態や対象の有無によらず Project の404、member・viewer は403となる。
owner によるアーカイブ済み Project の操作は、対象の不存在・owner 保護より先にアーカイブの409を返す。
変更先に `owner` を指定した場合は DTO の400、対象が owner で変更先が `member`・`viewer` の場合は owner 保護の409となる。

業務エラーは既存と同じ `message`・`error`・`statusCode` の形式とする。対象404の本文例:

```json
{
  "message": "変更対象のメンバーが見つかりません",
  "error": "Not Found",
  "statusCode": 404
}
```

保存時は `SELECT … FOR UPDATE` で対象 Project 行をロックし、再確認から保存完了まで同じ transaction を使う。
アーカイブの UPDATE が自動取得する行ロックと待ち合わせるため、アーカイブ API に追加の明示ロックは不要である。
アーカイブが先に保存された場合は、同じ role の指定でも409で拒否する。
role 変更が先に Project 行をロックした場合は、その transaction が終わるまでアーカイブが待ち、role 変更200・アーカイブ200で成功できる。

同じ参加情報を同時に変更する場合は、Project 行ロックの取得順に処理する。
後の処理は最新の role を読み直し、指定と同じなら UPDATE しない。異なれば後の指定を保存する。
各成功応答はそれぞれの処理時点のメンバーを返し、後続処理で role が変わる場合がある。
DB の保存順を保証するものであり、HTTP レスポンスの到着順は保証しない。

実際の変更では、対象 ProjectMember の role と更新日時だけを更新する。
Project と他の参加情報、対象の ID・userId・projectId・createdAt は維持する。
拒否時と同じ role による変更不要時は、Project・ProjectMember の値・更新日時を変更しない。
認証時の User プロフィール同期は、この不変性の対象に含めない。
メンバー削除 API とメンバー管理 Web UI は後続で扱う。

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
