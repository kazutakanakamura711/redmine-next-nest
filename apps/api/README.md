# API

NestJS による REST API です。

## 開発

リポジトリのルートで、PostgreSQL を起動してから API を起動します。

```bash
docker compose up db -d
pnpm dev:api
```

起動確認には `GET http://localhost:3001/api/health` を使用します。

## Supabase Auth

本番とは分けた開発用 Supabase プロジェクトを用意し、その URL と publishable key をルートの `.env` に
`SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY` として設定します。API は
`GET /api/auth/me` の Bearer token を Supabase Auth の `/auth/v1/user` に渡し、
本人と確認済みメールアドレスを検証してからアプリ側の `users` に登録します。
テストユーザーは開発用 Supabase Auth に確認済みメールアドレスで作成し、
パスワードや access token を Git に保存しません。ローカルでの実接続確認には
そのユーザーで取得した access token を使います。

```bash
curl -H 'Authorization: Bearer <access-token>' http://localhost:3001/api/auth/me
```

API E2E は外部の Supabase プロジェクトに接続せず、テスト内のループバック
HTTP サーバーが `/auth/v1/user` を再現します。ユーザー ID はテストごとに生成し、
テスト専用 DB から終了時に削除します。CI に Supabase の秘密情報は不要です。
実サービスとの疎通は、開発用 Supabase プロジェクトを設定した後に別途確認します。
Project API の認証・権限は後続の PR で追加します。

## 確認コマンド

```bash
pnpm --filter @redmine-next-nest/api typecheck
pnpm --filter @redmine-next-nest/api lint
```

API E2E では開発用 DB を使用しません。ルートの `.env` に `.env.example` の
`TEST_DATABASE_URL` と `POSTGRES_TEST_*` を設定し、専用 DB を起動します。

```bash
docker compose --profile test up -d db-test
docker compose --profile test ps db-test
pnpm test:e2e
```

`pnpm test:e2e` はテスト用 URL を検証し、専用 DB に migration を適用してから
Supertest を実行します。`TEST_DATABASE_URL` が未設定、開発用 DB と同じ、または
DB 名が `_test` で終わらない場合は DB 操作前に停止します。
