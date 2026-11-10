"""make_sprite.js で作ったスプライト画像を sprites/ に登録する。

使い方:
  python scripts/register_sprite.py work/sprite.webp --plan work/sprite_plan.json --site brilliant [--failed 3,7]

sprites/sheets/n<連番>.webp として保存し、plan の各項目（カードページURL）を registry.json に登録する。
--failed には make_sprite.js が返した failed の番号を渡す（その項目は登録しない）。
"""
import argparse
import os
import shutil
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from common import dump_json, load_json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("webp")
    ap.add_argument("--plan", required=True)
    ap.add_argument("--site", required=True, choices=["brilliant", "gamedbs"])
    ap.add_argument("--failed", default="")
    a = ap.parse_args()

    items = load_json(a.plan)[a.site]
    failed = {int(x) for x in a.failed.split(",") if x.strip()}
    reg_path = os.path.join(ROOT, "sprites", "registry.json")
    reg = load_json(reg_path)
    n = 1 + max([int(k[1:]) for k in reg["sheets"] if k.startswith("n")] or [0])
    name = f"n{n}"
    h = Image.open(a.webp).size[1]
    shutil.copy(a.webp, os.path.join(ROOT, "sprites", "sheets", f"{name}.webp"))
    reg["sheets"][name] = h // reg["tile"][1]
    for i, it in enumerate(items):
        if i not in failed:
            reg["images"][it["link"]] = [name, i]
    dump_json(reg, reg_path)
    print(f"registered {name}: {len(items) - len(failed)} images (failed {sorted(failed)})")


if __name__ == "__main__":
    main()
