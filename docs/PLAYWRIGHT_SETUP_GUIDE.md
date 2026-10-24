**Redmine Next Nest：PlaywrightでログインとProject操作を確認する手順**

対象：/Users/kazutakanakamura/dev/personal/products/redmine-next-nest。コマンドは、指定がなければプロジェクトのルートで実行します。

既存の e2e/start.mjs・migrate.mjs・stop.mjs と getBrowserE2EAppEnvironments() を使います。最初は「環境準備 → ビルド → テスト → 環境終了」を別々に実行し、各段階を確認します。Web/APIの起動と終了はPlaywrightのwebServerへ任せます。[Playwright公式](https://playwright.dev/docs/test-webserver)

既存の pnpm test:e2e は Vitest + Supertest のAPI結合テストとして維持します。ブラウザには新しく pnpm test:browser を用意します。

**1. PlaywrightとChromiumを追加する**

```bash
pnpm add -Dw @playwright/test
pnpm exec playwright install chromium
pnpm exec playwright --version
```

- `-D`：開発用の依存へ追加します。
- `-w`：pnpmワークスペースのルートへ追加します。
- Chromium：Playwrightが操作する専用ブラウザです。今回はChromiumだけを使います。

インストール時のダウンロードが完了し、最後のコマンドでPlaywrightのバージョンが表示されれば、この段階は完了です。[インストール](https://playwright.dev/docs/intro)、[ブラウザの追加](https://playwright.dev/docs/browsers#install-browsers)

**2. 専用Web/APIのビルド・起動方法を整える**

通常の開発サーバーとビルド成果物が混ざらないよう、出力先とTypeScriptのキャッシュを分けます。

| 対象        | 通常           | ブラウザE2E        |
| ----------- | -------------- | ------------------ |
| Webの出力先 | apps/web/.next | apps/web/.next-e2e |
| APIの出力先 | apps/api/dist  | apps/api/dist-e2e  |
| Webのポート | 3000           | 3100               |
| APIのポート | 3001           | 3101               |

**2-A. e2e/environment.mjsにWeb用の目印を追加する**

getBrowserE2EAppEnvironments() の戻り値にある `web` オブジェクトの先頭へ、`REDMINE_BROWSER_E2E: '1',` を追加してください。既存のPORT・NEXT_PUBLIC_*の設定は保持します。この値をWebのビルドと起動の両方へ渡します。

**2-B. apps/web/next.config.tsを設定する**

役割：ブラウザE2Eのときに、専用の出力先とTypeScript設定へ切り替えます。現在のnext.config.tsは空の設定なので、次の内容にできます。

```ts
import type { NextConfig } from 'next';

const isBrowserE2E = process.env.REDMINE_BROWSER_E2E === '1';

const nextConfig: NextConfig = {
  distDir: isBrowserE2E ? '.next-e2e' : '.next',
  typescript: {
    tsconfigPath: isBrowserE2E ? 'tsconfig.browser-e2e.json' : 'tsconfig.json',
  },
};

export default nextConfig;
```

REDMINE_BROWSER_E2Eが1のときは.next-e2eを使い、それ以外は通常の.nextを使います。distDirとtsconfigPathは、インストール済みNext.jsの同梱ドキュメントで確認しています。[distDir](/Users/kazutakanakamura/dev/personal/products/redmine-next-nest/apps/web/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/distDir.md)、[typescript](/Users/kazutakanakamura/dev/personal/products/redmine-next-nest/apps/web/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/typescript.md)

**2-C. apps/web/tsconfig.browser-e2e.jsonを作成する**

役割：既存のWebの型設定を引き継ぎ、E2E用の生成型とキャッシュを扱います。通常の.nextにある生成物を対象から外します。

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "tsBuildInfoFile": ".next-e2e/cache/tsconfig.tsbuildinfo"
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    "**/*.mts",
    ".next-e2e/types/**/*.ts",
    ".next-e2e/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules", ".next"]
}
```

**2-D. apps/api/tsconfig.browser-e2e.jsonを作成する**

役割：既存のAPIビルド設定を引き継ぎ、出力とキャッシュをdist-e2eへ分けます。

```json
{
  "extends": "./tsconfig.build.json",
  "compilerOptions": {
    "outDir": "./dist-e2e",
    "tsBuildInfoFile": "./dist-e2e/tsconfig.tsbuildinfo"
  }
}
```

apps/api/tsconfig.jsonには、compilerOptionsと同じ階層に次のexcludeを追加してください。既存のcompilerOptionsは保持します。これは通常のtypecheckへE2E用の生成ファイルが混ざるのを防ぐためです。

```text
"exclude": ["node_modules", "dist", "dist-e2e"]
```

**2-E. e2e/build.mjsを作成する**

役割：専用の接続設定を渡し、Prisma Client・API・Webをビルドします。Nest CLIの--pathは、使用するtsconfigを指定するオプションです。

```js
import { spawnSync } from 'node:child_process';
import { rootDirectory, getBrowserE2EAppEnvironments } from './environment.mjs';

const { api, web } = getBrowserE2EAppEnvironments();

function run(args, environment) {
  const result = spawnSync('pnpm', args, {
    cwd: rootDirectory,
    env: { ...process.env, ...environment },
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.signal || result.status !== 0) {
    throw new Error('ブラウザE2E用のビルドに失敗しました。');
  }
}

// APIが使うPrisma Clientを生成する
run(
  [
    '--filter',
    '@redmine-next-nest/api',
    'exec',
    'prisma',
    'generate',
    '--config',
    'prisma7.config.ts',
  ],
  api,
);

// 通常のdistとは別の場所へAPIをビルドする
run(
  [
    '--filter',
    '@redmine-next-nest/api',
    'exec',
    'nest',
    'build',
    '--path',
    'tsconfig.browser-e2e.json',
  ],
  api,
);

// 公開用の環境変数を渡してWebをビルドする
run(['--filter', '@redmine-next-nest/web', 'build'], web);

console.log('ブラウザE2E用のビルドが完了しました。');
```

WebのNEXT_PUBLIC_*はビルド時にブラウザ用コードへ埋め込まれるため、buildにも専用環境の値を渡します。起動時だけ設定する方法では、既にビルドされた公開値を切り替えられません。[Next.js同梱ドキュメント](/Users/kazutakanakamura/dev/personal/products/redmine-next-nest/apps/web/node_modules/next/dist/docs/01-app/02-guides/environment-variables.md)

**2-F. 生成物を除外する**

ルートの.gitignoreに次の2行を追加します。playwright-report/とtest-results/は既に設定されています。

```text
apps/web/.next-e2e/
apps/api/dist-e2e/
```

ルートの.prettierignoreにも次の4行を追加します。生成物とレポートをフォーマット対象から外します。

```text
apps/web/.next-e2e/
apps/api/dist-e2e/
playwright-report/
test-results/
```

**3. ログイン画面のブラウザテストを1件作る**

**3-A. ルートにplaywright.config.mjsを作成する**

役割：対象ブラウザ、接続先、レポート、Web/APIの起動と終了を設定します。

```js
import { defineConfig, devices } from '@playwright/test';
import { browserE2E, rootDirectory } from './e2e/environment.mjs';

export default defineConfig({
  testDir: './e2e/tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: browserE2E.webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      name: 'API',
      command: 'node e2e/serve.mjs api',
      cwd: rootDirectory,
      url: `${browserE2E.apiUrl}/api/health`,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      name: 'Web',
      command: 'node e2e/serve.mjs web',
      cwd: rootDirectory,
      url: `${browserE2E.webUrl}/login`,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
```

- APIは3101番の/api/health、Webは3100番の/loginが応答するまで待ちます。
- `reuseExistingServer: false`で、別の起動済みサーバーを再利用しないようにします。
- `e2e/serve.mjs` は引数の `api` / `web` に応じて対象を選び、起動時に `getBrowserE2EAppEnvironments()` で環境変数を取得して渡します。WebのPORTは3100です。
- 設定の読み込み時にはSupabase CLIを実行しません。Dockerや専用Supabaseが停止していても、VS Codeのテスト一覧や `pnpm test:browser --list` を表示できます。実際のテスト実行とビルドには専用環境が必要です。
- テスト後は起動したWeb/APIへSIGTERMを送り、5秒以内に終了しなければPlaywrightが強制終了します。
- 実行結果はHTMLレポートに記録し、失敗した場合はtraceとスクリーンショットを残します。

Web/APIのプロセス管理はPlaywrightの標準機能を使っています。[webServer公式ドキュメント](https://playwright.dev/docs/test-webserver)

**3-B. e2e/tests/login.spec.tsを作成する**

役割：実ブラウザで/loginを開き、見出し・入力欄・ログインボタンが表示されることを確認します。現在の画面のh1とlabelに合わせています。

```ts
import { expect, test } from '@playwright/test';

test('ログイン画面が表示される', async ({ page }) => {
  await page.goto('/login');

  await expect(
    page.getByRole('heading', { name: 'ログイン', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/^メールアドレス\s*\*?$/)).toBeVisible();
  await expect(page.getByLabel(/^パスワード\s*\*?$/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'ログイン', exact: true }),
  ).toBeVisible();
});
```

getByRoleは見出しやボタンなどの役割、getByLabelは入力欄のラベルを使って対象を探します。見出しとログインボタンにはexact: trueを指定して完全一致で探します。入力欄のlabelにはaria-hiddenを付けた必須記号の `*` があり、getByLabelではこの記号もラベル文字列に含まれます。そのため、入力欄は末尾の空白と任意の `*` を許容する正規表現で探します。末尾を `$` で限定し、「パスワードを表示する」ボタンは候補に含めません。

**3-C. ルートのpackage.jsonに実行コマンドを追加する**

scriptsに次の2つの定義を用意します。同じキーがすでにある場合は、その定義を更新してください。既存のtest:e2eはAPI結合テストとして保持します。

```text
"test:browser:prepare": "node e2e/start.mjs && node e2e/migrate.mjs && node e2e/build.mjs",
"test:browser": "playwright test --config playwright.config.mjs"
```

`test:browser:prepare` は起動・migration・ビルドを順に実行します。`&&` は直前のコマンドが成功した場合にだけ次へ進む指定です。

**3-D. 整形と構文を確認する**

```bash
pnpm exec prettier --write \
  package.json playwright.config.mjs \
  e2e/environment.mjs e2e/build.mjs e2e/serve.mjs e2e/tests/login.spec.ts \
  apps/web/next.config.ts apps/web/tsconfig.browser-e2e.json \
  apps/api/tsconfig.json apps/api/tsconfig.browser-e2e.json

node --check e2e/build.mjs
node --check e2e/serve.mjs
node --check playwright.config.mjs
```

**3-E. 環境準備・ビルド・テストを順番に実行する**

Docker Desktopを起動した状態で、1つずつ実行し、その都度結果を確認します。

```bash
node e2e/start.mjs
node e2e/migrate.mjs
node e2e/build.mjs
pnpm test:browser
```

起動・migration・ビルドの3つをまとめて実行する場合は、次のコマンドを使えます。Docker Desktopはあらかじめ起動してください。

```bash
pnpm test:browser:prepare
pnpm test:browser
```

最後に `1 passed` と表示されれば、最小のブラウザE2Eが成功です。テスト後、PlaywrightがWeb/APIを停止します。DBとSupabaseは次のコマンドで終了します。途中で失敗した場合も、この終了コマンドを実行してください。

```bash
node e2e/stop.mjs
```

テスト時にブラウザのウィンドウを見たい場合は、準備・ビルドが済んだ起動中の専用環境で `pnpm test:browser --headed` を使えます。終了後は同じstop.mjsでDB・Supabaseを終了します。

**3-F. レポートと今回の変更を確認する**

```bash
pnpm exec playwright show-report
```

このコマンドは保存されたHTMLレポートを開きます。失敗時はレポートからtraceやスクリーンショットを確認できます。[HTMLレポート](https://playwright.dev/docs/test-reporters#html-reporter)

最小テストが通ったら、変更したNext設定のESLintと、Web/APIのtypecheckを確認します。

```bash
pnpm --filter @redmine-next-nest/web exec eslint next.config.ts
pnpm typecheck
git diff --check
git status --short
```

docs/QUALITY_SECURITY_FOLLOW_UP_TASKS.mdのタスク6には、確認できた実装と実行結果を記録します。以下の実ログインまで追加しても、Project操作・メール確認・CIを引き続き段階的に追加するため、タスク6全体は「着手」として扱います。

**ガイド作成時の確認範囲**

既存の実装、Next.jsの同梱ドキュメント、インストール済みNest CLIのヘルプ、Playwright公式ドキュメントに合わせています。コード例は構文・設定の継承・出力先の分離を静的に確認し、ビルドコマンドの順序と失敗時の中断、Playwright設定の値をモックで確認しました。依存のインストール、実ビルド、実ブラウザでの成功は、このガイドに沿ってこれから確認する段階です。

**2026-10-22の実行確認**

ユーザーから専用DBへのmigrationと専用ビルドの成功報告を受け、エージェントでもWeb/APIの専用出力先を確認しました。ログイン画面のテストは、label内の必須記号に対応し、修正前の確認処理を除去した後、エージェントによる `pnpm test:browser` で `1 passed` を確認しました。今回の確認対象はログイン画面の表示です。実ログイン・Project操作・メール確認・CIは、この後に段階的に追加します。

**4. 一時ユーザーで実ログインし、再読み込み後も表示を確認する**

2026-10-23に、この段階を実装しました。テストでは既存のログインフォームへメール・パスワードを入力し、実際のSupabase AuthとNestJS APIを使います。認証やAPI応答のモック、保存済みのログインセッションは使いません。

- `e2e/fixtures/test-user.ts`：テスト用ユーザーの準備と後片付けを担当します。Playwrightのfixtureは、テストが必要とする準備と終了処理をまとめる仕組みです。`testUser` を要求したテストだけでユーザーを作り、`await use(...)` の間にテスト本体を実行し、終了後は `finally` で片付けます。[Playwrightのfixture](https://playwright.dev/docs/test-fixtures)
- `e2e/tests/login.spec.ts`：ログイン画面の表示に加え、実ログイン、Project一覧への遷移、再読み込みの前後の本人情報を確認します。`test` と `expect` は上記fixtureからimportします。
- `e2e/environment.mjs`：専用SupabaseのURLを検証して管理キーを取得します。管理キーはfixtureのNode.js内だけで使い、Web/APIの環境変数には含めません。起動スクリプトも管理キーを含む標準出力をログへ表示しません。
- `e2e/package.json`：TypeScriptのテストとfixtureをES Modulesとして扱います。既存APIの生成済みPrisma Clientとモジュール形式を合わせるための設定です。
- `e2e/tsconfig.json`：ブラウザテスト専用の型チェック設定です。Playwrightの実行では型チェックされないため、`pnpm typecheck:browser` を別に実行します。[PlaywrightのTypeScript](https://playwright.dev/docs/test-typescript)
- `apps/web/eslint.config.mjs`：専用ビルドの生成物 `.next-e2e/**` をlint対象から除外します。通常の `.next/**` と同じ扱いです。

ルートの開発依存には、既存APIと同じバージョンのSupabase SDKとPrismaのPostgreSQLアダプターを追加しています。SDKはAuthユーザーの作成・削除、Prismaはアプリ側Userの後片付けに使います。TypeScriptとNode.jsの型定義も既存APIと同じ解決済みバージョンを使います。Prisma Clientは `test:browser:prepare` のビルド段階で生成されます。

今回のユーザーはテストごとに異なる `browser-e2e-<UUID>@example.test` とランダムなパスワードを持ちます。管理APIの `email_confirm: true` でメール確認済みとして作成し、メール確認の導線は別のテストで扱います。[Supabaseの管理API](https://supabase.com/docs/reference/javascript/auth-admin-createuser)

アプリ側のUserは、ログイン処理の認証API呼び出しで作成されます。テストの成功・失敗にかかわらず、fixtureはブラウザのcontextを閉じ、今回記録したIDを条件にアプリ側のデータとSupabase Authユーザーを削除します。Userがまだ作成されていない場合も片付けられるよう、アプリ側では `deleteMany` を使います。全件削除や既存ユーザーの再利用は行いません。現在は、次節のProject作成テストに合わせ、Projectと参加情報の削除も追加しています。

**実行方法**

Docker Desktopを起動した状態で、次を順に実行します。ブラウザを表示する場合はテストコマンドに `--headed`、Inspectorで1操作ずつ確認する場合は `--debug` を付けます。

```bash
pnpm test:browser:prepare
pnpm typecheck:browser
pnpm test:browser
node e2e/stop.mjs
```

Project作成テストまで追加した現在の成功表示は `3 passed` です。途中で失敗した場合も、最後の終了コマンドを実行してください。既存の `pnpm typecheck` はWeb/API、`pnpm typecheck:browser` はブラウザテストを対象にします。既存の `pnpm test:e2e` は引き続きAPI結合テストです。

**2026-10-23の実行確認**

専用環境の準備・ビルド、型チェック、対象ファイルのlint・format確認を行い、Chromiumで2件成功しました。後片付けの検証では、別の一時テストを実ログイン後に意図的に失敗させ、成功・失敗の両方で専用DBのアプリ側User、Supabase Authユーザー、Authセッションが0件へ戻ることを確認しました。一時テストは確認後に削除しています。接続先を開発DB・API E2E DB・異なるDB名・開発Supabase・外部Supabaseへ変更した5パターンが拒否されることと、起動ログに管理キーが表示されないことも確認しました。

既存の `pnpm test`（393件）、`pnpm typecheck`、`pnpm lint` も成功しました。全体lintでは専用出力先の除外漏れを修正しています。失敗時traceに管理キーが含まれないことを確認し、検証後は専用Supabase・DBとWeb/APIが停止していることも確認しました。

**5. Projectを作成し、再読み込み後の保存内容を確認する**

2026-10-24に `e2e/tests/create-project.spec.ts` を追加しました。今回のテストも既存の一時ユーザーfixtureを使い、ログイン・作成・表示の確認を実際の画面から行います。

1. ログインフォームで一時ユーザーのメール・パスワードを送信する。
2. 一覧の「新規プロジェクト」から作成画面へ進む。
3. 名前・キー・説明を入力し、「プロジェクトを作成」を押す。
4. 一覧へ戻ることと、作成した行の名前・キー・説明、サイドバーへの反映を確認する。
5. ページを再読み込みし、一覧とサイドバーに同じ内容が残ることを確認する。

キーは `PW` とランダムなUUIDから取り出した12桁を組み合わせ、英数字14文字にしています。既存データや別の実行と重複しにくくし、20文字以内の入力ルールにも合わせています。

「新規プロジェクト」は内部でLinkを使っていますが、現在のブラウザ上ではbuttonとして公開されるため、`getByRole('button', { name: '新規プロジェクト', exact: true })` で取得します。テストで探せない場合は、ソースのタグ名だけで判断せず、失敗時のsnapshotで実際の役割と名前を確認します。

**作成したデータの後片付け**

ProjectはownerのUserを参照し、ProjectMemberはProjectとUserを参照するため、Userだけを先に削除すると外部キー制約に抵触します。fixtureでは次を1つのtransactionで順番に実行します。

1. 今回のユーザーの参加情報と、そのユーザーがownerのProjectの参加情報を削除する。
2. 今回のユーザーがownerのProjectを削除する。
3. 今回のユーザーのUserを削除する。

いずれも今回のユーザーIDで条件を限定します。アプリ側の削除が失敗した場合もAuthユーザーの削除を試み、最後にPrismaの接続を閉じます。

**フラスコから確認する場合**

`pnpm test:browser:prepare` と `pnpm typecheck:browser` の後、テスト一覧を更新して新しいProject作成テストを選べます。途中を確認する場合は、入力する行にブレークポイントを置いて「テストのデバッグ」を使います。

`prepare` は常時実行するコマンドではありません。テスト環境が起動していてコードも変わっていなければ、準備を繰り返さずにテストを再実行できます。専用環境を停止した後やアプリのコードを変更した後は、実行前に準備し直してください。コードの編集やテスト一覧の表示だけなら、環境の起動は不要です。

VS Codeの通常実行は次のテストに備えてWeb/APIを維持します。続けてフラスコから実行する間は毎回停止する必要はありません。作業終了時やCLI実行へ切り替えるときは、Playwright欄の「SETUP」→「Run global teardown」、またはコマンドパレットの「Test: Run global teardown」でWeb/APIを終了します。専用DB・Supabaseは `node e2e/stop.mjs` で別途終了します。

2026-10-24に、設定の読み込み時の認証キー取得を `e2e/serve.mjs` の起動時へ移しました。以前はSupabaseを停止するとVS Codeの一覧取得まで失敗しましたが、現在は環境を停止したまま編集・一覧表示できます。変更後に一覧を更新してください。検証では、子プロセスのPATHを空にしてSupabase CLIを呼べない状態でも3件の一覧を取得でき、起動中の専用環境でブラウザテスト3件とWeb/APIの終了も確認しました。

**2026-10-24の実行確認**

専用環境の準備・ビルド後、エージェントによる `pnpm test:browser` が3件成功しました（`3 passed`）。作成直後と再読み込み後の一覧・サイドバーへの反映を確認し、実行後に専用DBのUser・Project・ProjectMemberと、専用SupabaseのAuthユーザー・セッションが0件へ戻ることも確認しました。

さらに、作成・再読み込み後に意図的に失敗させる一時テストでも、同じ5種類のデータが0件へ戻ることを確認しました。一時テストは削除済みです。対象の型チェック・lint・format確認と `git diff --check` も成功しました。アプリ本体の変更はないため、今回は既存のAPI E2EとVitest全件を再実行していません。

**6. Projectの設定更新と再読み込みを確認する**

`e2e/tests/update-project.spec.ts` は、既存の作成テストに依存せず、次の操作を1つのテストで確認します。

1. 一時ユーザーでログインし、ブラウザから専用Projectを作成する。
2. 一覧の行から詳細を開き、「設定」リンクで `?tab=setting` へ進む。
3. 作成時の名前・説明・キーを確認し、名前と説明を変更して「設定を保存」を押す。
4. 再読み込みする前に、ヘッダー・パンくず・サイドバーが新しい名前になることを確認する。
5. 設定画面を再読み込みし、設定URL、保存した名前・説明、変更していないキー、各所の名前表示が残ることを確認する。
6. パンくずから一覧へ戻り、再読み込みの前後で名前・キー・説明を確認する。

保存直後の入力欄は、保存に失敗しても入力した値が残る可能性があります。そのため、保存結果の確認にはServer Componentが再取得して表示するヘッダーなどを使い、再読み込み後にはフォーム値も確認しています。固定時間の待機は使わず、Playwrightの `expect` で期待する表示を待ちます。

一時ユーザーとProjectの準備・後片付けには既存のfixtureを使います。更新で名前が変わっても、削除条件はユーザーID・ownerIdなので、作成したProjectを片付けられます。

フラスコからは、テスト一覧を更新し、「Projectの設定を更新でき、再読み込み後も変更が表示される」を選んで実行できます。ターミナルでこのテストだけ確認する場合は、準備後に次を実行します。

```bash
pnpm test:browser e2e/tests/update-project.spec.ts
```

2026-10-24に、専用環境の準備とビルド、型チェック、対象のlint・format確認を行い、既存分を含めて4件成功しました（`4 passed`）。実行後の専用DBのUser・Project・ProjectMemberと、専用SupabaseのAuthユーザー・セッションはすべて0件でした。テスト追加だけのため、アプリ本体の既存API E2EとVitest全件は再実行していません。

**7. Projectのアーカイブ・解除と再読み込みを確認する**

`e2e/tests/archive-project.spec.ts` は、1つの専用Projectをアーカイブしてから解除する流れを確認します。他のテストが作ったProjectには依存しません。

1. 一時ユーザーでログインし、ブラウザから専用Projectを作成する。
2. 一覧の「進行中」を確認して詳細を開き、設定画面で「アーカイブ」を押す。
3. 確認ダイアログで、名前が空・不一致の間は実行ボタンが無効で、正しい名前を入力すると有効になることを確認して実行する。
4. 設定URLからタスクURLへ戻り、詳細のアーカイブ済みの案内とサイドバーのアーカイブ表示を確認する。再読み込み後も同じ状態であることを確認する。
5. 一覧へ戻り、名前・キー・説明が保持され、「アーカイブ済み」と表示されることを確認する。一覧の再読み込み後も状態が残ることを確認する。
6. 同じProjectを開き直し、設定の「アーカイブを解除」を押す。
7. タスクURLへ戻り、詳細の案内とサイドバーのアーカイブ表示が消えることを確認する。再読み込み後も解除状態で、設定には通常のアーカイブボタンが表示されることを確認する。
8. 一覧へ戻り、名前・キー・説明を保持したまま「進行中」へ戻ることと、再読み込み後も状態が残ることを確認する。

詳細の案内は `role="status"` と案内文で、一覧の状態は対象Projectの行内で確認します。サイドバーのリンクには、アーカイブ時にアイコンと読み上げ用の「アーカイブ済み」が追加されるため、その文字の追加・削除を確認しています。CSSの色や透明度に依存する検証は追加していません。

Task CRUDは未実装のため、現段階ではアーカイブ済みの案内を確認します。Task作成・更新ができないことのブラウザ操作は、Task導入後に追加します。一時ユーザー・Project・参加情報の後片付けには既存のfixtureを使います。

フラスコからは一覧を更新し、「Projectをアーカイブ・解除でき、再読み込み後も状態が表示される」を選んで実行できます。このテストだけをターミナルで実行する場合は、準備済みの専用環境で次を実行します。

```bash
pnpm test:browser e2e/tests/archive-project.spec.ts
```

2026-10-24に、`pnpm test:browser:prepare`、`pnpm typecheck:browser`、対象のlint・format確認、`pnpm test:browser` が成功しました。既存分を含めて5件成功し（`5 passed`）、実行前後の専用DBのUser・Project・ProjectMember、専用SupabaseのAuthユーザー・セッションはすべて0件でした。テスト終了後のWeb/APIのポート解放も確認しています。変更はテストとドキュメントのみのため、既存のAPI E2EとVitest全件は再実行していません。

**8. 新規登録・メール確認から自動ログインを確認する**

`e2e/tests/email-confirmation.spec.ts` は、メール確認済みユーザーを用意する既存のfixtureとは分け、登録フォームから操作します。

1. ランダムな一時メールアドレス・パスワードと名前を登録フォームに入力する。
2. 確認メールを開く案内が表示され、登録画面に留まることを確認する。
3. 確認前にProject一覧を開くと、ログイン画面へ戻されることを確認する。
4. 専用Mailpitに届いた今回の宛先のメールを取得し、メール本文のリンクをブラウザで開く。
5. 自動ログインしてProject一覧へ進み、本人の名前・メールが表示されることを確認する。
6. 再読み込み後も同じURL・一覧・本人情報が表示されることを確認する。

**登録テスト用の準備と後片付け**

`e2e/fixtures/registration-user.ts` は入力値を用意し、ユーザー作成とメール確認はアプリの既存処理に任せます。管理クライアントは後片付けのためにNode.js内だけで使用します。

テスト終了時はブラウザcontextを閉じ、今回のメールアドレスに完全一致するAuthユーザーを管理APIの `listUsers()` で探します。アプリ側UserをID指定で削除してからAuthユーザーを削除し、今回の宛先のメールをID指定で削除します。登録前・未確認のまま失敗し、アプリ側Userがまだない場合も片付けられます。各削除の失敗時にも残りの後片付けとPrismaの切断を試みます。このテストではProjectを作成しません。

**専用メール受信API**

コンテナ名は `supabase_inbucket_...` ですが、実体はMailpit v1.30.2です。Inbucketのmailbox APIは404で、Mailpitの次のAPIが応答することを確認しました。

| 用途                   | API                                                       |
| ---------------------- | --------------------------------------------------------- |
| 今回の宛先を検索       | `GET /api/v1/search?query=to:一時メールアドレス`          |
| 確認メールの本文を取得 | `GET /api/v1/message/:id`                                 |
| 対象メールだけ削除     | `DELETE /api/v1/messages` に `{ "IDs": [対象ID] }` を送る |

メールの到着には `expect.poll` を使い、固定時間の待機は置きません。検索結果の宛先も完全一致で確認し、削除するIDの重複を除きます。対象が0件の場合は、IDなしの全件削除を避けるためDELETEを送信しません。

`e2e/environment.mjs` ではメール受信先を `http://127.0.0.1:55324` に限定します。確認リンクも専用Webの `/confirm`、`type=email`、token_hashの存在を確認してから開きます。管理APIによるメール確認、保存済みセッションの注入、認証のモックは使いません。

メールAPIの取得・削除にはNode.jsのfetchを使います。失敗traceに管理キーが入らないことを確認していますが、ブラウザで開く確認URLのtoken_hashはtraceに記録されます。レポートとtraceは一時的なテスト認証情報を含むものとして扱います。CIの保存対象・期間・閲覧範囲は次の節に記載します。

参考：[Mailpit API](https://mailpit.axllent.org/docs/api-v1/)、[Supabase listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers)、[確認用テンプレート](https://supabase.com/docs/guides/local-development/customizing-email-templates)。

**初回User保存の競合修正**

メール確認後の初回表示では、一覧と共通ナビゲーションのAPIが並行してUserを保存します。追加検証で `users_email_key` のP2002によるサーバーエラーを再現したため、AuthRepositoryに同じID・同じメールの行が先に保存された場合だけ更新する処理を追加しました。別IDの行をメールだけで本人として扱うことはなく、別のDBエラーは引き継ぎます。8本の同時API取得と別IDの上書き防止を結合テストで確認しています。[Prisma upsertの競合](https://www.prisma.io/docs/orm/v7/reference/prisma-client-reference#unique-key-constraint-errors-on-upserts)

フラスコの一覧を更新すると、今回の登録テストを選べます。ターミナルでは準備後に次を実行します。VS CodeがWeb/APIを保持している場合は、先に「Test: Run global teardown」を実行します。

```bash
pnpm test:browser e2e/tests/email-confirmation.spec.ts
```

2026-10-24の最終確認では、通常の `pnpm test:browser` で全6件成功しました。専用DB・専用Supabaseを接続先に指定した既存の `pnpm test:e2e` は全220件、Repository・Guardの単体テスト11件、APIとブラウザ用typecheck、対象のlint・format、専用ビルドも成功しました。Webの実装を変更していないため、WebのVitest全件とStorybookは実行していません。

登録前・未確認・確認後で意図的に失敗させた一時テストでも後片付けを確認しました。別宛先の検証用メールを保持でき、そのメールも最後にID指定で削除しています。最終的にUser・Project・ProjectMember・Authユーザー・Authセッション・受信メールは0件へ戻り、Web/APIのポートも解放されています。一時テストは削除済みです。

**9. GitHub ActionsでブラウザE2Eを実行する**

`.github/workflows/ci.yml` に `Browser E2E` jobを追加しました。既存の `Quality checks`・`API E2E` と同じく、develop向けPRとdevelopへのpushで実行します。それぞれ別のUbuntu runnerを使い、ブラウザ用のDB・認証ユーザー・メールはほかのjobやローカル環境と共有しません。

| 順番 | step                                    | 内容                                                                                        |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1    | Checkout / Setup / Install dependencies | コード取得、pnpm 11.9.0・Node.js 24・lockfileどおりの依存を準備する                         |
| 2    | Install Chromium                        | `pnpm exec playwright install --with-deps chromium` でブラウザとLinux用ライブラリを追加する |
| 3    | Prepare browser E2E environment         | `pnpm test:browser:prepare` で専用DB・Supabase起動、migration、専用ビルドを行う             |
| 4    | Typecheck browser tests                 | `pnpm typecheck:browser` でfixtureとテストの型を確認する                                    |
| 5    | Run browser E2E                         | `pnpm test:browser` で6件を実行する。Web/APIの起動・終了はPlaywrightが行う                  |
| 6    | Upload browser E2E report               | 成否どちらでもレポートと失敗時の調査資料をartifactへ保存する                                |
| 7    | Stop browser E2E environment            | `node e2e/stop.mjs` で専用Supabase・DBと一時データを終了・削除する                          |

ブラウザは画面を表示しないheadlessで動きます。Chromiumだけを使い、テストは既存設定どおり1 workerで順に実行します。Supabaseの公開キーと管理キーはrunner上の専用Supabaseから取得するため、新しいGitHub Secretsの登録は不要です。管理キーはNode.jsのfixture内だけで使用し、Web/APIへは渡しません。[PlaywrightのCI手順](https://playwright.dev/docs/ci-intro)

**失敗と終了処理**

テストが失敗すれば `Browser E2E` jobも失敗します。`continue-on-error` は使いません。job全体は30分、環境準備は15分、テストは10分、最後の環境終了は5分を上限にしています。

uploadの `if: ${{ !cancelled() }}` は、前のstepが失敗しても実行し、キャンセル時は省略する指定です。準備などで失敗してレポートがない場合は `if-no-files-found: ignore` でuploadをスキップします。環境終了の `if: always()` は、準備・型チェック・テスト・uploadの失敗後も終了処理を試みる指定です。runnerの強制終了などでこの処理自体が完了しなくても、GitHubがjob専用のrunnerを破棄します。

**レポートとtraceの確認**

`browser-e2e-report` artifactには `playwright-report/` と `test-results/` だけを含め、7日後に削除します。HTMLレポートは成功時も保存し、失敗時には既存のPlaywright設定によるscreenshot・traceも保存します。`.env`、Supabase CLIの認証キーを含むJSON、DBやビルド成果物は保存対象にしません。[upload-artifactの設定](https://github.com/actions/upload-artifact#usage)

artifactはGitHubにログインし、リポジトリの読み取り権限を持つ人がダウンロードできます。非公開の保管場所としては扱わず、今回のテスト専用ユーザー・セッション・確認URLを含む可能性がある資料として扱います。テスト終了時にfixtureでユーザーを削除し、最後に専用Supabaseも停止・削除します。[GitHubのartifact閲覧条件](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)

PRのChecksまたはActionsから対象のCIを開き、Artifactsの `browser-e2e-report` をダウンロードして展開します。展開したフォルダ内の `playwright-report/` を次のコマンドへ指定します。

```bash
pnpm exec playwright show-report /展開先/playwright-report
```

traceを直接開く場合は、展開先の `test-results/` にある対象テストのtraceを指定します。

```bash
pnpm exec playwright show-trace /展開先/test-results/対象テスト/trace.zip
```

2026-10-24に、actionlint、YAMLの読み取りと既存job・共通設定の維持、全19個のrun stepのbash構文、ブラウザ用typecheck、CI指定時の6件のテスト一覧、対象format・`git diff --check` を確認しました。今回はworkflowとドキュメントだけの変更なので、ブラウザ・API E2E・Vitest全件とビルドは再実行していません。

GitHub上での実行・artifactの保存確認は、今回の変更をPRへ反映した後に行います。既存の `pnpm test:e2e` と `API E2E` jobは引き続きVitest + SupertestによるAPI結合テストです。
