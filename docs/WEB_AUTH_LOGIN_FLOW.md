# ログイン・ユーザー表示・ログアウトの流れ

2026-10-09 時点の実装をもとにした学習メモ。
ログインはブラウザで行い、プロジェクト一覧の取得は Next.js サーバーで行う。
登録・メール確認後に自動ログインする流れは [登録・メール確認の学習メモ](./WEB_AUTH_REGISTRATION_FLOW.md) を参照する。

## 全体の図

```mermaid
sequenceDiagram
    participant B as ブラウザ
    participant S as Supabase Auth
    participant N as Next.js サーバー
    participant A as NestJS API

    B->>S: メール・パスワードでログイン
    S-->>B: セッションと access_token
    Note over B: SDK がセッションを Cookie に保存
    B->>A: GET /api/auth/me ＋ Bearer token
    Note over A: token を検証して本人を確認
    A-->>B: アプリ側のユーザー情報
    B->>N: /projects へ移動 ＋ Cookie
    Note over N: Proxy → セッション取得
    par プロジェクト一覧
        N->>A: GET /api/projects ＋ Bearer token
        Note over A: 再び token を検証して一覧を取得
        A-->>N: プロジェクト一覧の JSON
    and ナビゲーションのユーザー情報
        N->>A: GET /api/auth/me ＋ Bearer token
        A-->>N: アプリ側のユーザー情報
    end
    Note over N: 共通の親から Sidebar と Header に同じ表示用 props を渡す
    N-->>B: 一覧とナビゲーションの描画情報
```

## コードに沿った処理順

1. **ブラウザで Supabase にログインする**

   [login-form.tsx](<../apps/web/src/app/(auth)/login/_components/login-form.tsx>) の
   `signInWithPassword(values)` がメール・パスワードを Supabase Auth に送る。
   成功するとセッションが返り、ブラウザ用 SDK が Cookie に保存する。
   このクライアントは [lib/supabase/client.ts](../apps/web/src/lib/supabase/client.ts) の
   `createBrowserClient()` で作っている。

2. **ブラウザから NestJS で本人を確認する**

   `data.session.access_token` を取り出し、
   [get-current-user.ts](<../apps/web/src/lib/auth/get-current-user.ts>) の
   `getCurrentUser(accessToken)` を呼ぶ。
   この関数が Bearer ヘッダーを付けて `GET /api/auth/me` にアクセスする。

   NestJS の [AuthGuard](../apps/api/src/modules/auth/auth.guard.ts) は
   [AuthService](../apps/api/src/modules/auth/auth.service.ts) を通して Supabase Auth に token を検証してもらい、
   メールアドレスが確認済みであることを確認する。
   アプリ側の User を取得し、未登録なら初回作成して、ユーザー情報を返す。
   作成・更新時にメールアドレスと `user_metadata.name` を同期する。
   名前は文字列なら trim し、未設定・空白・文字列以外なら `null` にする。名前は認可判断に使わない。

   フォーム側では `await getCurrentUser(accessToken)` で成功を待つ。
   失敗すると `catch` でエラーを表示し、画面遷移を止める。
   ログインフォームでは取得成功を確認する目的なので、返り値を変数に保存せず `await` している。
   サイドバーと狭い画面のヘッダーの表示用データは、遷移後に Next.js サーバーで取得する。

3. **プロジェクト一覧へ移動する**

   `router.replace('/projects')` で、現在のログイン画面の履歴を置き換えて移動する。
   `router.refresh()` で、サーバー側の画面情報を取得し直す。
   ブラウザから Next.js へのリクエストには、保存された Cookie が送られる。

4. **画面処理の前に Proxy が動く**

   `/projects` は `matcher` の対象なので、Next.js にリクエストが届くと、
   特殊ファイルの [src/proxy.ts](../apps/web/src/proxy.ts) が先に実行される。
   そこから [lib/supabase/proxy.ts](../apps/web/src/lib/supabase/proxy.ts) の `updateSession()` を呼ぶ。

   `getClaims()` で token を確認し、必要ならセッションを更新する。
   更新した Cookie は、後続の Server Component が読むリクエストと、
   ブラウザへ返すレスポンスの両方に反映する。
   未ログインの場合は `/login` へ移動し、認証済みの場合は `page.tsx`・`layout.tsx` の処理に進む。

5. **Next.js サーバーが一覧 API を呼ぶ**

   [get-projects.ts](<../apps/web/src/app/(app)/projects/_lib/get-projects.ts>) は、
   [lib/supabase/server.ts](../apps/web/src/lib/supabase/server.ts) の `createClient()` を呼ぶ。
   この関数は Next.js の `cookies()` を使ってリクエストの Cookie を参照し、
   SDK の `createServerClient()` でサーバー用クライアントを作る。

   `getSession()` でセッションを取得し、`data.session.access_token` を取り出す。
   その token を Bearer ヘッダーに付けて、NestJS の `GET /api/projects` を呼ぶ。

   ```tsx
   const accessToken = data.session.access_token;

   const response = await fetch(`${apiBaseUrl}/projects`, {
     headers: {
       Authorization: `Bearer ${accessToken}`,
     },
     cache: 'no-store',
   });
   ```

   `getSession()` の用途はセッションと token の取得である。
   API の本人確認は、リクエストで受け取った token を NestJS が検証して行う。
   `NEXT_PUBLIC_API_BASE_URL` は通常 `http://localhost:3001/api` なので、
   `fetch()` では `/projects` を追加すると `/api/projects` になる。

6. **NestJS が認証し、一覧を返す**

   `/api/auth/me` が成功した後でも、Project API のリクエストには token が必要である。
   `AuthGuard` は、このリクエストの token も検証する。
   成功すると、次の流れで PostgreSQL のプロジェクトを取得する。

   ```text
   ProjectsController → ProjectsService → ProjectsRepository → PrismaService → PostgreSQL
   ```

   NestJS は、取得したプロジェクト一覧を JSON で Next.js サーバーに返す。

7. **取得したデータを画面に表示する**

   一覧の [page.tsx](<../apps/web/src/app/(app)/projects/(list)/page.tsx>) は Server Component であり、
   `await getProjects()` で受け取ったプロジェクトを `ProjectsTable` に渡す。
   Next.js が画面の描画情報をブラウザに返し、一覧が表示される。

   [layout.tsx](<../apps/web/src/app/(app)/layout.tsx>) 内の `ProjectsNavigationContainer` も、
   同じ `getProjects()` を使ってナビゲーション用の一覧を取得する。
   Cookie のセッションから token を取得し、共通の `getCurrentUser(accessToken)` で本人情報も取得する。
   ナビゲーション用の一覧と本人情報は `Promise.all()` で並行して取得する。
   取得処理は共通の親にまとめ、同じ `navigationProps` を `ProjectsSidebar` と `AppHeader` に渡す。
   各コンポーネントから `UserMenu` に名前とメールを渡し、名前が `null` なら「ユーザー」と表示する。
   サーバー側で取得した token 自体は、表示用の Client Component に渡さない。

## 画面幅に応じたナビゲーション

`ProjectsNavigationContainer` は `Suspense` の内側でデータを取得する。
取得中は `ProjectsSidebarFallback` と `ProjectsAppHeaderFallback` を両方描画し、通常表示と同じ領域を確保する。
どちらを見せるかは Tailwind CSS のクラスで切り替える。

| 画面幅 | 表示するもの | fallback のクラス |
| --- | --- | --- |
| `lg`（64rem / 通常1024px）以上 | サイドバー | `hidden lg:block` |
| `lg` 未満 | 高さ48pxのヘッダー | `grid lg:hidden` |

[AppHeader](<../apps/web/src/app/(app)/_components/app-header.tsx>) の左ボタンから Sheet を開くと、
プロジェクトのリンクと最下部の `UserMenu` を表示する。右のユーザーアイコンは名前の先頭文字を表示し、操作は持たない。
現在の項目は `usePathname()` で判定して青色にし、リンクを選ぶと Sheet を閉じる。
リストだけをスクロール可能にして、ユーザーメニューがリストの長さで押し出されないようにする。

## 未ログイン時の移動

Proxy は `/projects` と `/projects/` で始まるパスで、検証済みの claims があるか確認する。
セッションがない、token が無効などの理由で確認できない場合は、同じサイトの `/login` へ `307` で移動する。
ログイン画面自体をこのリダイレクトの対象にしないため、移動を繰り返さない。
移動先に元のクエリや外部 URL を引き継がず、SDK の更新 Cookie とキャッシュ制御ヘッダーを応答に付ける。
未ログインのリダイレクトには `Cache-Control: private, no-store` を指定する。

## ログアウトの流れ

```mermaid
sequenceDiagram
    participant B as ブラウザ
    participant S as Supabase Auth
    participant N as Next.js サーバー

    Note over B: UserMenu からログアウトを選ぶ
    B->>S: signOut（scope: local）
    alt 成功
        S-->>B: 現在のセッションを終了
        Note over B: SDK が Cookie を更新
        B->>N: /login へ移動し、画面情報を更新
        N-->>B: ログイン画面
        B->>N: /projects を直接開く（セッションなし）
        N-->>B: Proxy が 307 /login を返す
    else 失敗
        S-->>B: エラー
        Note over B: エラー表示と再試行できる状態を表示
    end
```

[UserMenu](<../apps/web/src/app/(app)/_components/user-menu.tsx>) は名前・メールを props で受け取り、メニューを表示する。
[LogoutButton](<../apps/web/src/app/(app)/_components/logout-button.tsx>) がログアウト処理と処理中の状態・エラー表示を持つ。
`signOut({ scope: 'local' })` で現在のセッションを終了し、Cookie の更新はブラウザ用 SDK に任せる。
成功すると `router.replace('/login')` と `router.refresh()` で移動・画面情報の更新を行う。
処理中は二重操作を防ぎ、失敗時は固定のエラーを表示して再試行できる状態に戻す。
メニューを閉じて再び開いても、処理中の状態とエラーを保持する。
狭い画面では Sheet の最下部から同じ `UserMenu` と `LogoutButton` を使う。
Sheet の `keepMounted` でログアウト処理中の状態を保持し、Sheet を閉じる時や PC 幅への切り替え時は小メニューも閉じる。

## 通信ごとに渡す認証情報

| 通信                                 | 渡す情報                               |
| ------------------------------------ | -------------------------------------- |
| ブラウザ → Supabase Auth（ログイン） | メールアドレス・パスワード             |
| ブラウザ → NestJS（本人取得）        | `Authorization: Bearer <access_token>` |
| ブラウザ → Next.js（画面取得）       | Cookie                                 |
| Next.js → NestJS（一覧取得）         | `Authorization: Bearer <access_token>` |
| Next.js → NestJS（ナビゲーションの本人取得） | `Authorization: Bearer <access_token>` |

ブラウザ → Next.js の Cookie により、サーバー側でも同じログインセッションを参照できる。
NestJS API に送る際は、そのセッションの access token を取り出して Bearer ヘッダーに付ける。

## 確認結果と後続作業

- AppHeader 12件・サイドバー7件・ログアウト7件の計26件が通過した。Sheet の開閉・キーボード操作・フォーカス復帰・PC 幅への切り替え、選択表示、ログアウト処理中の状態保持を確認した。
- 対象コードの lint・format、Web typecheck が通過した。共通の Server Component にまとめた後の `layout.tsx` も確認した。
- ユーザーが `pnpm --filter @redmine-next-nest/web test` を実行し、Web 全体のテストが通過したことを確認した。
- ユーザーによるブラウザ確認で、PC とスマホ幅の本人表示・プロジェクト表示、選択時の遷移と Sheet の閉鎖、スマホ側からのログアウト、ログアウト後に `/projects` を直接開いた時の `/login` への移動を確認した。
- 上記のブラウザ確認は手動であり、ブラウザ全体の自動テストは Playwright 導入時に追加する。

このメモの対象は、ログイン・本人取得・プロジェクト一覧取得・PC と狭い画面のナビゲーション・未ログインとログアウトの導線である。
membership・role による認可は後続 PR で扱う。
後続作業は [QUALITY_SECURITY_FOLLOW_UP_TASKS.md のタスク5](./QUALITY_SECURITY_FOLLOW_UP_TASKS.md#5-supabase-auth-と-project-権限を実装する) を参照する。

## 図の表示方法

図は Markdown 内の `mermaid` コードブロックとして保存しているため、テキストで編集できる。
GitHub の Markdown 表示や Mermaid 対応のプレビューでは、図として表示できる。
対応していないビューアーでも、図の元になるコードは残る。
GitHub での表示方法は [GitHub 公式ドキュメント](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams) を参照する。
