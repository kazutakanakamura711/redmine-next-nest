# API

NestJS による REST API です。

## 開発

リポジトリのルートで、PostgreSQL を起動してから API を起動します。

```bash
docker compose up db -d
pnpm dev:api
```

起動確認には `GET http://localhost:3001/api/health` を使用します。

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
