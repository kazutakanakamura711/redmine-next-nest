# Storybookで再利用UIの状態を確認する

コマンドは、指定がなければリポジトリのルートで実行します。現在の対象は、既存Buttonの通常・disabled、Input＋Labelの通常・disabled・入力エラー、Badgeのvariantと長文、Alertのvariantとaction付き表示、AlertDialogの開閉・長文・確定ボタン無効状態です。

## Storybookの役割

Storybookは、UI部品に決まったpropsを渡し、画面から切り離して状態を表示するカタログです。

| 道具                           | 確認すること               | このプロジェクトでの例                      |
| ------------------------------ | -------------------------- | ------------------------------------------- |
| Storybook                      | 部品の見た目と状態         | Buttonの通常・disabled、狭い幅での表示      |
| Vitest + React Testing Library | UI操作とその結果           | フォーム送信時の入力エラー                  |
| Vitest + Supertest             | API・認証・認可・DB保存    | viewerによる更新の拒否                      |
| Playwright                     | 実ブラウザを通した主要導線 | ログインからProject作成、再読み込み後の表示 |

Storybookのbuildは、カタログを静的ファイルへ変換できることを確認します。画面の見た目・操作やAPI接続の正しさは、それぞれの確認が必要です。既存の `pnpm test:e2e` はAPI結合テスト、`pnpm test:browser` はPlaywrightのブラウザテストです。

## 導入した依存と設定

導入時のWebはNext.js 16.3.5・React 19.2.8・Tailwind CSS 4.3.3です。追加した直接依存は次の3つで、すべてWebの開発用依存です。

| パッケージ               | バージョン | 役割                                                |
| ------------------------ | ---------- | --------------------------------------------------- |
| `storybook`              | 10.6.3     | 起動・buildコマンド                                 |
| `@storybook/nextjs-vite` | 10.6.3     | Next.js向けのStorybook設定                          |
| `vite`                   | 8.3.0      | Storybookのビルド基盤。既存lockfileと同じバージョン |

Storybook側のビルドにViteを使います。既存のNext.jsの開発・buildコマンドはそのまま使います。追加addonはありません。[Next.js向けの公式ガイド](https://storybook.js.org/docs/get-started/frameworks/nextjs-vite)

`pnpm-workspace.yaml` の `allowBuilds` では、Storybookが利用する `esbuild@0.28.2` のpostinstallを許可しています。この処理はビルド用バイナリを準備・確認します。

| ファイル                                                                           | 責務                                                                   |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [main.ts](../apps/web/.storybook/main.ts)                                          | frameworkと `src` 配下のstoryの検索先を指定する。telemetryも無効にする |
| [preview.ts](../apps/web/.storybook/preview.ts)                                    | 全storyへ適用するCSSと、中央に配置する設定を読み込む                   |
| [preview.css](../apps/web/.storybook/preview.css)                                  | Storybook用のシステムフォントを指定する                                |
| [button.stories.tsx](../apps/web/src/components/ui/button.stories.tsx)             | 既存Buttonの通常・disabledを定義する                                   |
| [input.stories.tsx](../apps/web/src/components/ui/input.stories.tsx)               | 既存InputとLabelを組み合わせ、通常・disabled・入力エラーを定義する     |
| [badge.stories.tsx](../apps/web/src/components/ui/badge.stories.tsx)               | 既存Badgeの6種類のvariantと長文の表示を定義する                        |
| [alert.stories.tsx](../apps/web/src/components/ui/alert.stories.tsx)               | 既存Alertの2種類のvariantとaction付き表示を定義する                    |
| [alert-dialog.stories.tsx](../apps/web/src/components/ui/alert-dialog.stories.tsx) | 既存AlertDialogの開閉・長文・確定ボタン無効状態を定義する              |

`preview.ts` はアプリと同じ `src/app/globals.css` を読み込みます。Tailwind CSS 4の処理には既存の `postcss.config.mjs` を使い、色・余白・枠などを共有します。

アプリのGeistはRootLayoutの `next/font/google` で設定されています。StorybookではRootLayoutを読み込まず、専用CSSでシステムフォントの変数を補います。Google Fontsへ接続せずに確認できますが、Geistとの完全一致を確認する構成ではありません。

## 起動・表示確認・終了

依存がまだ入っていない環境では、先にlockfileどおりにインストールします。

```bash
pnpm install --frozen-lockfile
```

次にStorybookを起動します。現在のButton・Input・Badge・Alert・AlertDialogのstoryには、Web/APIの開発サーバー、Docker、Supabaseの起動や接続設定は不要です。

```bash
pnpm storybook
```

ルートのscriptがWebの `storybook` scriptを呼び、`storybook dev --host 127.0.0.1 -p 6006 --no-open` を実行します。`--host` は待ち受け先、`-p` はポート、`--no-open` はブラウザを自動で開かない指定です。

1. ブラウザで `http://127.0.0.1:6006` を開く。
2. 左側の `UI → Button → Default` を選び、通常の「保存」ボタンを確認する。
3. `Disabled` を選び、薄く表示され、操作できないことを確認する。
4. 通常ボタンにTabでフォーカスでき、disabledボタンがフォーカス対象にならないことを確認する。
5. ブラウザの開発者ツールで390px程度に幅を変え、部品に横スクロールや欠けがないことを確認する。

Inputは `UI → Input` の `Default`・`Disabled`・`Invalid` を選びます。通常はラベルとplaceholder、disabledは入力済みで操作できない状態、Invalidは枠線と固定のエラーメッセージを確認します。通常のラベルを押すと入力欄へフォーカスが移り、文字を入力できます。

Badgeは `UI → Badge` の各variantと `Long Text` を選びます。色・枠と、狭い幅での長文の収まりを確認します。

Alertは `UI → Alert` の `Default`・`Destructive`・`With Action` を選びます。通常とエラーの配色、タイトル・説明の間隔、action付きの場合の右上のボタン配置を確認します。`With Action` のボタンは配置の表示例で、操作は実装していません。

AlertDialogは `UI → AlertDialog` を選びます。初期表示のダイアログをキャンセルまたは確定ボタンで閉じ、トリガーから再度開けることを確認します。`Long Description` では説明文の折り返しと狭い幅での表示、`Confirm Action Disabled` では確定ボタンが無効でキャンセルは操作できることを確認します。Story内の確定操作は表示確認用で、アプリのデータは変更しません。

下部のControlsでpropsを変えると表示も変わります。上の確認は各storyの初期値で行います。別のターミナルで重複起動せず、起動中のターミナルで `Ctrl+C` を押して終了します。

### 表示例

手順1で取得した確認画像です。通常表示はStorybook全体、disabledは390px幅の部品表示です。

![Buttonの通常表示とControls](./images/storybook-button-default.png)

<img src="./images/storybook-button-disabled-mobile.png" alt="390px幅でのdisabledのButton" width="240" />

## Buttonのstoryを読む

現在のstoryは次の内容です。既存Buttonをファイルから直接importして使います。

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Button } from '@/components/ui/button';

const meta = {
  title: 'UI/Button',
  component: Button,
  args: {
    children: '保存',
    disabled: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
```

- `title` は左側の一覧での分類名、`component` は表示する部品です。
- `args` は部品へ渡すpropsです。共通設定で文言と通常状態を定義します。
- `Default` は共通設定を使い、`Disabled` は `disabled` だけを上書きします。
- `Meta`・`StoryObj` と `satisfies` により、部品のpropsに合うstoryか型チェックできます。`satisfies` が実行時に入力を検証するわけではありません。

書き方の詳細は[TypeScriptによるstoryの公式ガイド](https://storybook.js.org/docs/writing-stories/typescript)を参照してください。

## InputとLabelのstoryを読む

Inputのstoryは、既存のInput・Labelをそれぞれのファイルから直接importして組み合わせています。

| story      | 表示する状態                                                     |
| ---------- | ---------------------------------------------------------------- |
| `Default`  | 空のメールアドレス欄とplaceholder。入力できる                    |
| `Disabled` | `disabled: true` と `defaultValue` による入力済みの欄            |
| `Invalid`  | 不正な形式の入力例、`aria-invalid: true`、固定のエラーメッセージ |

共通の `render` はLabelとInputの配置を定義し、Default・Disabledで使います。Invalidは、エラーメッセージも表示する `render` をstory側に定義します。ラベルの `htmlFor` と入力欄の `id` を揃え、各storyには異なるIDを指定しています。

Invalidでは、入力欄の `aria-describedby` とメッセージの `id` を同じ `input-invalid-error` にして、入力欄の説明として関連付けています。`aria-invalid` は既存Inputのエラー用スタイルにも使います。

`defaultValue` は初期値です。`value` で入力値を固定しないため、通常とInvalidの入力欄では文字を編集できます。Invalidは入力を変えても固定のエラーを表示し続けます。入力検証の処理は追加せず、フォームの検証は既存のVitestで確認します。

### Inputの表示例

通常状態のStorybook全体と、390px幅のdisabled、320px幅の入力エラーです。

![Inputの通常表示とControls](./images/storybook-input-default.png)

<img src="./images/storybook-input-disabled-mobile.png" alt="390px幅でのdisabledのInput" width="240" />

<img src="./images/storybook-input-invalid-mobile.png" alt="320px幅での入力エラーのInput" width="240" />

## Badgeのstoryを読む

既存Badgeを直接importし、共通のargsに文言とdefaultのvariantを指定しています。各storyはvariantなど必要なpropsだけを上書きします。

| story         | 確認する表示                       |
| ------------- | ---------------------------------- |
| `Default`     | 基本の背景色と文字色               |
| `Secondary`   | 控えめな背景色                     |
| `Destructive` | 注意を表す配色                     |
| `Outline`     | 枠線を使う表示                     |
| `Ghost`       | ホバー時に背景が付く表示           |
| `Link`        | ホバー時に下線が付く文字装飾       |
| `LongText`    | 長い文言と、画面幅を上限にした表示 |

このstoryのBadgeはspan要素です。Linkも既存variantの文字装飾を確認する表示例として使います。

LongTextの `max-w-[calc(100vw-2rem)]` は、Storybookの左右の余白を引いた画面幅を上限にします。`justify-start` で左寄せにし、狭い幅では既存の `overflow-hidden` によって収まらない文言が隠れます。Badge本体や画面固有の権限色・ステータス色は変更していません。

### Badgeの表示例

通常状態のStorybook全体と、390px幅のDestructive、320px幅の長文です。

![Badgeの通常表示とControls](./images/storybook-badge-default.png)

<img src="./images/storybook-badge-destructive-mobile.png" alt="390px幅でのDestructiveのBadge" width="240" />

<img src="./images/storybook-badge-long-text-mobile.png" alt="320px幅での長文のBadge" width="240" />

## Alertのstoryを読む

既存のAlert・AlertTitle・AlertDescriptionを直接importして、役割の異なる表示を定義しています。

| story         | 確認する表示                              |
| ------------- | ----------------------------------------- |
| `Default`     | 通常の案内                                |
| `Destructive` | destructive variantのエラー               |
| `WithAction`  | AlertAction内に既存Buttonを配置した表示例 |

Alert自体が `role="alert"` を付けます。storyでは通常・destructiveのvariantと、タイトル・説明の組み合わせを確認します。`WithAction` はAlertActionの配置確認が目的で、Buttonのクリック処理は持たせていません。既存Alertや画面固有のエラー処理には変更を加えていません。

### Alertの表示例

Storybook全体の通常表示と、390px幅のdestructive、320px幅のaction付き表示です。

![Alertの通常表示とControls](./images/storybook-alert-default.png)

<img src="./images/storybook-alert-destructive-mobile.png" alt="390px幅でのdestructive Alert" width="240" />

<img src="./images/storybook-alert-action-mobile.png" alt="320px幅でのaction付きAlert" width="240" />

## ローカルbuildと変更後の確認

起動中のStorybookを終了してから、次を実行します。

```bash
pnpm storybook:build
```

Webの `storybook build` が動き、`apps/web/storybook-static` にHTML・CSS・JavaScriptを生成します。このコマンドは公開・デプロイを行いません。通常の `pnpm build` とStorybookのbuildは別のscriptです。[静的buildの公式ガイド](https://storybook.js.org/docs/sharing/publish-storybook)

生成物はGit・Prettier・ESLint・Webの型チェックから除外しています。`.storybook` のTypeScript設定とstory自体は、Webのlint・型チェックで確認します。`debug-storybook.log` もGitの対象外です。

設定やstoryを変更したら、表示確認と、影響する範囲のコマンドを順番に実行します。

```bash
pnpm format:check
pnpm --filter @redmine-next-nest/web lint
pnpm --filter @redmine-next-nest/web typecheck
pnpm storybook:build
```

UIの振る舞いを変更した場合は、関連するVitestも実行します。重いbuildやテストをむやみに同時実行しないでください。導入時のbuildでは500 kBを超えるチャンクの警告が出ましたが、buildは成功しています。

## CIでのbuild確認

[ci.yml](../.github/workflows/ci.yml) の `Quality checks` jobは、既存のアプリbuildの次に次のstepを実行します。

```yaml
- name: Build Storybook
  run: pnpm storybook:build
```

既存のNode.js 24・pnpm 11.9.0・`pnpm install --frozen-lockfile` の準備を利用します。現在のButton・Input・Badge・Alert・AlertDialogのstoryをbuildするstepには、追加のDB・Supabase・GitHub Secretsは不要です。直前のアプリbuildにある公開用の仮設定は、そのstepだけの設定です。

develop向けPRとdevelopへのpushで実行され、Storybook buildが失敗すれば `Quality checks` も失敗します。ここではカタログの公開やartifactへの保存は行いません。

GitHub上の確認は、この変更をpush・PRへ反映した後に行います。Checksから `Quality checks → Build Storybook` を開き、コマンドが実行され、成功したことを確認します。ローカルbuildの成功と、GitHub上でのCI成功は分けて記録します。

## 現在の確認範囲と次の作業

2026-10-26に、Storybookの最小設定・Button・CI・手順書はPR #32、Input＋LabelはPR #33、BadgeはPR #34で `develop` にマージ済みです。PR #32・#33・#34のCIではQuality checks・API E2E・Browser E2Eの3 jobがそれぞれ成功しています。Button・Input・Badgeのローカル表示とbuildも確認済みです。AlertのDefault・Destructive・With Actionは[PR #35](https://github.com/kazutakanakamura711/redmine-next-nest/pull/35)で追加・マージ済みで、[PR CI](https://github.com/kazutakanakamura711/redmine-next-nest/actions/runs/40279927188)の3 jobも成功しています。AlertDialogには現在の作業ブランチで3つのstoryを追加しています。

最小設定・Buttonの2状態・CI・本手順書は[PR #32](https://github.com/kazutakanakamura711/redmine-next-nest/pull/32)でdevelopへマージ済みです。[PR時点のCI](https://github.com/kazutakanakamura711/redmine-next-nest/actions/runs/40270876759)と[マージ後のCI](https://github.com/kazutakanakamura711/redmine-next-nest/actions/runs/40271421115)は成功しています。

Input＋Labelの3状態は[PR #33](https://github.com/kazutakanakamura711/redmine-next-nest/pull/33)、Badgeの7表示例は[PR #34](https://github.com/kazutakanakamura711/redmine-next-nest/pull/34)でdevelopへマージ済みです。Alertのstoryは[PR #35](https://github.com/kazutakanakamura711/redmine-next-nest/pull/35)で追加・マージされ、ローカルlint・typecheck・buildと320px幅の表示、PR CIの3 job成功を確認しています。AlertDialogにはDefault・Long Description・Confirm Action Disabledを追加し、開閉・disabled状態・320px幅の長文表示を確認しています。Task CRUDはStorybookの部品追加後に進めます。進捗と検証結果は[タスク7](./QUALITY_SECURITY_FOLLOW_UP_TASKS.md#7-storybook-で再利用-ui-の状態を確認できるようにする)に記録します。
