# データモデルと業務ルール

## この資料の目的

この資料は「アプリが守るべきデータの意味とルール」を書く場所である。NestJS のファイル構成や、Entity / UseCase などの実装方法はここでは決めない。

完成形のテーブル関係は [ER.md](./ER.md) を参照する。ただし、初期実装では全テーブル・全ルールを一度に作らない。

## 段階的な実装範囲

| 段階 | 対象 | この段階で理解したいこと |
| --- | --- | --- |
| 1 | Health check | NestJS の Controller / Service の基本 |
| 2 | Project | DTO、Service、Repository、Prisma による基本 CRUD |
| 3 | User / ProjectMember | Supabase Auth と「誰が操作できるか」の確認 |
| 4 | Task | Project に属するデータの CRUD と入力ルール |
| 5以降 | Comment、TaskHistory、親子タスク、検索・絞り込み | 複数のデータをまたぐルールとトランザクション |

## 初期の主要データ

### User

認証を導入した後に使うアプリ側プロフィールである。パスワードは保存しない。

| 項目 | 説明 |
| --- | --- |
| id | Supabase Auth のユーザー ID と同じ ID |
| email | Supabase Auth で確認済みのメールアドレス |
| name | 画面に表示する名前 |

### Project

タスクをまとめる単位である。

| 項目 | 説明 | 初期ルール |
| --- | --- | --- |
| id | プロジェクト ID | 自動採番する |
| name | プロジェクト名 | 前後の空白を除いた後、1〜100文字、必須 |
| key | タスク番号の接頭辞 | 英数字1〜20文字、重複不可、大文字で保存 |
| description | 概要 | 任意、2,000文字以内 |
| isArchived | アーカイブ状態 | 初期値は `false` |
| ownerId | 作成者 | 認証導入後は必須 |

例: `key` が `APP` のプロジェクトでは、将来タスクを `APP-1` のように表示する。

### ProjectMember

認証・メンバー管理を導入した後に、ユーザーがどのプロジェクトへ参加しているかを表す。

初期は次の三つの role だけを扱う。

| role | できること |
| --- | --- |
| owner | プロジェクトの作成者。設定・メンバー管理を含めすべて操作できる |
| member | プロジェクトとタスクを閲覧し、タスクを作成・更新できる |
| viewer | 閲覧だけできる |

- プロジェクト作成時に、作成者を `owner` とする ProjectMember も同時に作る。
- 同じユーザーを同じプロジェクトへ二重登録しない。
- owner 自身を削除・role変更しない。
- `manager` role は、owner と member の間の権限が本当に必要になったとき追加する。

### Task

Project に属する作業項目である。初期は、タスクを分かりやすく管理する最低限の項目だけを扱う。

| 項目 | 説明 | 初期ルール |
| --- | --- | --- |
| id | タスク ID | 自動採番する |
| projectId | 所属プロジェクト | 必須 |
| title | タスク名 | 1〜200文字、必須 |
| description | 詳細 | 任意、5,000文字以内 |
| status | 進行状態 | 初期値は `todo` |
| priority | 優先度 | 初期値は `normal` |
| startDate | 開始日 | 任意 |
| dueDate | 期限 | 任意。開始日より前にできない |
| assigneeId | 担当者 | 任意。設定時は ProjectMember であること |

初期の status と priority は次に限定する。

```text
status:   todo | in_progress | done
priority: low  | normal      | high
```

- タスクは必ず1つの Project に所属する。
- アーカイブ済み Project にはタスクを作成・更新できない。
- 閲覧権限がないユーザーは、Project や Task を取得できない。
- `done` にした日時や、Project 内連番は、基本 CRUD を完成させた後に追加する。

## 認証・認可の基本方針

- 認証は Supabase Auth を使う。
- Frontend が表示を隠すだけでは不十分である。NestJS API でも、ログイン済みか・対象 Project の member かを確認する。
- クライアントから渡された `userId` をそのまま信用しない。認証済み token からユーザーを特定する。

認証機能をまだ実装していない間は、ローカル開発用の固定ユーザーを一時的に使って CRUD の流れを学んでもよい。ただし、本番公開前に必ず Supabase Auth に置き換える。

## 後続段階で追加するもの

以下は ER 図には含めるが、初期 CRUD を理解してから追加する。

- Task の Project 内連番（`APP-1` など）と競合しない採番
- `in_review`、`closed` など、より細かい status
- `completedAt`、予定工数
- 親子タスクと循環参照の防止
- Comment と論理削除
- TaskHistory と変更差分の記録
- manager role、詳細な権限表
- フィルタ、ページネーション、全文検索

複数のテーブルを同時に更新する必要が生じた時点で、Prisma の transaction を使う。例えば Project と owner membership を同時に作る処理が対象になる。
