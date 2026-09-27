"""Wikipedia 導言（純文字），作為 LLM 摘要的依據。"""

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
