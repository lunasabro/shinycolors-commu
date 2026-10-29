# シャニマスコミュ総覧

シャニマスのコミュがあるカード・イベント・シナリオの一覧ページ。
https://lunasabro.github.io/shinycolors-commu/

元データは作成者の総覧 Excel（OneDrive の cowork フォルダ）。毎週日曜 23:59 に、wiki などから新しいカードを Excel に足し、このリポジトリの `data.json` を作り直して公開する。手順は [RUNBOOK.md](RUNBOOK.md)。

## 中身

```
index.html            ページの骨組み
assets/app.js         一覧の表示と絞り込み（data.json を読む）
assets/style.css      見た目
data.json             表示データ（scripts/build_data.py が生成。手で直さない）
sprites/
  sheets/*.webp       カード画像。240×135 を横10枚ずつ並べた1枚絵
                      b* = BRILLI@NT、g* = シャニマスギャラリー（最初にまとめて作成）、n* = 毎週の追加分
  registry.json       カードページURL → 画像の位置
scripts/
  common.py           ユニット構成・区分の一覧・表記ゆれの照合（サイトにも data.json 経由で渡る）
  update_excel.py     Excel に新しいカードを足し、区分・カードページを補う
  build_data.py       Excel から data.json を作る（画像の割り当てもここ）
  xlsx_util.py        Excel の行の挿入・削除（リンクや書式も一緒にずらす）
  collect.py          ブラウザで取ったデータをファイルに戻す
  register_sprite.py  新しい画像を sprites/ に登録する
  overrides.json      自動で決まらないイベント画像の手動指定
  browser/*.js        ブラウザで実行する取得用スクリプト（wiki・BRILLI@NT・シャニマスギャラリー）
```

- 動かすのに必要なもの: Python 3.10+、`pip install openpyxl pillow`
- Excel の G列（メモ）は公開しない。data.json に入るのは必読度まで。
- 画像の権利は BANDAI NAMCO Entertainment Inc. に帰属します。
