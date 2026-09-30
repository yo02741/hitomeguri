"""日本100名城・続日本100名城：日文維基百科的一覽表。

表格每列是一座城：名城番號、城名（連到城的條目）、所在地、スタンプ設置場所、備考。
所在地欄有 rowspan，欄數不固定，所以スタンプ設置場所取「倒數第二欄」。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from pipeline.http import get_json

API = "https://ja.wikipedia.org/w/api.php"
# (組別, 條目)
PAGES = [("100", "日本100名城"), ("zoku", "続日本100名城")]


@dataclass
class Castle:
    no: int
    group: str
    title: str  # 城的條目標題（連結目標）
    name: str  # 表格上顯示的城名
    stamp: list[str] = field(default_factory=list)
    page: str = ""

    @property
    def url(self) -> str:
        return f"https://ja.wikipedia.org/wiki/{self.page}"


def wikitext(page: str) -> str:
    data = get_json(
        API,
        params={
            "action": "parse",
            "prop": "wikitext",
            "page": page,
            "format": "json",
            "formatversion": 2,
        },
        min_interval=1.0,
    )
    return data["parse"]["wikitext"]


NO_VALUE = re.compile(r"^(?:\{\{(?:center|nowrap)\|\s*)?(\d{1,3})\s*(?:\}\})?$")
# 欄位開頭的屬性（rowspan="2"|、nowrap|、style="…"|）
ATTRS = re.compile(r'^\s*(?:[a-z\-]+(?:\s*=\s*(?:"[^"]*"|[^\s|"]+))?\s*)+$')
LINK = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]")


def _strip_templates(text: str, names: tuple[str, ...]) -> str:
    """移除指定的樣板（含巢狀的大括號），例如註腳 {{Efn|…}}。"""
    out = text
    for name in names:
        while True:
            i = out.find("{{" + name)
            if i < 0:
                break
            depth, j = 0, i
            while j < len(out):
                if out.startswith("{{", j):
                    depth += 1
                    j += 2
                elif out.startswith("}}", j):
                    depth -= 1
                    j += 2
                    if depth == 0:
                        break
                else:
                    j += 1
            out = out[:i] + out[j:]
    return out


def clean(text: str) -> str:
    """wiki 標記 → 純文字：連結取顯示文字，去掉粗體、nowrap、ref。"""
    t = _strip_templates(text, ("Efn", "efn", "Refnest", "refnest"))
    t = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    t = LINK.sub(lambda m: m.group(2) or m.group(1), t)
    t = re.sub(r"\{\{nowrap\|([^{}]*)\}\}", r"\1", t)
    t = t.replace("'''", "").replace("''", "")
    return re.sub(r"\s+", " ", t).strip()


def _cell_value(line: str) -> str:
    """表格欄位（| 或 ! 開頭）的一行：去掉開頭符號與屬性（rowspan=2|、nowrap|）。"""
    body = line[1:]
    if body.startswith(("|", "!")):  # 「|| 內容」：空屬性
        body = body[1:]
    head, sep, rest = body.partition("|")
    if sep and "[[" not in head and "{{" not in head and ATTRS.match(head):
        body = rest
    return body.strip()


def stamp_places(cell: str) -> list[str]:
    """スタンプ設置場所：plainlist 的每一項，或整欄一項。"""
    body = cell.strip()
    m = re.match(r"^\{\{\s*plainlist\s*\|(.*)\}\}\s*$", body, flags=re.S | re.I)
    if m:
        body = m.group(1)
    items = [x for x in re.split(r"\n\s*\*\s*|<br\s*/?>", "\n" + body) if x.strip()]
    return [c for c in (clean(x) for x in items) if c]


def parse(wikitext: str, group: str, page: str) -> list[Castle]:
    out: list[Castle] = []
    rows = re.split(r"^\|-.*$|^\|\}.*$", wikitext, flags=re.M)
    for row in rows:
        lines = row.strip("\n").split("\n")
        no: int | None = None
        header: str | None = None
        cells: list[str] = []
        for line in lines:
            if no is None:
                m = NO_VALUE.match(_cell_value(line)) if line.startswith("|") else None
                if m:
                    no = int(m.group(1))
                continue
            if header is None and line.startswith("!"):
                header = line
                continue
            if header is None:
                continue
            if line.startswith("|"):
                cells.append(_cell_value(line))
            elif cells:
                cells[-1] += "\n" + line
        if no is None or header is None:
            continue
        link = LINK.search(header)
        if not link:
            continue
        title = link.group(1).strip()
        # 顯示名稱取整格：「品川[[台場]]」「[[出石城]]・[[有子山城]]」
        name = clean(re.sub(r"<br\s*/?>", "", _cell_value(header)))
        stamp = stamp_places(cells[-2]) if len(cells) >= 2 else []
        out.append(Castle(no=no, group=group, title=title, name=name, stamp=stamp, page=page))
    return out


def castles() -> list[Castle]:
    out: list[Castle] = []
    for group, page in PAGES:
        out += parse(wikitext(page), group, page)
    return out
