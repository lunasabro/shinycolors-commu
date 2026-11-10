"""総覧スクリプト共通の定数とヘルパー。"""
import datetime
import difflib
import json
import re
import unicodedata

# ---- ユニット構成（data.json の meta.units としてサイトにも渡す） ----------------
UNITS = {
    "イルミネーションスターズ": ["櫻木真乃", "風野灯織", "八宮めぐる"],
    "アンティーカ": ["月岡恋鐘", "田中摩美々", "白瀬咲耶", "三峰結華", "幽谷霧子"],
    "放課後クライマックスガールズ": ["小宮果穂", "園田智代子", "西城樹里", "杜野凛世", "有栖川夏葉"],
    "アルストロメリア": ["大崎甘奈", "大崎甜花", "桑山千雪"],
    "ストレイライト": ["芹沢あさひ", "黛冬優子", "和泉愛依"],
    "ノクチル": ["浅倉透", "樋口円香", "福丸小糸", "市川雛菜"],
    "シーズ": ["七草にちか", "緋田美琴"],
    "コメティック": ["斑鳩ルカ", "鈴木羽那", "郁田はるき"],
}
UNIT_OF = {m: u for u, ms in UNITS.items() for m in ms}

# ---- 区分 ---------------------------------------------------------------
# wiki の「ガシャ種別」→ 総覧の区分
GACHA_TO_COLL = {
    "トワコレ": "トワイライツコレクション",
    "マイコレ": "My Songs Collection",
    "パラコレ": "パラレルコレクション",
    "プレコレ": "プレリュードコレクション",
    "キャスコレ": "キャスティングコレクション",
    "AXE8": "AXE8",
    "限定-誕": "誕生日限定",
}
WIKI_COLLS = set(GACHA_TO_COLL.values())
# サイトの区分の並び順（data.json の meta.collections としてサイトにも渡す）
COLLECTIONS = [
    "トワイライツコレクション", "My Songs Collection", "パラレルコレクション", "ワーキングスナップ",
    "誕生日限定", "プレリュードコレクション", "キャスティングコレクション", "シャニマスファンタジー", "AXE8",
]
# wiki に種別がなく、BRILLI@NT の区分タグから付けるもの
BRILLIANT_ONLY_COLLS = {"シャニマスファンタジー", "ワーキングスナップ"}

# ---- 種別 ---------------------------------------------------------------
P, S = "プロデュースアイドル", "サポートアイドル"
EVENT, SCENARIO = "イベントシナリオ", "プロデュースシナリオ"
CARD_KINDS = (P, S)
KIND_OF = {"P": P, "S": S}

# ---- Excel の列（1始まり） ---------------------------------------------
COL = dict(tags=1, kind=2, rarity=3, name=4, date=5, must=6, memo=7, coll=8, link=9)
NCOLS = 9

# ---- 正規化と照合 -------------------------------------------------------
_PUNCT = r"[\s　・･\-‐－~～〜「」『』!！?？.,、。'’─―*]"


def norm(s):
    """表記ゆれを吸収した比較用文字列。"""
    return re.sub(_PUNCT, "", unicodedata.normalize("NFKC", str(s or ""))).lower()


def similar(a, b):
    return difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()


def best_match(name, candidates, get_name, threshold=0.8):
    """完全一致（正規化後）を優先し、なければ類似度 threshold 以上で最良のもの。"""
    n = norm(name)
    for c in candidates:
        if norm(get_name(c)) == n:
            return c
    scored = [(similar(name, get_name(c)), c) for c in candidates]
    scored = [x for x in scored if x[0] >= threshold]
    return max(scored, key=lambda x: x[0])[1] if scored else None


def split_tags(v):
    return [t.strip() for t in re.split("[、,，]", str(v or "")) if t.strip()]


def people_of(tags, known_idols=None):
    """タグ（ユニット名・アイドル名）を登場アイドルの集合に展開する。"""
    out = set()
    for t in tags:
        if t in UNITS:
            out |= set(UNITS[t])
        elif t in UNIT_OF or (known_idols and t in known_idols):
            out.add(t)
    return out


def to_date(v):
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, datetime.date):
        return v
    if isinstance(v, str) and v:
        return datetime.date.fromisoformat(v.replace("/", "-")[:10])
    return None


def iso(v):
    d = to_date(v)
    return d.isoformat() if d else ""


def image_of(images, url):
    """registry.json の images から画像を引く。Excel が URL を %エンコードし直すことがあるので両方試す。"""
    if not url:
        return None
    from urllib.parse import quote, unquote
    for u in (url, unquote(url), quote(unquote(url), safe=":/%")):
        if u in images:
            return images[u]
    return None


def load_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def dump_json(obj, path, compact=False):
    with open(path, "w", encoding="utf-8") as f:
        if compact:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, f, ensure_ascii=False, indent=1)
