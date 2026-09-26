# 品質・セキュリティのフォローアップタスク

最終更新: 2026-09-26

## 目的

プロジェクト管理機能のレビューで見つかった改善点を、次の作業スレッドでも再開できるように記録する。各タスクは原則として別ブランチ・別 Pull Request で進め、完了したらこの文書の状態を更新する。

この文書は作業メモであり、正式な仕様は [REQUIREMENTS.md](./REQUIREMENTS.md)、[DOMAIN_MODEL.md](./DOMAIN_MODEL.md)、[UI_API.md](./UI_API.md) を優先する。

## 現在の前提

- プロジェクトの作成・一覧・詳細・更新・アーカイブ・解除が実装済み。
- Supabase Auth と Project membership による API 認証・認可は未実装で、外部公開前に必要。
- ルートの `pnpm test` は API と Web の Vitest を実行する。`pnpm test:e2e` は Supertest による API 結合テストで、GitHub Actions の CI にはまだ含まれていない。
- Playwright の設定・ブラウザE2Eテストはまだない。API E2E（Supertest）だけでは、画面遷移やユーザー操作を通した確認はできない。
- フェーズの記述に差がある。`REQUIREMENTS.md` は Task CRUD の後に認証を置く一方、`DOMAIN_MODEL.md` は認証・メンバーを Task より先に置いている。Phase 2 の作業順を決める際にどちらに揃えるか確認する。
- 依存関係の監査結果は 2026-09-26 時点のスナップショット。着手時に必ず再実行し、最新の advisory と lockfile を確認する。

## タスク一覧

### 1. プロジェクト名を正規化して検証する

- 状態: 作業中（実装コードは未マージ、API E2E は未実行）
- 優先度: 高（Task API を増やす前に対応）

#### 背景

Project の作成 DTO は空文字を拒否するが、空白だけの文字列は通る。更新 DTO も同様で、Service は `name` を trim せず保存する。そのため、空白だけの名前や前後に空白が付いた名前が DB に登録される可能性がある。

アーカイブ確認 UI は入力を trim した値と保存済みの名前を比較する。保存済みの名前に前後空白があると、画面上で表示された名前を入力しても比較に失敗し、アーカイブ操作を完了できない。

#### 作業内容

- API の作成・更新で、前後空白を除いた名前を検証・保存する。
- trim 後に空文字になる名前を `400 Bad Request` にする。
- trim 後の文字数に対して 1〜100 文字の制約を適用する。
- UI の入力ルールと API の保存ルールを一致させる。
- 既存 DB に前後空白付きの名前があるか確認し、必要ならデータ修正方法を決める。既存データを無断で一括変更しない。

#### 実施メモ（2026-09-26）

- 別作業の未コミット差分で、作成・更新 DTO は検証前に名前を trim し、Service でも保存時に trim するようにした。Web の作成・設定フォームも trim 後の 1〜100 文字で検証する。設定フォームの HTML `maxLength` は、trim 前の入力を切り詰めてルールと食い違うため外した。これらのコードと正式仕様の変更は、この文書を追加する PR には含めない。
- Prisma の `Project` モデルは `@@map("projects")` により、DB 上では `projects` テーブルを使う。ルート `.env` を読み込んだ接続先を読み取り専用で確認すると、`projects` テーブルと既存データ 6 件があり、JavaScript の `trim()` と 1〜100 文字のルールで修正が必要な名前は 0 件だった。画面を表示する API が同じ接続先を使っているかは未確認。
- Web の対象テスト 3 ファイル・15 件、API build、Web typecheck、API lint、対象の Web lint が通過。DB を使わない DTO の実行確認では、前後空白の除去、空白だけの拒否、trim 後 100 文字の許可・101 文字の拒否、更新時の `null` 拒否を確認した。
- API E2E テストは作業ツリーに追加したが、DB への保存まで通す実行確認はまだできていない。現在の `apps/api/test/setup-env.ts` はルート `.env` を読むため、E2E が開発用 DB に接続し得る。タスク 2 でテスト専用 DB を分離した後に実行し、タスク 1 の完了条件を確認する。

#### 完了条件

- 作成・更新で空白だけの名前を送ると `400` になる。
- 作成・更新で前後空白付きの名前を送ると、正規化された名前が保存される。
- trim 後に 100 文字を超える名前は `400` になる。
- プロジェクト名の確認によるアーカイブ操作が、正規化後の名前で成功する。
- 上記を API E2E と必要なフォームテストで確認する。

### 2. API E2E テスト用 DB を開発 DB から分離する

- 状態: 未着手
- 優先度: 高（タスク API の結合テストを増やす前）

#### 背景

`apps/api/test/setup-env.ts` はアプリ本体と同じルート `.env` を読む。接続先を別に設定しない限り、E2E テストが開発用の `DATABASE_URL` を使用する。現在の後片付けはランダムなテストキーに限定されているが、テスト専用 DB に分けた方が誤操作の影響を抑えられる。

#### 作業内容

- E2E 専用の `TEST_DATABASE_URL` と DB 初期化手順を用意する。
- テスト DB の接続先が未指定、または通常の開発 DB と同じ場合は、テストを開始せず明確なエラーで止める。
- migration を適用してから API E2E を実行できるようにする。
- Prisma 接続をアプリ終了時に閉じ、繰り返しテストしても接続が残らないことを確認する。
- ローカルと CI の両方で、同じ安全な実行手順を使う。

#### 完了条件

- `pnpm test:e2e` が専用 DB 以外に接続しない。
- 専用 DB の URL がない場合や通常 DB を指している場合、テストが安全に失敗する。
- migration 適用後に E2E を繰り返しても、テストデータが残らず他の開発データに影響しない。

### 3. API E2E テストを GitHub Actions CI で実行する

- 状態: 未着手
- 優先度: 高（タスク 2 に依存）

#### 背景

`.github/workflows/ci.yml` は format、lint、typecheck、`pnpm test`、build を実行するが、PostgreSQL を起動せず、`pnpm test:e2e` も実行していない。現在の CI では API と DB の結合動作を確認できない。

#### 作業内容

- CI job に一時的な PostgreSQL service と health check を追加する。
- タスク 2 のテスト専用 DB 設定を使い、migration を適用してから API E2E を実行する。
- 既存の lint、typecheck、unit test、build の確認を維持する。

#### 完了条件

- Pull Request の CI で migration と `pnpm test:e2e` が実行される。
- DB 起動に失敗した場合や API E2E が失敗した場合、CI が失敗として報告する。
- CI の DB は job 終了後に破棄され、実データや秘密情報を必要としない。

### 4. 依存関係監査の警告を確認して対応する

- 状態: 未着手
- 優先度: 高（外部公開・ファイルアップロード導入の前に再確認）

#### 背景

2026-09-26 に実行した `pnpm audit --prod` は、計 7 件（High 5、Moderate 1、Low 1）を報告した。lockfile 上では次の間接依存が含まれていた。

| パッケージ | lockfile のバージョン | 報告された影響 |
| --- | --- | --- |
| `multer` | `2.2.0` | High 3 件、Low 1 件。multipart 入力時の DoS など |
| `mysql2` | `3.15.3` | High 1 件、Moderate 1 件。認証情報の漏えい、圧縮入力の DoS など |
| `deepmerge-ts` | `7.1.5` | High 1 件。再帰オブジェクト処理による stack exhaustion |

当時の advisory: [multer DoS](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm)、[multer file descriptor leak](https://github.com/advisories/GHSA-qfvm-cv95-jqjf)、[multer oversized index DoS](https://github.com/advisories/GHSA-535w-7cp7-47q4)、[multer fileFilter race](https://github.com/advisories/GHSA-qvfw-j98x-7q72)、[mysql2 cleartext credentials](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr)、[mysql2 decompression DoS](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3)、[deepmerge-ts stack exhaustion](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)。

監査で検出されたことは、アプリの現在のコード経路で全てが悪用可能であることを意味しない。特に upload と MySQL は現時点でアプリコードから使っていないため、どの実行経路に含まれるかを確認してから更新方針を決める。

#### 作業内容

- `pnpm audit --prod` を再実行し、現在の lockfile と advisory の内容を確認する。
- 該当依存の親パッケージ、実行経路、アプリでの使用有無を調べる。
- 互換性を確認して、親パッケージの更新を優先する。理由なく lockfile override だけで依存を置き換えない。
- 更新後に install、lint、typecheck、test、build を実行する。

#### 完了条件

- 現行の audit 結果と、対応・保留それぞれの理由が記録されている。
- 到達可能な問題は修正版へ更新され、必要な確認が CI を含めて通る。
- 保留する警告には、現在のコードで影響が限定される根拠と再確認のタイミングが記録されている。

### 5. Supabase Auth と Project 権限を API に実装する

- 状態: 未着手
- 優先度: 外部公開前の必須タスク。製品フェーズでは認証・メンバー段階で実施する。

#### 背景

現在の Projects API には認証 guard と Project membership の認可チェックがない。ネットワークから API に到達できる状態では、認証なしでプロジェクトを閲覧・変更できる。

#### 作業内容

- Supabase access token を API で検証し、ユーザーを特定する。
- Project の取得は membership を確認し、別ユーザーのプロジェクトを ID 指定で取得できないようにする。
- Project の設定更新、アーカイブ、アーカイブ解除は owner のみ許可する。
- Task の閲覧・作成・更新は、DOMAIN_MODEL.md と UI_API.md に定める owner/member/viewer の権限に従う。
- ユーザーと Project membership の DB model、migration、初期 owner 登録の流れを設計する。
- API の権限確認を実装し、UI の表示制御だけに依存しない。
- 認証が完了するまではローカル開発の API と DB を loopback に限定する方法を確認する。デプロイ環境では認証を有効にしてから外部公開する。

#### 完了条件

- token なし・無効 token は `401` になる。
- membership がないユーザーは Project / Task にアクセスできず、別プロジェクト ID を使った越境操作もできない。
- viewer の更新、member の owner 専用操作が `403` になる。
- owner は許可された操作を実行できる。
- 権限ごとの成功・失敗を API E2E で確認する。

### 6. Playwright で主要なユーザー操作をブラウザE2Eテストする

- 状態: 未着手
- 優先度: 高（主要な画面操作が揃った段階で追加し、CIで継続確認する）

#### 背景

現在の `pnpm test:e2e` は Supertest を使った API 結合テストであり、ブラウザ上の画面遷移、入力、表示更新までは確認しない。Playwright の設定やテストもまだないため、フロントエンドと API をつないだ主要導線を自動で回帰確認できるようにする。

#### 作業内容

- Playwright の設定、実行スクリプト、テスト用の起動・終了手順を追加する。
- テストデータと接続先を開発 DB・本番データから分離し、タスク 2 のテスト DB 方針と整合させる。
- 現在の主要導線として、プロジェクト作成、設定更新、アーカイブ、アーカイブ解除をブラウザから確認する。
- 画面表示だけでなく、保存後のヘッダー・パンくず・サイドバーへの反映、再読み込み後の永続性、成功・失敗時の表示を確認する。
- 認証導入後はログインを含む導線に更新し、Task CRUD 実装後はタスクの主要導線も追加する。
- GitHub Actions で必要なアプリ/API/DBを起動し、Playwright テストを実行する。CI に組み込む際は、失敗時に原因を調べられるよう Playwright のレポートや trace を必要に応じて保存する。

#### 完了条件

- ローカルで決まったコマンドから Playwright のブラウザE2Eを実行できる。
- プロジェクトの作成・設定更新・アーカイブ・解除の主要導線が成功することを確認できる。
- テストは専用データを使い、開発 DB や本番データを変更しない。
- Pull Request の CI で Playwright が実行され、失敗時は CI が失敗として報告する。
- 認証や Task CRUD の導入後も、該当する重要なユーザー導線を追加・更新する。

## 推奨する着手順

1. タスク 1: 名前の正規化。入力データの不整合を先に防ぐ。
2. タスク 2: API E2E 用 DB を分離する。
3. タスク 3: API E2E を CI に加える。
4. タスク 4: 依存関係監査を再実行し、影響を確認して更新する。
5. タスク 5: 認証と権限。Phase 2 で Task CRUD を先に進める場合も、外部公開前には完了させる。
6. タスク 6: Playwright で主要なブラウザ導線を確認する。タスク 2 で用意する E2E テスト専用 DB を使い、認証後・Task CRUD 実装後も対象導線を拡張する。

各タスクは個別のスレッド・ブランチ・PRで進め、実装後にこの文書の状態、正式仕様、確認結果を更新する。

## 次の Codex スレッドへの引き継ぎ

新しいスレッドで、このリポジトリを開いて次のように依頼する。

> `docs/QUALITY_SECURITY_FOLLOW_UP_TASKS.md` を読み、タスク 1 の作業状況と未コミット差分を確認してください。関連する正式仕様も確認し、実装コードを専用ブランチ・別 PR で扱ってください。API E2E はタスク 2 のテスト専用 DB を用意してから実行し、タスク 1 の完了条件を確認してください。

最初のタスク以外に着手する場合は、依頼文でタスク名を指定する。この文書の状態と完了条件を、新しいスレッドの作業基準として使う。
