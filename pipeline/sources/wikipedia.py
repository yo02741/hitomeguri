"""Wikipedia：導言（簡介與念法）、分類成員與條目連結（觀光地候選）。"""

from __future__ import annotations

from pipeline.http import get_json

SITES = {"jawiki": "ja", "zhwiki": "zh", "enwiki": "en"}


def intro_extracts(site: str, titles: list[str], max_chars: int = 1500) -> dict[str, str]:
    lang = SITES[site]
    api = f"https://{lang}.wikipedia.org/w/api.php"
    out: dict[str, str] = {}
    uniq = list(dict.fromkeys(titles))
    for i in range(0, len(uniq), 20):
        chunk = uniq[i : i + 20]
        params = {
            "action": "query",
            "prop": "extracts",
            "exintro": 1,
            "explaintext": 1,
            "redirects": 1,
            "titles": "|".join(chunk),
            "format": "json",
        }
        if lang == "zh":
            params["variant"] = "zh-tw"
        data = get_json(api, params=params, min_interval=0.3)
        q = data.get("query", {})
        back = {r["to"]: r["from"] for r in q.get("redirects", [])}
        back.update({n["to"]: n["from"] for n in q.get("normalized", [])})
        for page in q.get("pages", {}).values():
            text = (page.get("extract") or "").strip()
            if not text:
                continue
            title = page["title"]
            original = back.get(title, title)
            out[back.get(original, original)] = text[:max_chars]
    return out


def _api(site: str) -> str:
    return f"https://{SITES[site]}.wikipedia.org/w/api.php"


def category_members(site: str, category: str, depth: int = 1) -> list[str]:
    """分類（含子分類，最多 depth 層）底下的條目標題。category 不含「Category:」前綴。"""
    seen_cats: set[str] = set()
    pages: list[str] = []
    frontier = [category]
    for level in range(depth + 1):
        nxt: list[str] = []
        for cat in frontier:
            if cat in seen_cats:
                continue
            seen_cats.add(cat)
            params: dict[str, object] = {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": f"Category:{cat}",
                "cmtype": "page|subcat",
                "cmlimit": "max",
                "format": "json",
            }
            while True:
                data = get_json(_api(site), params=params, min_interval=0.3)
                for m in data.get("query", {}).get("categorymembers", []):
                    if m["ns"] == 0:
                        pages.append(m["title"])
                    elif m["ns"] == 14 and level < depth:
                        nxt.append(m["title"].split(":", 1)[1])
                if "continue" not in data:
                    break
                params.update(data["continue"])
        frontier = nxt
    return list(dict.fromkeys(pages))


def page_links(site: str, title: str) -> list[str]:
    """條目內連到的其他條目（主名字空間）；條目不存在時回傳空清單。"""
    params: dict[str, object] = {
        "action": "query",
        "prop": "links",
        "titles": title,
        "plnamespace": 0,
        "pllimit": "max",
        "redirects": 1,
        "format": "json",
    }
    out: list[str] = []
    while True:
        data = get_json(_api(site), params=params, min_interval=0.3)
        for page in data.get("query", {}).get("pages", {}).values():
            out += [link["title"] for link in page.get("links", [])]
        if "continue" not in data:
            break
        params.update(data["continue"])
    return list(dict.fromkeys(out))


def wikidata_ids(site: str, titles: list[str]) -> dict[str, str]:
    """條目標題 → Wikidata QID（依條目的 wikibase_item 頁面屬性；重新導向會跟隨）。"""
    out: dict[str, str] = {}
    uniq = list(dict.fromkeys(titles))
    for i in range(0, len(uniq), 50):
        chunk = uniq[i : i + 50]
        data = get_json(
            _api(site),
            params={
                "action": "query",
                "prop": "pageprops",
                "ppprop": "wikibase_item",
                "titles": "|".join(chunk),
                "redirects": 1,
                "format": "json",
            },
            min_interval=0.3,
        )
        for page in data.get("query", {}).get("pages", {}).values():
            qid = page.get("pageprops", {}).get("wikibase_item")
            if qid:
                out[page["title"]] = qid
    return out


def page_images(site: str, titles: list[str]) -> dict[str, str]:
    """條目的代表圖片檔名（pageimages，只取自由授權的圖）；標題 → 檔名（不含 File:）。"""
    out: dict[str, str] = {}
    uniq = list(dict.fromkeys(titles))
    for i in range(0, len(uniq), 50):
        chunk = uniq[i : i + 50]
        data = get_json(
            _api(site),
            params={
                "action": "query",
                "prop": "pageimages",
                "piprop": "name",
                "pilicense": "free",
                "titles": "|".join(chunk),
                "redirects": 1,
                "format": "json",
            },
            min_interval=0.3,
        )
        q = data.get("query", {})
        back = {r["to"]: r["from"] for r in q.get("redirects", [])}
        back.update({n["to"]: n["from"] for n in q.get("normalized", [])})
        for page in q.get("pages", {}).values():
            name = page.get("pageimage")
            if name:
                title = page["title"]
                original = back.get(title, title)
                out[back.get(original, original)] = name
    return out


def _batched_pages(site: str, titles: list[str], params: dict[str, object]) -> dict[str, dict]:
    """依標題分批查 prop=…；回傳「原本的標題」→ page（跟隨重新導向；分頁的結果合併）。"""
    out: dict[str, dict] = {}
    uniq = list(dict.fromkeys(titles))
    for i in range(0, len(uniq), 50):
        chunk = uniq[i : i + 50]
        q_params: dict[str, object] = {
            **params,
            "action": "query",
            "titles": "|".join(chunk),
            "redirects": 1,
            "format": "json",
            "formatversion": 2,
        }
        while True:
            data = get_json(_api(site), params=q_params, min_interval=0.3)
            q = data.get("query", {})
            back = {r["to"]: r["from"] for r in q.get("redirects", [])}
            back.update({n["to"]: n["from"] for n in q.get("normalized", [])})
            for page in q.get("pages", []):
                if page.get("missing"):
                    continue
                title = page["title"]
                original = back.get(title, title)
                key = back.get(original, original)
                prev = out.setdefault(key, {"title": title})
                for k, v in page.items():
                    if isinstance(v, list):
                        prev[k] = prev.get(k, []) + v
                    else:
                        prev.setdefault(k, v)
            if "continue" not in data:
                break
            q_params.update(data["continue"])
    return out


def page_categories(site: str, titles: list[str]) -> dict[str, list[str]]:
    """條目的分類（不含隱藏分類，不含「Category:」前綴）。"""
    pages = _batched_pages(
        site, titles, {"prop": "categories", "clshow": "!hidden", "cllimit": "max"}
    )
    return {
        t: [c["title"].split(":", 1)[1] for c in p.get("categories", [])] for t, p in pages.items()
    }


def coordinates(site: str, titles: list[str]) -> dict[str, tuple[float, float]]:
    """條目的主座標（{{coord}} 樣板）；沒有的不列。"""
    pages = _batched_pages(site, titles, {"prop": "coordinates", "coprimary": "primary"})
    out: dict[str, tuple[float, float]] = {}
    for t, p in pages.items():
        coords = p.get("coordinates") or []
        if coords:
            out[t] = (coords[0]["lat"], coords[0]["lon"])
    return out


def qids(site: str, titles: list[str]) -> dict[str, str]:
    """條目標題 → Wikidata QID，key 是傳入的標題（重新導向前）。"""
    pages = _batched_pages(site, titles, {"prop": "pageprops", "ppprop": "wikibase_item"})
    return {
        t: p["pageprops"]["wikibase_item"]
        for t, p in pages.items()
        if p.get("pageprops", {}).get("wikibase_item")
    }
