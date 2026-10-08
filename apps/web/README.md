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

`/login` でメールアドレス・パスワードによるログインを行い、NestJS の `/api/auth/me` で本人取得が成功するとプロジェクト一覧へ移動します。
Project の一覧・詳細はサーバー用クライアント、作成・更新・アーカイブ・解除はブラウザ用クライアントからセッションを取得し、全 6 API に Bearer token を付けます。
`getSession()` は token を取り出すために使い、本人確認には `getClaims()` / `getUser()` を使います。
NestJS 側でも受け取った Bearer token を検証します。

`/register` で名前・メールアドレス・パスワードを登録します。確認用パスワードは画面内で一致を検証し、Supabase には送りません。
名前は Supabase Auth の `user_metadata.name` に保存し、アプリ側 User の `name` への反映は後続作業です。
確認メールのリンクは `/confirm?token_hash=...&type=email` です。
`src/app/(auth)/confirm/route.ts` が `verifyOtp()` で検証し、サーバー用 SDK がセッションを Cookie に保存して `/projects` へリダイレクトします。
検証エラーでは `/login?error=confirmation_failed` へ移動し、ログイン画面に固定の案内を表示します。
確認情報の不足や `type` の不正は、Supabase を呼ばず `400` を返します。

未ログイン時のリダイレクト、ログアウト、サイドバーのログインユーザー表示は後続作業です。
処理順と図は [ログインの学習メモ](../../docs/WEB_AUTH_LOGIN_FLOW.md) と
[登録・メール確認の学習メモ](../../docs/WEB_AUTH_REGISTRATION_FLOW.md) に記録しています。

### ローカルの確認メール

`supabase/config.toml` の `[auth.email].enable_confirmations` は `true` にしています。
`[auth.email.template.confirmation]` で `supabase/templates/confirmation.html` を指定し、
`SiteURL` と `TokenHash` を Supabase が埋め込んだメールを送ります。
設定を変更したときは、リポジトリのルートでローカル Supabase を再起動します。

```bash
pnpm exec supabase stop
pnpm exec supabase start
```

確認メールは [Mailpit](http://localhost:54324) で確認します。実在するメールアドレスは不要です。
[Supabase Studio](http://localhost:54323) の Authentication / Users では、ユーザーの確認済み状態を確認できます。
設定変更は新しく送るメールに反映されるため、未登録の検証用メールアドレスで登録から確認します。
クラウド環境では Supabase Dashboard の Email Templates と URL Configuration を別途設定します。

SDK の使い方は [Supabase SSR ガイド](https://supabase.com/docs/guides/auth/server-side/creating-a-client) を参照してください。

## 確認コマンド

```bash
pnpm --filter @redmine-next-nest/web typecheck
pnpm --filter @redmine-next-nest/web lint
pnpm --filter @redmine-next-nest/web test
```
