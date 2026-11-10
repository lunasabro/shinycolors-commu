# 光空記録総覧（シャニマスのコミュ一覧）

シャニマスのコミュがあるカード・イベント・シナリオの一覧ページ。
https://lunasabro.github.io/shinycolors-commu/

元データは作成者の総覧 Excel（OneDrive の cowork フォルダ）。毎週日曜 23:59 に、wiki などから新しいカードを Excel に足し、このリポジトリの `data.json` を作り直して公開する。手順は [RUNBOOK.md](RUNBOOK.md)。

## 中身

```
index.html            ページの骨組み
assets/app.js         一覧の表示と絞り込み（data.json を読む）、トップの動画、イメージカラー
assets/shot-search.js 「スクショで探す」（台詞を読み取って commu_index.json と照らし合わせる）
assets/style.css      見た目
assets/media/         トップの動画と静止画
assets/logos/         ユニットロゴ（公式サイトのもの。余白を切った webp）
data.json             表示データ（scripts/build_data.py が生成。手で直さない）
commu_index.json      スクショ検索の索引（scripts/build_commu_index.py が生成。本文は入っていない）
sprites/
  sheets/*.webp       カード画像。240×135 を横10枚ずつ並べた1枚絵
                      b* = BRILLI@NT、g* = シャニマスギャラリー（最初にまとめて作成）、n* = 毎週の追加分
  registry.json       カードページURL → 画像の位置
extension/            コミュ記録（拡張機能）：読みながら台詞とタイトルを記録する。詳しくは extension/README.md
scripts/
  common.py           ユニット構成・区分の一覧・表記ゆれの照合（サイトにも data.json 経由で渡る）
  update_excel.py     Excel に新しいカードを足し、区分・カードページを補う
  build_data.py       Excel から data.json を作る（画像の割り当てもここ）
  xlsx_util.py        Excel の行の挿入・削除（リンクや書式も一緒にずらす）
  collect.py          ブラウザで取ったデータをファイルに戻す
  register_sprite.py  新しい画像を sprites/ に登録する
  overrides.json      自動で決まらないイベント画像の手動指定
  browser/*.js        ブラウザで実行する取得用スクリプト（wiki・BRILLI@NT・シャニマスギャラリー）
  commu_text.py       コミュのログ画像から本文を読み取る（本文は作成者のPCにだけ置く）
  build_commu_index.py 本文からスクショ検索の索引を作る
  ocr/                文字読み取り（Tesseract.js）。使う前に `npm install`
```

- 動かすのに必要なもの: Python 3.10+、`pip install openpyxl pillow`
- コミュの本文は公開しない。リポジトリにも入れない。サイトに置くのは、台詞を3文字ずつ区切って値に変えた索引だけ。
- Excel の G列（メモ）は公開しない。data.json に入るのは必読度まで。
- トップの動画（assets/media/hero.mp4）は公式「MOIW2025記念 虹の行方 スペシャルMV」の全編（音なし・720p）。hero.jpg は動画が出るまでの静止画。
- 画像・動画の権利は BANDAI NAMCO Entertainment Inc. に帰属します。
