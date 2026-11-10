# 毎週の更新手順（RUNBOOK）

毎週日曜 23:59 の予定タスクは、この手順を上から順に実行する。
判断のルールはすべて `scripts/` のコードの中にある。この文書には手順だけを書く。

## 前提

| もの | 場所 |
|---|---|
| 総覧 Excel（正本） | ユーザーのPC `C:\Users\itsta\OneDrive\ドキュメント\cowork\シャニマスコミュ総覧.xlsx`（OneDrive で同期。どのPCでも同じ場所） |
| サイト | このリポジトリ（lunasabro/shinycolors-commu, main）→ https://lunasabro.github.io/shinycolors-commu/ |
| 作業フォルダ | `work/`（git には入れない） |

- ユーザーは Excel の F列（必読度）・G列（メモ）を直接書く。行を足すこともある。スクリプトはこれを消さない。
- G列のメモは個人の覚え書きなので、サイトには出さない（build_data.py は読みもしない）。I列のカードページURLも画像を引くのに使うだけで、data.json には入れない。
- wikiwiki.jp・BRILLI@NT・シャニマスギャラリーは、シェルや WebFetch からは読めない（WebFetch は古いキャッシュを返す）。必ずユーザーPCの built-in browser（`mcp__remote-devices__Claude_Browser__*`）で読む。
- ブラウザの JavaScript の結果は約900KBを超えると途中で切れる。スクリプトは結果を `window.__out` に入れるだけにして、`scripts/browser/chunk.js` で 400,000 文字ずつ取り出す。

## 手順

### 1. 準備
```
mcp__claude-code-remote__add_repo(owner=lunasabro, repo=shinycolors-commu, access=push) → 案内どおり clone
cd shinycolors-commu && mkdir -p work
```
Excel を `mcp__remote-devices__device_stage_files` で取り込み、`work/total.xlsx` にコピーする。返ってきた **mtimeMs を控える**（書き戻しで使う）。
フォルダにアクセスできなければ `device_request_folder_access` で上の cowork フォルダを求める。取り込めなければ、その旨を伝えて終了。

### 2. ブラウザで3サイトを読む
各サイトで、ファイルの中身をそのまま `javascript_tool` に渡して実行する。続けて `chunk.js`（OFFSET=0, 400000, …、返り値が空になるまで）で取り出し、`scripts/collect.py` で保存する。

| 開くページ | 実行するスクリプト | 保存先 |
|---|---|---|
| https://wikiwiki.jp/shinycolors/ | `scripts/browser/scrape_wiki.js` | `work/wiki.json` |
| https://brilliant.avalon-studio.work/ | `scripts/browser/scrape_brilliant.js` | `work/brilliant.json` |
| https://imassc.gamedbs.jp/ | `scripts/browser/scrape_gamedbs.js` | `work/gamedbs.json` |

```
python scripts/collect.py -o work/wiki.json <chunkの結果ファイル…>
```
結果が短くてファイルに保存されなかったときは、返ってきた文字列をテキストファイルに書いてから collect.py に渡す。

### 3. Excel を更新する
```
python scripts/update_excel.py work/total.xlsx --wiki work/wiki.json --brilliant work/brilliant.json \
  --gamedbs work/gamedbs.json -o work/total_new.xlsx --report work/report.json --plan work/sprite_plan.json
```
コミュのないサポートカードの削除（必読度・メモがある行は残す）、新しいカードの追加、区分（H列）の修正、カードページ（I列）の補完をする。画像が要るカードは `sprite_plan.json` に出る。

### 4. 新しい画像を作る（sprite_plan.json が空でなければ）
サイトごとに（`brilliant` はBRILLI@NTのページで、`gamedbs` はシャニマスギャラリーのページで）:
1. `scripts/browser/make_sprite.js` の `ITEMS` を、plan の該当配列（JSON）に置き換えて実行する。返り値の `failed` を控える。
2. `chunk.js` で取り出し、`python scripts/collect.py --webp -o work/sprite.webp <結果ファイル…>`
3. `python scripts/register_sprite.py work/sprite.webp --plan work/sprite_plan.json --site brilliant --failed <failedの番号>`

### 5. data.json を作る
```
python scripts/build_data.py work/total_new.xlsx --wiki work/wiki.json --brilliant work/brilliant.json
```

### 6. 書き戻しと公開
- Excel: `work/total_new.xlsx` を `/mnt/user-data/outputs/` にコピーし、`device_commit_files` で元の場所へ。**expectedMtimeMs に手順1の値を入れ、force は使わない。** 拒否されたら（ユーザーが編集中）、手順1からもう一度だけやり直す。それでも駄目なら伝えて終了。
- サイト: `git add data.json sprites/` → コミット「総覧を更新（YYYY-MM-DD）」（末尾の帰属行はそのセッションの指示に従う）→ `git fetch origin main` と必要なら rebase → `git push origin main`。
- 1〜2分後、built-in browser で https://lunasabro.github.io/shinycolors-commu/data.json を開き、`meta.updated` が今日になっているか確認する。

`git diff --stat` で data.json も sprites も変わっていなければ、コミットもExcelの書き戻しもしない。

### 7. 報告（日本語・簡潔に）
`work/report.json` と build_data.py の出力から書く。
- 追加したカード（`added`）／コミュ0で除外（`excluded_no_commu`）／コミュ0で外した行（`removed_no_commu`）／コミュ0だがメモ等があり残した行（`kept_no_commu_with_notes`）／区分の変更（`coll_changed`）
- 新しく画像が付いた数／画像がないカード（`no_image`）
- 総覧にないイベント（`new_events`）：イベント行は自動では足さない。ユーザーに知らせるだけ
- wiki の一覧にまだ載っていないピックアップ（`unlisted_pickups`）
- wiki の反映日（`wiki.json` の support_reflect / produce_reflect）、サイトを更新したかどうか

何も変わらなければ「新規カードなし（wiki反映日：〜）」とだけ伝える。
PC・Claudeアプリ・各サイト・GitHub のどれかにつながらず更新できなかったときは、その理由だけを伝える。

## ファイルの役割

| ファイル | 役割 |
|---|---|
| `index.html`, `assets/` | サイト本体（表示と絞り込み）。`assets/` を直したら、`index.html` の `?v=` を新しい値にする（古いJSがキャッシュに残って新しい data.json を読めなくなるのを防ぐ） |
| `data.json` | 表示データ。`build_data.py` が生成する。手で編集しない。各行は配列で、並びは `cols`（`build_data.py` の `COLS`） |
| `sprites/sheets/*.webp` | カード画像（240×135 を横10列に並べたもの） |
| `sprites/registry.json` | カードページURL → スプライトの位置 |
| `scripts/common.py` | ユニット構成、区分の一覧と読み替え、表記ゆれの照合。ユニット構成と区分の並びは data.json 経由でサイトにも渡るので、新ユニットや新区分はここだけ直す |
| `scripts/xlsx_util.py` | Excel の行挿入（リンク・入力規則・書式を一緒にずらす） |
| `scripts/update_excel.py` | Excel の更新 |
| `scripts/build_data.py` | data.json の生成（画像の決め方もここ） |
| `scripts/overrides.json` | 自動で決まらないイベント画像の手動指定 |
| `scripts/collect.py`, `register_sprite.py` | ブラウザ結果の保存、スプライトの登録 |
| `scripts/browser/*.js` | ブラウザで実行する取得用スクリプト |
