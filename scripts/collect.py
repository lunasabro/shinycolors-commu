"""ブラウザ連携ツールの結果ファイル（または貼り付けたテキスト）から window.__out の中身を復元する。

使い方:
  python scripts/collect.py -o work/wiki.json <結果ファイル1> [<結果ファイル2> ...]
  python scripts/collect.py --webp -o sprites/sheets/n1.webp <結果ファイル...>   # スプライト画像のとき

結果ファイルは、ツール結果が長すぎて保存された .txt（[{"type":"text","text":...}] 形式）か、
返ってきた文字列をそのまま保存したテキストのどちらでもよい。chunk.js で取り出した順に並べる。
"""
import argparse
import base64
import json


def read_part(path):
    raw = open(path, encoding="utf-8").read()
    try:
        obj = json.loads(raw)
        if isinstance(obj, list) and obj and isinstance(obj[0], dict) and "text" in obj[0]:
            raw = obj[0]["text"]
    except json.JSONDecodeError:
        pass
    raw = raw.split("\n\n(captured at origin")[0].strip()
    if "[truncated" in raw:
        raise SystemExit(f"{path}: 途中で切り捨てられています。chunk.js でもっと小さく分けて取り直してください。")
    if raw.startswith('"'):
        raw = json.loads(raw)
    return raw


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("parts", nargs="+")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--webp", action="store_true", help="data URL を画像ファイルとして保存する")
    a = ap.parse_args()
    s = "".join(read_part(p) for p in a.parts)
    if a.webp:
        open(a.out, "wb").write(base64.b64decode(s.split(",", 1)[1]))
    else:
        json.loads(s)  # 壊れていないか確認
        open(a.out, "w", encoding="utf-8").write(s)
    print(f"wrote {a.out} ({len(s)} chars)")


if __name__ == "__main__":
    main()
