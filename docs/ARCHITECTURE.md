# バックエンド構成

## フロントエンド構成

Next.js App Router を使い、画面固有のコードと複数画面で使う UI を分ける。

```text
src/
├── app/                         # route、page、layout
│   └── projects/
│       └── page.tsx
├── components/
│   ├── ui/                      # shadcn/ui を土台にした汎用 UI
│   └── common/                  # StatusBadge など複数画面で使う部品
├── features/                    # projects、tasks など業務機能ごとの UI・API 呼び出し
└── lib/                         # API client、認証、共通関数
```

- `components/ui` は shadcn/ui の部品を配置・調整する場所にする。
- `components/common` には、アプリ固有だが複数画面で使う小さな UI を置く。
- `features` には、プロジェクト作成フォームやタスク一覧など業務機能ごとのコードを置く。
- 画面専用の小さな部品は、その route 配下の `_components` に置いてよい。
- UI 部品は必要に応じて Storybook の story を追加し、画面を開かなくても状態を確認できるようにする。

## テスト構成

| 対象 | 主な道具 | 例 |
| --- | --- | --- |
| UI コンポーネント | Vitest + React Testing Library | フォームの入力エラー、ボタン押下、空状態 |
| UI の見た目・状態カタログ | Storybook | StatusBadge の各 status、Button の disabled 状態 |
| NestJS API | Vitest + Supertest | `POST /projects` の成功、400、403、404 |
| ブラウザ全体の導線 | Playwright | ログイン → プロジェクト作成 → タスク作成 |

Storybook は自動テストの代わりではない。UI を目で確認・共有するカタログとして使い、操作や仕様の確認は Vitest / Playwright で行う。

## 採用する構成

NestJS の Module を機能ごとに分け、その機能内でレイヤード構成にする。

```text
HTTP request
  -> Controller
  -> Service
  -> Repository
  -> PrismaService
  -> PostgreSQL
```

```text
src/
├── common/
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   └── auth/                       # 認証導入後に追加する
└── modules/
    ├── projects/
    │   ├── dto/
    │   │   ├── create-project.dto.ts
    │   │   └── update-project.dto.ts
    │   ├── projects.controller.ts
    │   ├── projects.service.ts
    │   ├── projects.repository.ts
    │   └── projects.module.ts
    └── tasks/
        ├── dto/
        ├── tasks.controller.ts
        ├── tasks.service.ts
        ├── tasks.repository.ts
        └── tasks.module.ts
```

## それぞれの責務

| 層 | 役割 | 例 |
| --- | --- | --- |
| Controller | HTTP の受付と応答を担当する。入力 DTO を受け、Service を呼ぶ。 | `POST /projects` を受ける |
| Service | 機能の処理の流れと業務ルールを担当する。 | プロジェクト名を確認して保存を依頼する |
| Repository | DB 操作をまとめる。Prisma の query をここに置く。 | `findById()`、`create()` |
| PrismaService | Prisma Client を NestJS から使うための共通窓口。 | `prisma.project.findMany()` |
| DTO | API で受け取る入力の形とバリデーションを定義する。 | `name` は必須文字列 |

## Repository を採用する理由

Repository は「Service が DB の細かな書き方を知らずに、データを取得・保存するための窓口」である。

```ts
// Service: 何をしたいかを書く
return this.projectsRepository.findById(id);

// Repository: Prisma を使って、どう取得するかを書く
return this.prisma.project.findUnique({ where: { id } });
```

Repository を通じて Service とデータアクセスの責務を分離する。ただし、**Repository の interface と実装クラスを二重に作ることは初期段階ではしない**。最初は `projects.repository.ts` の1ファイルで十分である。

DB を Firestore へ交換する、複数の保存先を切り替える、複雑な単体テストで差し替えが必要になる、といった明確な理由が出たときに interface を追加する。

## 守るルール

- Controller に Prisma の query や複雑な業務判断を書かない。
- Service に HTTP の `Request` / `Response` を渡さない。
- Repository は HTTP の知識を持たない。
- DTO は API 入力用であり、DB の型をそのまま公開するものではない。
- `projects` と `tasks` にまたがる処理でも、まず Service で読みやすく書く。抽象化は重複や複雑さが実際に出てから行う。
- 1つの Service が大きくなったら、最初に private method で整理する。無条件に UseCase class を増やさない。

## 将来の発展順

1. Controller / Service / Repository を自分で実装・説明できるようにする。
2. 認可やトランザクションなど、複数の処理をまたぐルールを Service に書く。
3. 状態遷移などの強いルールが増えた箇所だけ Entity や Value Object を導入する。
4. 外部 API や保存先を差し替える必要が出たとき、Repository interface と依存性注入を導入する。
5. これらの必要性を説明できるようになった後、Clean Architecture を採用する。

この順番なら、Linkat のような `Controller -> UseCase -> Repository` の構成へ進む際にも、なぜ層が必要なのかを理解した上で移行できる。
