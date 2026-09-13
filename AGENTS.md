# AGENTS.md

## 目的

Redmine Next Nest は、少人数向けのプロジェクト・タスク管理アプリケーションである。複雑な抽象化より、各ファイルの責務が明確で読みやすい構成を優先する。

正式な仕様は `docs/REQUIREMENTS.md` を入口とし、データルールは `docs/DOMAIN_MODEL.md`、画面・APIは `docs/UI_API.md`、構成は `docs/ARCHITECTURE.md` を参照する。

## 構成方針

Backend は機能単位のレイヤード構成とする。

```text
Controller -> Service -> Repository -> PrismaService -> PostgreSQL
```

- Controller は HTTP、DTO、response を扱い、Prisma query や複雑な業務判断を書かない。
- Service は機能の処理順・認可・業務ルールを扱い、HTTP の Request / Response を受け取らない。
- Repository は Prisma を使った DB 操作を扱い、HTTP の知識を持たない。
- 初期は Repository interface、UseCase class、Mapper、汎用 BaseRepository を機械的に増やさない。明確な必要性が出た場合だけ提案する。
- API では認証済みユーザー、Project membership、role を必ず検証する。UI の表示制御だけを信頼しない。

Frontend は Next.js App Router を使う。`page.tsx` と `layout.tsx` は Server Component を基本とし、操作が必要な末端だけを Client Component にする。shadcn/ui を土台にし、再利用する UI は Storybook で確認する。

## 実装・検証

- 1回の変更は、原則として 1 endpoint または 1 UI 操作に絞る。
- DB変更は Prisma migration に残し、`.env` を commit しない。
- Frontend の操作は Vitest + React Testing Library、Backend API は Vitest + Supertest、主要導線は Playwright で確認する。
- PostgreSQL は Docker Compose で起動する。初期は Next.js / NestJS をローカル開発サーバーとして起動する。
- `pre-commit` は Husky + lint-staged でフォーマット・lint を確認する。全テスト・typecheck・build は PR 前または CI で実行する。
- 変更前に関連 docs を読み、変更後は対象に見合う最小の lint、typecheck、テストを実行する。

## 変更管理

- ユーザーの変更を保持し、無関係なリファクタリングや依存追加をしない。
- 仕様と実装が矛盾する場合は、推測で実装せず差分を示す。
- 大きな設計変更、認証、権限、migration、外部サービス連携は、影響と確認方法を先に明確にする。

## エージェント運用

- 通常は親エージェントが計画・実装・統合を行う。小さな変更を不要に分割しない。
- 子エージェントを使う場合は、対象・受け入れ条件・編集範囲・必要な docs・確認コマンドを絞る。
- Frontend、Backend、テストなど、同じファイルを編集しない独立作業だけを分ける。
- 子の完了報告は、変更ファイル、判断、検証、残るリスクを短くまとめる。

### 推奨モデル

| 役割 | model / effort | 主な用途 |
| --- | --- | --- |
| Parent / integration | GPT-5.6 Sol / high | 計画、仕様判断、統合、最終確認 |
| Frontend / Backend | GPT-5.6 Terra / high | Next.js、NestJS、Prisma の実装 |
| Unit / component test | GPT-5.6 Luna / high | Vitest の局所テスト |
| Integration / E2E | GPT-5.6 Terra / high | Supertest、PostgreSQL、Playwright |
| Architecture review | GPT-5.6 Sol / high | 設計・認可・migration の確認 |

### GPT-6 Astra の利用条件

まず GPT-5.6 Sol / high で、論点を限定して調査・review・障害解析する。Astra は、Sol でも安全な結論が出ない場合に限る。

- 対象は、未解決の認可・セキュリティ・transaction・migration・複数層にまたがる再現困難な障害である。
- routine CRUD、UI調整、通常のコードレビューには使わない。
- Astra へ渡す時は Sol の調査結果、実施済み検証、未解決の質問だけを共有する。
- 利用可能か確認できない場合は残量を推測しない。使えなければ Sol で継続する。
