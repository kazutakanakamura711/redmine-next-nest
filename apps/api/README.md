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
pnpm --filter @redmine-next-nest/api test:e2e
```
