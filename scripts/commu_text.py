"""コミュのログ画像（シャニマスクショのスクロール撮影）から台詞を読み取り、本文テキストにする。

  python scripts/commu_text.py ログ画像.png --key "プロデュースシナリオ|W.I.N.G|2018-04-24" --title "公園の歌声" --out 本文フォルダ

- 画像が何列かに並べてある場合は、列の間の区切りを見つけて1列ずつ読む。
- 選択肢で分かれるコミュは --choice に選んだ選択肢の文言を入れる。ログの中のその行より前を共通部分、
  後ろを「## 選択肢: …」の節にして書く。同じコミュの別の選択肢を後から足すと、節が増える（共通部分はそのまま）。
- 本文は作成者のPC（cowork フォルダ）にだけ置く。リポジトリには入れない（公開するのは build_commu_index.py の索引だけ）。
- 読み取りは scripts/ocr/ocr.js（Tesseract.js）。先に `cd scripts/ocr && npm install` しておく。
"""
import argparse
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def split_columns(img, min_gap=8):
    """縦一列が同じ色の帯（列の区切り）で画像を分ける"""
    a = np.asarray(img.convert("L")).astype(float)
    flat = np.where((a.std(axis=0) < 3) & (a.mean(axis=0) < 80))[0]  # 区切りは暗い色の縦帯
    cuts, start, prev = [], None, None
    for x in flat:
        if start is None or x != prev + 1:
            if start is not None and prev - start + 1 >= min_gap:
                cuts.append((start, prev))
            start = x
        prev = x
    if start is not None and prev - start + 1 >= min_gap:
        cuts.append((start, prev))
    edges, x0 = [], 0
    for s, e in cuts:
        if s - x0 > 100:
            edges.append((x0, s))
        x0 = e + 1
    if img.width - x0 > 100:
        edges.append((x0, img.width))
    return [img.crop((l, 0, r, img.height)) for l, r in edges] or [img]


def ocr(paths):
    out = subprocess.run(["node", os.path.join(HERE, "ocr", "ocr.js"), *paths], capture_output=True, text=True, check=True)
    return out.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--key", required=True, help="総覧の行：種別|名前|実装日（data.json の kind|name|date）")
    ap.add_argument("--title", default="", help="コミュのタイトル（カードの中のどのコミュか）")
    ap.add_argument("--choice", default="", help="選んだ選択肢の文言（選択肢で分かれるコミュのとき）")
    ap.add_argument("--out", required=True, help="本文を書き出すフォルダ（公開しない場所）")
    a = ap.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        cols = []
        for p in a.images:
            for i, col in enumerate(split_columns(Image.open(p).convert("RGB"))):
                f = os.path.join(tmp, f"{len(cols):03d}.png")
                col.save(f)
                cols.append(f)
        text = ocr(cols)

    lines = [re.sub(r"\s+", "", l) for l in text.splitlines()]
    lines = [l for l in lines if l]
    os.makedirs(a.out, exist_ok=True)
    key = f"{a.key}|{a.title}" if a.title else a.key
    name = re.sub(r'[\\/:*?"<>|]', "_", key) + ".txt"
    path = os.path.join(a.out, name)

    shared, sections = lines, {}
    if a.choice:
        at = find_choice(lines, a.choice)
        if at is None:
            sys.exit(f"ログの中に選択肢「{a.choice}」が見つかりません")
        shared, branch = lines[:at], lines[at:]
        if os.path.exists(path):  # 同じコミュの別の選択肢：共通部分は前のまま、節を足す
            shared, sections = read_text(path)[1:]
        sections[a.choice] = branch
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# {key}\n" + "".join(l + "\n" for l in shared))
        for c, body in sections.items():
            f.write(f"## 選択肢: {c}\n" + "".join(l + "\n" for l in body))
    print(f"{path}: {len(cols)}列 {len(lines)}行" + (f"（選択肢 {len(sections)}本）" if sections else ""), file=sys.stderr)


def find_choice(lines, choice):
    """選択肢の文言にいちばん近い行の位置。読み取りの誤りを見込んで、3文字ずつの一致で比べる"""
    def g(t):
        t = re.sub(r"[^\w]", "", t)
        return {t[i:i + 3] for i in range(len(t) - 2)}
    want = g(choice)
    start = g(choice[:4])

    def f(have):  # 選択肢の文言とどれだけ重なるか（取りこぼしと余分の両方を見る）
        hit = len(want & have)
        return 0 if not hit else 2 * hit / (len(want) + len(have))

    def score(i):
        one = f(g(lines[i]))
        # 選択肢は2行に折り返していることがあるので、次の行とつなげたものとも比べる（その行が選択肢の書き出しを含むときだけ）
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        two = f(g(lines[i] + nxt)) if start & g(lines[i]) else 0
        return max(one, two)

    # 選択肢はその続きより前にあるので、条件を満たす最初の行をとる（続きの台詞に似た言い回しが出ても取り違えない）
    return next((i for i in range(len(lines)) if score(i) >= 0.6), None)


def read_text(path):
    """本文ファイルを（見出し, 共通部分の行, {選択肢: 行}）に分ける"""
    with open(path, encoding="utf-8") as f:
        rows = f.read().splitlines()
    head, shared, sections, cur = rows[0], [], {}, None
    for l in rows[1:]:
        if l.startswith("## 選択肢: "):
            cur = l.removeprefix("## 選択肢: ")
            sections[cur] = []
        elif cur is None:
            shared.append(l)
        else:
            sections[cur].append(l)
    return head, shared, sections


if __name__ == "__main__":
    main()
