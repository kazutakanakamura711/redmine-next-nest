# Bruno でのローカル認証確認

Bruno で [redmine-next-nest-api](./redmine-next-nest-api/) をコレクションとして開きます。
リクエストは OpenCollection の YAML 形式で保存しています。

| リクエスト                                                                       | 呼び出す API                                        | 用途                                       |
| -------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| [supabase-login](./redmine-next-nest-api/supabase-login.yml)                     | Supabase: `POST /auth/v1/token?grant_type=password` | ログインして access token を取得           |
| [auth-me](./redmine-next-nest-api/auth-me.yml)                                   | NestJS: `GET /api/auth/me`                          | 本人のアプリ側 User を取得・初回作成       |
| [create-project](./redmine-next-nest-api/create-project.yml)                     | NestJS: `POST /api/projects`                        | Project と作成者の owner membership を作成 |
| [get-projects](./redmine-next-nest-api/get-projects.yml)                         | NestJS: `GET /api/projects`                         | Project 一覧を取得                         |
| [get-project](./redmine-next-nest-api/get-project.yml)                           | NestJS: `GET /api/projects/:projectId`              | Project 詳細を取得                         |
| [update-project](./redmine-next-nest-api/update-project.yml)                     | NestJS: `PATCH /api/projects/:projectId`            | Project 名・説明を更新                     |
| [archive-project](./redmine-next-nest-api/archive-project.yml)                   | NestJS: `POST /api/projects/:projectId/archive`     | Project をアーカイブ                       |
| [unarchive-project](./redmine-next-nest-api/unarchive-project.yml)               | NestJS: `POST /api/projects/:projectId/unarchive`   | Project のアーカイブを解除                 |
| [supabase-update-password](./redmine-next-nest-api/supabase-update-password.yml) | Supabase: `PUT /auth/v1/user`                       | ログインユーザーのパスワードを変更         |

NestJS は `http://localhost:3001`、ローカル Supabase は `http://127.0.0.1:54321` で動きます。
Supabase のリクエストは外部サービスの操作なので、NestJS の Swagger には含めません。

## 1. ローカル環境とテストユーザーを用意する

Docker network、アプリ用 DB、API の起動方法は [API README](../apps/api/README.md#開発) を参照してください。
以下のコマンドはリポジトリのルートで実行します。

```bash
pnpm exec supabase start --network-id redmine-local-network
pnpm exec supabase status
```

ローカルの [Supabase Studio](http://127.0.0.1:54323/project/default/auth/users) で、
**Authentication → Users → Add user → Create new user** を開きます。
メールアドレス（例: `bruno@example.com`）とテスト用のパスワードを入力し、
**Auto confirm user** にチェックを入れて作成します。

このユーザーは手動確認用です。Supabase のクラウド管理画面にログインするアカウントとは別です。
API E2E は実行ごとに一時ユーザーを作成・削除するため、この固定ユーザーを使いません。

## 2. Bruno の Local 環境を設定する

**Environments → Local** を開き、次の変数を有効にして Save します。
Local がない場合は、コレクションの環境として作成してください。
Mac では `Command + E` で環境の編集画面を開けます。

| タブ      | 変数名                   | 設定する値                                      |
| --------- | ------------------------ | ----------------------------------------------- |
| Variables | `supabasePublishableKey` | ローカルの `.env` の `SUPABASE_PUBLISHABLE_KEY` |
| Variables | `loginEmail`             | Studio に登録したテストユーザーのメールアドレス |
| Secrets   | `loginPassword`          | 同じユーザーのパスワード                        |
| Secrets   | `accessToken`            | 最初は空欄。ログイン後に設定                    |

右上の環境選択で **Local** を選びます。
`{{loginEmail}}` などの記述は、送信時に Local の変数の値に置き換わります。
Publishable key を送る HTTP ヘッダーの名前は `apikey` です。
`SUPABASE_SECRET_KEY` はこの手動操作では使いません。

パスワードと token の値は Secrets に保存し、リクエストの Body や通常の Variables に直接書きません。
Bruno の Secrets の実際の値は、環境の YAML ファイルには保存されません。
ローカル用のキーを含む `environments/Local.yml` も Git の対象から外しています。
別の PC では、この手順に従って Local 環境を作成してください。

## 3. ログインして token を保存する

`supabase-login` の設定は次のとおりです。

- メソッド・URL: `POST http://127.0.0.1:54321/auth/v1/token?grant_type=password`
- Auth: **No Auth**
- Headers: `apikey: {{supabasePublishableKey}}`、`Content-Type: application/json`
- Body: JSON

```json
{
  "email": "{{loginEmail}}",
  "password": "{{loginPassword}}"
}
```

1. **Send** を押し、`200 OK` を確認します。
2. レスポンスの `access_token` の値だけをコピーします。引用符や `Bearer` は含めません。
3. **Environments → Local → Secrets → accessToken** に貼り付けて **Save** します。

この HTTP レスポンスでは `access_token` は最上位にあります。
SDK の `signInWithPassword()` では `session.access_token` として取得します。

## 4. 本人の User と Project API を確認する

`auth-me` の Auth は **Bearer Token**、Token は `{{accessToken}}` に設定済みです。
Send すると、Bruno が `Authorization: Bearer <access_token>` を付けて送信します。

| 応答               | 意味                                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| `200 OK`           | 本人のアプリ側 User（`id`、`email`、`name`、`createdAt`、`updatedAt`）を返す |
| `401 Unauthorized` | token がない、Bearer 形式が不正、または token が無効                         |
| `403 Forbidden`    | token は有効だがメールアドレスが未設定・未確認                               |

`id` と `email` が Supabase のログインユーザーと一致することを確認します。
未登録なら User を初回作成し、登録済みならメールアドレスと `user_metadata.name` の名前を更新します。
名前は前後の空白を除き、未設定・空白・文字列以外の場合は `null` にします。
既存の名前も同期するため、Supabase の名前が空白になるとアプリ側も `null` になります。

続けて `create-project` を Send すると、`201 Created` と `ownerId` が返ります。
Body の `key` は未使用の値にしてください。作成者の ProjectMember も `role: owner` で保存されます。

Project の全 6 リクエストにも **Bearer Token** の `{{accessToken}}` を設定しています。
`get-projects` は `200 OK` と Project の配列を返します。
詳細・更新・アーカイブ・解除の URL にある Project ID は、作成した Project の `id` に置き換えてください。
これらの成功時の応答は `200 OK` と、対象の Project（`ownerId` を含む）です。

現在は本人確認まで実装しています。参加者だけの閲覧や owner だけの更新・アーカイブ・解除は
後続の実装対象です。認証の仕様と確認範囲は [API README](../apps/api/README.md#project-api-の認証と-owner-登録) を参照してください。

## 5. パスワードを変更する

`supabase-update-password` は **Bearer Token** の `{{accessToken}}` を使い、
`PUT http://127.0.0.1:54321/auth/v1/user` に次の JSON を送ります。
Headers は `apikey: {{supabasePublishableKey}}` と `Content-Type: application/json` です。

```json
{
  "password": "{{loginPassword}}"
}
```

1. 現在のパスワードで `supabase-login` を Send し、有効な token を Secrets の `accessToken` に保存します。
2. Secrets の `loginPassword` を新しいパスワードに変更して **Save** します。
3. `supabase-update-password` を **Send** し、`200 OK` を確認します。
4. `supabase-login` を再度 **Send** し、新しいパスワードで `200 OK` になることを確認します。
5. 新しく取得した `access_token` を Secrets の `accessToken` に保存します。

Bruno の `loginPassword` を変えるだけでは、Supabase 側のパスワードは変わりません。
手順3の更新が成功してから、新しいパスワードでログインできます。

## エラー時の確認

| エラー                                         | 確認する内容                                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| ログインの `400 invalid_credentials`           | Local が選択されているか、メールアドレスの綴り、保存したパスワードが Supabase 側と一致するか                            |
| `auth-me`・Project API・パスワード変更の `401` | 有効な access token を Secrets に保存したか。期限切れなら `supabase-login` を再送信し、新しい `access_token` を保存する |
| `auth-me`・Project API の `403`                | テストユーザーのメールアドレスが確認済みか                                                                              |
| Project API の `404`                           | URL の Project ID を、存在する Project の `id` に置き換えたか                                                           |
| Project 作成の `409`                           | Body の `key` が既存 Project と重複していないか                                                                         |

操作後は `pnpm exec supabase stop` で Supabase を停止できます。通常の停止ではローカルデータを保持します。

## Swagger と公式資料

NestJS の Swagger は [http://localhost:3001/api/docs](http://localhost:3001/api/docs) です。
**Authorize** に access token の値だけを入力すると、`GET /api/auth/me` と全 Project API を実行できます。
Project のレスポンスには、作成者の UUID を示す `ownerId` も記載しています。

- [Supabase Auth の API 仕様](https://github.com/supabase/auth#endpoints)
- [Supabase のローカル開発](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Bruno の環境変数](https://docs.usebruno.com/variables/environment-variables)
- [Bruno の Secret Variables](https://docs.usebruno.com/secrets-management/secret-variables)
