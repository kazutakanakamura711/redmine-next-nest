# Web

Next.js App Router によるフロントエンドです。

## 開発

Next.js は `apps/web` の `.env*` を読みます。初回は、リポジトリのルートで次を実行し、
`apps/web/.env.local` にローカルの設定を記入します。既存の `.env.local` がある場合は上書きせず、
不足する変数だけを追加してください。

```bash
cp apps/web/.env.example apps/web/.env.local
```

| 環境変数                               | 設定する値                                                                |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`             | NestJS の API URL。通常は `http://localhost:3001/api`                     |
| `NEXT_PUBLIC_SUPABASE_URL`             | API と同じ Supabase の Project URL。ローカルでは `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | API と同じ Supabase の Publishable key                                    |

ローカル Supabase の準備とキーの確認方法は [API README](../api/README.md#ローカル-supabase-auth) を参照してください。
`NEXT_PUBLIC_*` はブラウザにも渡るため、Secret key を設定しないでください。
実際のキーを含む `.env.local` は Git 管理外です。設定変更後は Web の開発サーバーを再起動します。

リポジトリのルートで次を実行します。

```bash
pnpm dev:web
```

ブラウザで `http://localhost:3000` を開きます。

## Web の認証基盤

`@supabase/supabase-js` と `@supabase/ssr` を使い、セッションを Cookie に保存します。

| ファイル                     | 役割                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/lib/supabase/client.ts` | Client Component で使うブラウザ用クライアント                                                   |
| `src/lib/supabase/server.ts` | Server Component / Server Action / Route Handler で、そのリクエストの Cookie を使うクライアント |
| `src/lib/supabase/proxy.ts`  | セッションを確認・更新し、更新後の Cookie を後続の画面処理とブラウザの両方へ渡す                |
| `src/proxy.ts`               | Next.js がページ表示前に呼ぶ入口。画像・静的ファイルは対象外                                    |

Server Component はレスポンスの Cookie を書けないため、手前の Proxy で更新します。
SDK が更新時に渡すキャッシュ制御ヘッダーもレスポンスへ反映します。
サーバー用クライアントはリクエストごとに作り、ユーザー間でセッションを共有しません。

この段階では接続とセッション更新の土台までです。ログイン・登録画面、API への Bearer token 付与、
未ログイン時のリダイレクト、ログアウトは後続の段階で追加します。
`getSession()` は token を取り出すために使い、本人確認には `getClaims()` / `getUser()` を使います。
NestJS 側でも受け取った Bearer token を検証します。

SDK の使い方は [Supabase SSR ガイド](https://supabase.com/docs/guides/auth/server-side/creating-a-client) を参照してください。

## 確認コマンド

```bash
pnpm --filter @redmine-next-nest/web typecheck
pnpm --filter @redmine-next-nest/web lint
pnpm --filter @redmine-next-nest/web test
```
