# API rules

- `Controller -> Service -> Repository -> PrismaService` の責務を守る。
- Controller は DTO の受け取り、Service 呼び出し、HTTP response に集中する。
- Service は認可、入力に依存しない業務ルール、複数 Repository をまたぐ処理を扱う。
- Repository は Prisma query と DB の読み書きを扱う。初期は interface と実装を二重に作らない。
- DTO は `class-validator` で API 入力を検証する。Frontend の validation を信頼しない。
- 認証導入後は、すべての保護された操作で token、Project membership、role、対象 resource の Project 所属を Backend 側で検証する。
- 複数の DB 更新を成功・失敗ともに揃える必要がある場合は Prisma transaction を使う。
- Controller や Repository の単純な委譲を過剰に単体テストせず、API の結合テストを優先する。
