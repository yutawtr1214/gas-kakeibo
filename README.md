# 家計簿 Web アプリ (GAS + React)

Google スプレッドシートを「DB」、Google Apps Script を API として使う家計簿アプリのフロントエンドです。GitHub Pages 上でホストし、ブラウザだけで利用できます。

## 現在の構成
- フロント: React + TypeScript + Vite
- バックエンド: Google Apps Script（`doGet/doPost` 実装済み）
- データストア: Google スプレッドシート（シート名 `kakeibo`）
- デプロイ: GitHub Pages（Actions で `dist` を公開）

## 必要要件
- Node.js 20 以上 / npm 10 以上
- GAS 側:
  - スプレッドシートにシート `kakeibo` を用意し、ヘッダ行: `id,date,category,amount,payment_method,note,created_at,updated_at`
  - Script Properties に `PASSWORD_HASH` を設定（共有パスワードを SHA-256 → Base64 した値）
  - GAS を「ウェブアプリ」としてデプロイし、匿名アクセス可・実行ユーザーは自分に設定
- フロント用環境変数: `VITE_API_BASE`（GAS ウェブアプリ URL）

## 環境変数の扱い
- ローカル開発: ルートに `.env` を作成し、以下を記載（リポジトリにコミットしない）
  ```
  VITE_API_BASE="https://script.google.com/macros/s/xxxx/exec"
  ```
- 本番デプロイ（GitHub Actions）: Repository Secret `VITE_API_BASE` に同じ値を登録。Actions がビルド時に注入するため、リポジトリに平文を残しません。

## セットアップ
```bash
npm ci
# .env を作成して VITE_API_BASE を設定
npm run dev
```
ブラウザで http://localhost:5173 を開き、共有パスワードでログインできれば OK。

## よく使うコマンド
- 開発サーバ: `npm run dev`
- 型チェック + 本番ビルド: `npm run build`
- Preview (ビルド済みを確認): `npm run preview`

## GASコマンド
> コマンド実行前に`gas`ディレクトリに移動すること
- GAS ログイン: `clasp login`
- gasプロジェクトクローン: `clasp clone <GASプロジェクトID>`
- GAS デプロイ: `clasp push`（GAS 側で手動デプロイも必要）
- GAS pull: `clasp pull`
`

## 動作確認シナリオ（MVP）
1. ログイン: 共有パスワードで `status: ok` になること
2. 一覧取得: 当月のデータが表示され、合計・カテゴリ別集計が計算されること
3. 追加: 日付/カテゴリ/金額を入力して追加後、一覧と集計が更新されること
4. 更新: 行の「編集」で値を変え保存、一覧に反映されること
5. 削除: 行の「削除」で確認ダイアログ後に行が消えること
6. バリデーション: 金額 0 や未入力でエラーメッセージが出ること

## GitHub Pages へのデプロイ
1. Settings > Pages で **GitHub Actions** を選択済みであることを確認
2. Repository Secret `VITE_API_BASE` を設定
3. `main` に push（`/.github/workflows/deploy.yml` がトリガー）
4. Actions が `npm ci && npm run build` を実行し、`dist` を Pages に公開
5. 公開 URL: `https://<GitHubユーザー名>.github.io/gas-kakeibo/`

## トラブルシュート
- 画面に「VITE_API_BASE が設定されていません。」→ `.env` or Secrets の設定漏れ/Pages 再デプロイが必要
- ログインで `invalid_password` → `PASSWORD_HASH` が平文になっていないか確認（SHA-256 → Base64 を設定）
- API が 302/403 → GAS デプロイの「アクセスできるユーザー」が「全員」になっているか確認

