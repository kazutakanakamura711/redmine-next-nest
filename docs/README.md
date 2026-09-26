# Redmine Next Nest

## このプロジェクトの目的

Redmine / Jira のように、プロジェクトごとにタスクを管理できる Web アプリケーションを作る。

このプロジェクトでは、機能を増やすことよりも、責務が明確で保守しやすい構成を優先する。

特に次を段階的に実装する。

- REST API と Controller の役割
- Service に処理の流れを書く方法
- Repository を通じて DB 操作を分ける理由
- DTO による入力チェック
- 認証・認可、テスト、DB migration の基本

## 今回の設計方針

採用するのは、**機能単位のレイヤードアーキテクチャ**である。

```text
Controller -> Service -> Repository -> Prisma -> PostgreSQL
```

各機能を `projects`、`tasks`、`members` のように分け、その中で Controller / Service / Repository の役割を分ける。

最初から Clean Architecture や DDD の全てのパターンは導入しない。複雑な業務ルールが実際に現れた場合にだけ、Entity、UseCase、interface による抽象化を追加する。

詳しくは次の資料を参照する。

- [REQUIREMENTS.md](./REQUIREMENTS.md): プロダクトの目的、MVP範囲、到達点
- [ARCHITECTURE.md](./ARCHITECTURE.md): フロントエンド・バックエンドの責務分担
- [DOMAIN_MODEL.md](./DOMAIN_MODEL.md): データの意味と業務ルール
- [ER.md](./ER.md): 完成形のデータ関係
- [UI_API.md](./UI_API.md): 画面と REST API の段階的な仕様
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md): 1機能を実装・確認する順番
- [PULL_REQUEST_GUIDE.md](./PULL_REQUEST_GUIDE.md): Pull Request の作成・確認手順
- [QUALITY_SECURITY_FOLLOW_UP_TASKS.md](./QUALITY_SECURITY_FOLLOW_UP_TASKS.md): 品質・セキュリティの改善タスクと引き継ぎ情報
- [DOCKER_NOTES.md](./DOCKER_NOTES.md): Docker Compose、PostgreSQL、Prisma で詰まりやすい点

## 想定スタック

- Frontend: Next.js / TypeScript
- UI: Tailwind CSS / shadcn/ui
- Backend: NestJS / TypeScript
- API: REST / JSON
- Database: PostgreSQL
- ORM: Prisma
- Authentication: Supabase Auth（導入時に設定方法を確認する）
- Frontend test: Vitest / React Testing Library
- Backend test: Vitest / Supertest
- E2E test: Playwright
- UI catalog: Storybook

具体的な構成や依存関係は、初期化時に必要最小限から確定する。

## UI・テストの使い分け

| 道具 | 目的 |
| --- | --- |
| shadcn/ui | Button、Dialog、Form、Table などの再利用可能な UI 部品の土台に使う。コピーしてプロジェクト側で調整できる。 |
| Storybook | Button や StatusBadge など、画面から切り離して確認したい UI 部品のカタログに使う。 |
| Vitest + React Testing Library | コンポーネントの表示、入力、クリック、エラー表示などをブラウザを起動せずに確認する。 |
| Vitest + Supertest | NestJS API の入力チェック、認可、HTTP response を確認する。 |
| Playwright | ログインからプロジェクト作成、タスク作成までのような、ブラウザ全体を通す重要な操作を確認する。 |

テストを目的なく増やさない。小さな UI の見た目確認は Storybook、UI と API の操作は Vitest、ユーザーの主要導線は Playwright と役割を分ける。

## 最初の MVP

1. ヘルスチェック API
2. プロジェクトの作成・一覧・詳細・更新・削除
3. プロジェクトに属するタスクの CRUD
4. ログインと、プロジェクト単位の閲覧・編集権限

コメント、変更履歴、親子タスク、通知などは、基本 CRUD を理解・完成させた後に追加する。
