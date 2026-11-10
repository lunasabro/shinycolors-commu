"""openpyxl で総覧 Excel を安全に編集するためのヘルパー。

openpyxl の insert_rows は、ハイパーリンク・入力規則・条件付き書式・オートフィルター・行の高さを
ずらしてくれない。行の挿入は必ずこのモジュールの insert_rows を使う。
"""
import copy

from openpyxl.formatting.formatting import ConditionalFormattingList
from openpyxl.styles import Font
from openpyxl.worksheet.cell_range import MultiCellRange

from common import COL, NCOLS

LINK_COLOR = "2F4BD8"


def insert_rows(ws, at, n=1, style_from=None):
    """at 行目の前に n 行挿入し、付随する情報もずらす。style_from は挿入後の行番号で数える前の行番号。"""
    last = ws.max_row
    links = {(r, c): ws.cell(r, c).hyperlink.target
             for r in range(at, last + 1) for c in range(1, NCOLS + 1) if ws.cell(r, c).hyperlink}
    heights = {r: ws.row_dimensions[r].height for r in range(at, last + 1)}
    styles = None
    if style_from:
        styles = [copy.copy(ws.cell(style_from, c)._style) for c in range(1, NCOLS + 1)]

    for (r, c) in links:
        ws.cell(r, c).hyperlink = None
    ws.insert_rows(at, n)
    for (r, c), t in links.items():
        ws.cell(r + n, c).hyperlink = t
    for r, h in heights.items():
        ws.row_dimensions[r + n].height = h
    for r in range(at, at + n):
        ws.row_dimensions[r].height = heights.get(at)
        for c in range(1, NCOLS + 1):
            cell = ws.cell(r, c)
            cell.hyperlink = None
            if styles:
                cell._style = copy.copy(styles[c - 1])
    fix_ranges(ws)


def delete_row(ws, r):
    """r 行目を削除し、下の行のハイパーリンク・行の高さを1行上にずらす。"""
    last = ws.max_row
    links = {(rr, c): ws.cell(rr, c).hyperlink.target
             for rr in range(r + 1, last + 1) for c in range(1, NCOLS + 1) if ws.cell(rr, c).hyperlink}
    heights = {rr: ws.row_dimensions[rr].height for rr in range(r + 1, last + 1)}
    for rr in range(r, last + 1):
        for c in range(1, NCOLS + 1):
            ws.cell(rr, c).hyperlink = None
    ws.delete_rows(r, 1)
    for (rr, c), t in links.items():
        ws.cell(rr - 1, c).hyperlink = t
    for rr, h in heights.items():
        ws.row_dimensions[rr - 1].height = h
    fix_ranges(ws)


def fix_ranges(ws):
    """オートフィルター・入力規則・条件付き書式を最終行まで広げる。"""
    m = ws.max_row
    ws.auto_filter.ref = f"A1:I{m}"
    for dv in ws.data_validations.dataValidation:
        col = str(dv.sqref).split(":")[0].rstrip("0123456789")
        dv.sqref = MultiCellRange(f"{col}2:{col}{m}")
    cf = ConditionalFormattingList()
    for rng, rules in ws.conditional_formatting._cf_rules.items():
        col = str(rng.sqref).split(":")[0].rstrip("0123456789")
        for rule in rules:
            cf.add(f"{col}2:{col}{m}", rule)
    ws.conditional_formatting = cf


def set_link(ws, r, url):
    cell = ws.cell(r, COL["link"])
    if not url:
        cell.value = None
        cell.hyperlink = None
        return
    cell.value = "開く"
    cell.hyperlink = url
    f = cell.font
    cell.font = Font(name=f.name, sz=f.sz, color=LINK_COLOR, underline="single")


def get_link(ws, r):
    cell = ws.cell(r, COL["link"])
    return cell.hyperlink.target if cell.hyperlink else ""
