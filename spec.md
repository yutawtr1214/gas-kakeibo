# 共有口座振込額計算アプリ MVP 仕様書（アイテムベース）

## 1. システム概要

### 1.1 システム名（仮称）

共有口座振込額計算アプリ（GitHub Pages + Google Apps Script）

### 1.2 目的

* 各メンバー（例: 夫・妻）の「月別の手取り収入」と

  * 本来は**共通口座から支払うべき支出を、個人口座から支払ったもの**
  * 本来は**個人口座から支払うべき支出を、共通口座から支払ったもの**
  * 個人のお小遣い
    をもとに、
* 毎月「そのメンバーが共通口座にいくら振り込むべきか」を計算する。
* 個別の支出イベントを1件ずつ登録できるようにし、月末等にまとめて振込額の目安を確認できるようにする。
* 従来スプレッドシートで管理していた情報を、Webアプリとして利用可能にする。

### 1.3 範囲（MVP）

MVPでは以下の機能を提供する。

* メンバー・年月の選択
* 月別の手取り収入の登録（1か月あたり1つ以上の収入イベントを登録可能）
* 「本来は共通口座から支払うべき支出を、個人口座から支払ったイベント」の登録
* 「本来は個人口座から支払うべき支出を、共通口座から支払ったイベント」の登録
* お小遣いの登録（1か月に1つの金額として扱う）
* 上記のイベント・値に基づく「月別の推奨振込額」の算出と表示
* イベント一覧表示と削除（編集はMVPでは削除＋再登録とする）

※ 実際の振込額（実振込額）の管理はMVPの範囲外とする。

---

## 2. 計算モデル

### 2.1 基本概念

1. **手取り収入 (INCOME)**

   * メンバーがその月に受け取った手取りの合計。
   * 月に複数回発生してよい（給与＋ボーナスなど）。

2. **共通口座→個人口座への補填対象 (SHARED_SHOULD_PAY_BUT_PERSONAL_PAID)**

   * 本来は共通口座から支払うべき支出を、個人口座から支払ったもの。
   * 例: 共通の光熱費を一時的に個人カードで立て替えた場合。
   * 共通口座から見ると、「すでにこのメンバーが立て替えてくれた分」なので、その分だけ**この月に振り込む必要額は減る**。

3. **個人口座→共通口座への追加負担対象 (PERSONAL_SHOULD_PAY_BUT_SHARED_PAID)**

   * 本来は個人口座から支払うべき支出を、共通口座から支払ったもの。
   * 例: 個人的な買い物を共通カードで払ってしまった場合。
   * 共通口座から見ると、「このメンバーが本来負担すべきなのに共通から出てしまった分」なので、その分だけ**この月に振り込む必要額は増える**。

4. **お小遣い (POCKET_MONEY)**

   * メンバーがその月に自由に使うことを前提とした金額。
   * 1か月に1つの値を持つ前提とする（複数登録された場合は合計）。

### 2.2 月別推奨振込額の計算式

1. 月の合計手取り収入:

```text
income_total = Σ(INCOME)
```

2. 本来共通負担なのに個人が払った合計:

```text
shared_from_personal_total = Σ(SHARED_SHOULD_PAY_BUT_PERSONAL_PAID)
```

3. 本来自分負担なのに共通が払った合計:

```text
personal_from_shared_total = Σ(PERSONAL_SHOULD_PAY_BUT_SHARED_PAID)
```

4. お小遣い合計:

```text
pocket_total = Σ(POCKET_MONEY)
```

5. 推奨振込額（共通口座へ）:

```text
base = income_total - pocket_total

recommended_transfer = base
                       + personal_from_shared_total
                       - shared_from_personal_total
```

* `base` は「手取りからお小遣いを引いた残りを、原則として共通口座に回す」という考え方。
* 共通口座から個人に対する補填対象（立て替えなど）は既に個人口座から支出済みのため、その分 `shared_from_personal_total` を引いて調整する。
* 共通口座から個人に対する逆方向の立て替え（本来自分負担）については、その分 `personal_from_shared_total` を加算して調整する。

---

## 3. システム構成

### 3.1 全体構成

* フロントエンド

  * GitHub Pages 上でホストされる静的サイト
  * 単一ページ構成のWebアプリ（HTML / CSS / JavaScript）
  * 機能: メンバー・年月選択、イベント登録、一覧表示、推奨振込額表示

* バックエンド（API）

  * Google Apps Script（Webアプリとしてデプロイ）
  * 機能:

    * HTTP GET / POST の受付
    * パラメータのバリデーション
    * スプレッドシートへのイベント追加・削除
    * 月次集計と推奨振込額の計算
    * 排他制御（LockService）

* データストア

  * Googleスプレッドシート
  * 1シートに全メンバー・全期間のイベントを記録する（行＝1イベント）

### 3.2 通信

* フロント: `https://<GitHubユーザ名>.github.io/<リポジトリ名>/`
* API(GAS): `https://script.google.com/macros/s/XXXXX/exec`
* リクエスト形式:

  * GET: クエリパラメータ
  * POST: `application/x-www-form-urlencoded`
* レスポンス形式: JSON

---

## 4. 機能要件（MVP）

### 4.1 メンバー・年月選択

* 画面上で以下を選択可能とする。

  * メンバー: 例として `husband` / `wife` のようなID（表示上は「夫」「妻」など）
  * 年: 西暦（YYYY）
  * 月: 1〜12
* 選択変更時に、指定メンバー・年月に紐づくイベント一覧・集計結果を読み込み表示する。

### 4.2 イベント登録

1件のイベントは以下から構成される。

* 日付（任意。未入力の場合はその月の代表日として処理してもよい）
* 種別（`INCOME` / `SHARED_SHOULD_PAY_BUT_PERSONAL_PAID` / `PERSONAL_SHOULD_PAY_BUT_SHARED_PAID` / `POCKET_MONEY`）
* 金額（整数、円単位、正の値）
* メモ（任意の文字列）

登録操作:

* ユーザーがフォームに入力して「追加」ボタンを押す。
* フロントエンドは、選択中のメンバー・年月・入力項目をPOSTでAPIへ送信する。
* APIはイベントをスプレッドシートに追記し、成功時にイベント一覧と最新の集計結果を返す。

### 4.3 イベント一覧表示

* 指定されたメンバー・年月に紐づくイベントを一覧表示する。
* 表示項目:

  * 日付
  * 種別（ラベル表示: 収入 / 共通→個人補填対象 / 個人→共通負担対象 / お小遣い）
  * 金額
  * メモ
  * 削除ボタン

### 4.4 イベント削除

* 各イベント行に削除ボタンを設置する。
* 削除ボタン押下時:

  * フロントエンドは該当イベントIDを指定して削除APIを呼び出す。
  * APIはスプレッドシート上の対応行を削除し、最新の一覧・集計結果を返す。

### 4.5 月次集計・推奨振込額表示

* 指定メンバー・年月について、APIから取得した集計値を画面に表示する。

* 表示内容:

  * 収入合計 (`income_total`)
  * 共通口座から支払うべきものを個人口座から払った合計 (`shared_from_personal_total`)
  * 個人口座から支払うべきものを共通口座から払った合計 (`personal_from_shared_total`)
  * お小遣い合計 (`pocket_total`)
  * 推奨振込額 (`recommended_transfer`)

* 推奨振込額は計算式に基づき、プラスの場合は「共通口座へ振り込むべき金額」、マイナスの場合は「共通口座から補填されるべき金額」として表示する。

---

## 5. 画面仕様（MVP）

### 5.1 画面構成

1. ヘッダ

   * アプリ名
   * メンバー選択プルダウン
   * 年・月の選択UI

2. イベント登録フォーム

   * 日付入力（`<input type="date">`）
   * 種別選択（セレクトボックス）
   * 金額入力（数値）
   * メモ入力
   * 「追加」ボタン

3. 月次集計表示エリア

   * `income_total`
   * `shared_from_personal_total`
   * `personal_from_shared_total`
   * `pocket_total`
   * `recommended_transfer`（強調表示）

4. イベント一覧テーブル

   * 日付 / 種別 / 金額 / メモ / 削除ボタン

---

## 6. データ仕様（スプレッドシート）

### 6.1 シート構成

* スプレッドシート名: 任意（例: `shared_transfer_items`）
* シート名: `items`（固定で扱う）

### 6.2 カラム定義

シート `items` の1行が1イベントを表す。

| 列 | カラム名       | 型      | 説明                                                                                                        |
| - | ---------- | ------ | --------------------------------------------------------------------------------------------------------- |
| A | id         | 文字列    | イベントID（UUIDなど一意キー）                                                                                        |
| B | member_id  | 文字列    | メンバーID（例: `husband`, `wife`）                                                                              |
| C | year       | 数値     | 年（YYYY）                                                                                                   |
| D | month      | 数値     | 月（1〜12）                                                                                                   |
| E | date       | 日付/文字列 | 日付（任意、未入力可）                                                                                               |
| F | item_type  | 文字列    | `INCOME` / `SHARED_SHOULD_PAY_BUT_PERSONAL_PAID` / `PERSONAL_SHOULD_PAY_BUT_SHARED_PAID` / `POCKET_MONEY` |
| G | amount     | 数値     | 金額（正の整数）                                                                                                  |
| H | note       | 文字列    | メモ                                                                                                        |
| I | created_at | 日時文字列  | 作成日時                                                                                                      |
| J | updated_at | 日時文字列  | 更新日時                                                                                                      |

* 月次の集計は `(member_id, year, month)` でグルーピングし、`item_type` ごとの `amount` の合計を算出する。

---

## 7. API仕様（GAS Webアプリ）

### 7.1 共通

* ベースURL: `https://script.google.com/macros/s/XXXXX/exec`
* リクエスト形式:

  * GET: クエリパラメータ
  * POST: `application/x-www-form-urlencoded`
* レスポンス形式: `application/json`

#### 7.1.1 共通レスポンス形式

```json
// 正常系
{
  "status": "ok",
  "data": ...
}

// 異常系
{
  "status": "error",
  "message": "エラーメッセージ"
}
```

### 7.2 イベント追加 API

* メソッド: `POST`

* パラメータ:

  * `mode=item_add`
  * `member_id`
  * `year`
  * `month`
  * `date`（任意）
  * `item_type`（`INCOME` / `SHARED_SHOULD_PAY_BUT_PERSONAL_PAID` / `PERSONAL_SHOULD_PAY_BUT_SHARED_PAID` / `POCKET_MONEY`）
  * `amount`（数値文字列）
  * `note`（任意）

* 処理:

  * `LockService.getScriptLock()` により排他制御を行う。
  * 入力値のバリデーション（必須項目、金額が正の整数かなど）。
  * `id` を生成し、新規行としてシートに追加。
  * 追加後、指定メンバー・年月のイベント一覧と集計結果を再計算し、レスポンスの `data` に含める。

* レスポンス（成功例）:

```json
{
  "status": "ok",
  "data": {
    "items": [ /* 指定メンバー・年月のイベント一覧 */ ],
    "summary": {
      "income_total": 289718,
      "shared_from_personal_total": 15000,
      "personal_from_shared_total": 8000,
      "pocket_total": 30000,
      "recommended_transfer": 252718
    }
  }
}
```

### 7.3 イベント削除 API

* メソッド: `POST`
* パラメータ:

  * `mode=item_delete`
  * `id`（イベントID）
* 処理:

  * `LockService.getScriptLock()` により排他制御を行う。
  * `id` に一致する行を検索し、削除。
  * 該当行の `member_id` / `year` / `month` を元に、その月のイベント一覧・集計結果を再計算して返す。

### 7.4 月次データ取得 API

* メソッド: `GET`
* パラメータ:

  * `mode=month_get`
  * `member_id`
  * `year`
  * `month`
* 処理:

  * 指定されたメンバー・年月に対応するイベントを全件取得。
  * `item_type` ごとに金額を集計し、月次サマリを計算。
* レスポンス（成功例）:

```json
{
  "status": "ok",
  "data": {
    "items": [
      {
        "id": "...",
        "member_id": "husband",
        "year": 2025,
        "month": 1,
        "date": "2025-01-01",
        "item_type": "INCOME",
        "amount": 289718,
        "note": "給与"
      }
      // ...
    ],
    "summary": {
      "income_total": 289718,
      "shared_from_personal_total": 15000,
      "personal_from_shared_total": 8000,
      "pocket_total": 30000,
      "recommended_transfer": 252718
    }
  }
}
```

---

## 8. 非機能要件（MVP）

### 8.1 性能

* 想定ユーザー数: 数名（家族内）。
* 1か月あたりのイベント件数: 数十件程度。
* スプレッドシートの行数は数千行程度を想定し、GASの実行時間制限内で動作することを前提とする。

### 8.2 信頼性

* データはスプレッドシートに即時保存される。
* バックアップはスプレッドシートのコピー作成等で手動管理とする。

### 8.3 セキュリティ

* 家族内利用を前提とし、MVPにおいては簡易な共有パスワード認証等を別途設けることができるが、本仕様書の範囲外とする（必要に応じて拡張）。
* 全通信はHTTPS経由とする。
