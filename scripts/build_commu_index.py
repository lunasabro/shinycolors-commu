"""コミュ本文のフォルダから、サイトの「スクショで探す」用の索引 commu_index.json を作る。

  python scripts/build_commu_index.py 本文フォルダ [-o commu_index.json]

本文はそのまま公開しない。台詞を3文字ずつに区切り、それぞれを18ビットの値に変えた集合だけを書き出す。
値は多くの3文字で重なるので、索引から本文を組み立て直すのは難しい（不可能ではない）。
区切り方と値の計算は assets/shot-search.js と同じでなければならない。
"""
import argparse
import base64
import glob
import json
import os
import re
import sys
import unicodedata

from common import load_json, dump_json
from commu_text import read_text

BITS = 18
N = 3
KEEP = re.compile(r"[^ぁ-ゖァ-ヺー々〆一-鿿a-z0-9]")


def norm(s):
    return KEEP.sub("", unicodedata.normalize("NFKC", s).lower())


def fnv1a(s):
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def grams(text):
    t = norm(text)
    return sorted({fnv1a(t[i:i + N]) & ((1 << BITS) - 1) for i in range(len(t) - N + 1)})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("textdir")
    ap.add_argument("-o", "--out", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "commu_index.json"))
    ap.add_argument("--data", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data.json"))
    a = ap.parse_args()

    data = load_json(a.data)
    c = {k: i for i, k in enumerate(data["cols"])}
    known = {f'{r[c["kind"]]}|{r[c["name"]]}|{r[c["date"]]}' for r in data["rows"]}

    entries, missing = [], []
    for path in sorted(glob.glob(os.path.join(a.textdir, "*.txt"))):
        head, shared, sections = read_text(path)
        # 1行目は「# 種別|名前|実装日」か「# 種別|名前|実装日|コミュのタイトル」
        parts = head.removeprefix("# ").strip().split("|")
        key, title = "|".join(parts[:3]), "|".join(parts[3:])
        if key not in known:
            missing.append(key)
            continue
        # 共通部分と、選択肢ごとの続きを別々の項目にする（どの選択肢の続きかを結果に出せるように）
        for choice, lines in [("", shared), *sections.items()]:
            g = grams("\n".join(lines))
            if not g:
                continue
            e = {"key": key, "title": title, "choice": choice,
                 "g": base64.b64encode(b"".join(v.to_bytes(3, "big") for v in g)).decode()}
            entries.append({k: v for k, v in e.items() if v != ""})

    dump_json({"bits": BITS, "n": N, "entries": entries}, a.out, compact=True)
    print(f"{a.out}: {len(entries)}件", file=sys.stderr)
    for k in missing:
        print(f"総覧にない行（キーを確認）: {k}", file=sys.stderr)


if __name__ == "__main__":
    main()
