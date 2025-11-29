# 家計簿 Web アプリ (GAS + React)

Google スプレッドシートを「DB」、Google Apps Script を API として使う家計簿アプリのフロントエンドです。GitHub Pages 上でホストし、ブラウザだけで利用できます。

> **本リポジトリは、我が家で使いやすい形式に作っており、一般的な家計簿とは使用感が異なります。また、自分の好みで機能を変えることがあります。**

## 機能
- 個人口座に収入が入る夫婦（カップル、ルームシェア）が損得なくお金回りを管理するためのツール
- 今月何を購入したかには全くフォーカスせず、夫婦（カップル/ルームシェア）がいくら振り込むべきか、共有口座（共有財布）の残高がいくらかにフォーカス。

## 構成と前提
- フロント: React + TypeScript + Vite（base `/gas-kakeibo/` で Pages 配信）
- バックエンド: Google Apps Script（`doGet/doPost` で API）
- データ: スプレッドシートに複数シートを持つ構成（後述）
- 必要環境: Node.js 20 / npm 10 以上

## GAS 側セットアップ
1. テンプレートスプレッドシートをコピー
  - [テンプレート](https://docs.google.com/spreadsheets/d/1V2Nh6S0ELjmwv5iaMHA27lTYAeU8atAaozEy878omho/edit?usp=sharing) を開き、`ファイル > コピーを作成` で自分の Google ドライブに保存
2. GAS プロジェクトを作成
  - スプレッドシートから `拡張機能 > Apps Script` を開き、新規プロジェクトを作成
3. スクリプトプロパティ
   - `PASSWORD_HASH`: 共有パスワードを `SHA-256 -> Base64` した文字列を設定
   - 例えばパスワードを `pass` にする場合、以下のコマンドで生成
   - `echo -n "pass" | openssl dgst -binary -sha256 | base64`
4. ウェブアプリとしてデプロイ
   - 実行するユーザー: 自分
   - アクセスできるユーザー: 全員
   - 最新版としてデプロイし、発行された URL を `VITE_API_BASE` に設定
5. GAS スクリプト開発
   - `gas` ディレクトリで `clasp login` / `clasp push` / `clasp pull` を使用（初回は `clasp clone <GAS_ID>` で取得）。

## 環境変数
- 必須: `VITE_API_BASE`（GAS ウェブアプリのデプロイ URL）
- ローカル: ルートに `.env` を作成し `VITE_API_BASE="https://script.google.com/macros/s/xxxx/exec"`
  - ローカルで開発する際に使用
- GitHub Actions: Repository Secret `VITE_API_BASE` に同じ値を登録（`/.github/workflows/deploy.yml` がビルド時に注入）
  - GitHub Pages でホストする際に使用

## フロントエンドのセットアップ
```bash
npm ci
# .env を作成し VITE_API_BASE を設定
npm run dev
```
ブラウザで http://localhost:5173 を開き、共有パスワードでログインできれば OK。

## GAS向けコマンド
- 基本的に以下のコマンドをすべて実行すれば反映される
```
clasp login
clasp push
```
> GASのコードをプッシュ後には、GASの管理画面からデプロイを行わないと反映されないため注意


## GitHub Pages へのデプロイ
1. Settings > Pages で **GitHub Actions** を選択済みであることを確認
2. Repository Secret `VITE_API_BASE` を設定
3. `main` に push（`/.github/workflows/deploy.yml` が起動し `npm ci && npm run build` を実行）
4. Actions 成果物が `dist` として Pages に公開される
5. 公開 URL 例: `https://<GitHubユーザー名>.github.io/gas-kakeibo/`

## 動作確認シナリオ
1. ログイン: 共有パスワードで `status: ok` を受信
2. 月次概要: ホーム/振込計算タブで収支サマリ・必要振込額が表示される
3. 入力: 日付・種別・金額を登録すると一覧とサマリが更新される
4. 固定費: `recurrents` に設定した定期明細が対象月に自動展開される
5. 振込記録: 振込計算タブから必要額で振込を登録でき、共有タブに反映される
6. 共有口座支出: 共有タブで支出額を登録すると口座収支/履歴が更新される
7. プロフィール: 設定モーダルから名前とアイコン（Drive 保存）が更新できる

## プロフィール画像の機能を初めて使う際
- App Scriptのページで`profile.js`を開き、`ensureProfileImageFolder()`を実行しないと、ドライブにアクセスする権限が得られません。
- 権限を得た後に再度デプロイを行ってください。

## トラブルシュート
- 「VITE_API_BASE が設定されていません。」→ `.env` / Secret の設定と再デプロイを確認
- `invalid_password` → `PASSWORD_HASH` が平文でないか、Base64 文字列が一致するか確認
- GAS API が 302/403 → ウェブアプリのアクセス権が「全員」か、最新版をデプロイしたか確認
- プロフィール画像アップロード失敗 → 500KB 超過や MIME 不正がないか、Drive 権限を確認

## ライセンス
MIT License