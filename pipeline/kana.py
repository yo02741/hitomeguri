"""假名處理：片假名轉平假名、平假名轉羅馬拼音（修正式平文式，長音不加符號）。

只用在「已有正確假名」時產生羅馬拼音，不做漢字轉假名（那需要結構化來源或 LLM）。
"""

from __future__ import annotations

import re
import unicodedata

_DIGRAPHS = {
    "きゃ": "kya",
    "きゅ": "kyu",
    "きょ": "kyo",
    "しゃ": "sha",
    "しゅ": "shu",
    "しょ": "sho",
    "ちゃ": "cha",
    "ちゅ": "chu",
    "ちょ": "cho",
    "にゃ": "nya",
    "にゅ": "nyu",
    "にょ": "nyo",
    "ひゃ": "hya",
    "ひゅ": "hyu",
    "ひょ": "hyo",
    "みゃ": "mya",
    "みゅ": "myu",
    "みょ": "myo",
    "りゃ": "rya",
    "りゅ": "ryu",
    "りょ": "ryo",
    "ぎゃ": "gya",
    "ぎゅ": "gyu",
    "ぎょ": "gyo",
    "じゃ": "ja",
    "じゅ": "ju",
    "じょ": "jo",
    "びゃ": "bya",
    "びゅ": "byu",
    "びょ": "byo",
    "ぴゃ": "pya",
    "ぴゅ": "pyu",
    "ぴょ": "pyo",
    "ぢゃ": "ja",
    "ぢゅ": "ju",
    "ぢょ": "jo",
    "しぇ": "she",
    "ちぇ": "che",
    "じぇ": "je",
    "ふぁ": "fa",
    "ふぃ": "fi",
    "ふぇ": "fe",
    "ふぉ": "fo",
    "てぃ": "ti",
    "でぃ": "di",
    "うぃ": "wi",
    "うぇ": "we",
    "うぉ": "wo",
}
_MONO = dict(
    zip(
        "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん"
        "がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉゃゅょゎゔ",
        [
            "a",
            "i",
            "u",
            "e",
            "o",
            "ka",
            "ki",
            "ku",
            "ke",
            "ko",
            "sa",
            "shi",
            "su",
            "se",
            "so",
            "ta",
            "chi",
            "tsu",
            "te",
            "to",
            "na",
            "ni",
            "nu",
            "ne",
            "no",
            "ha",
            "hi",
            "fu",
            "he",
            "ho",
            "ma",
            "mi",
            "mu",
            "me",
            "mo",
            "ya",
            "yu",
            "yo",
            "ra",
            "ri",
            "ru",
            "re",
            "ro",
            "wa",
            "o",
            "n",
            "ga",
            "gi",
            "gu",
            "ge",
            "go",
            "za",
            "ji",
            "zu",
            "ze",
            "zo",
            "da",
            "ji",
            "zu",
            "de",
            "do",
            "ba",
            "bi",
            "bu",
            "be",
            "bo",
            "pa",
            "pi",
            "pu",
            "pe",
            "po",
            "a",
            "i",
            "u",
            "e",
            "o",
            "ya",
            "yu",
            "yo",
            "wa",
            "vu",
        ],
        strict=True,
    )
)


def to_hiragana(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    out = []
    for ch in text:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            out.append(chr(code - 0x60))
        else:
            out.append(ch)
    return "".join(out)


def is_kana(text: str) -> bool:
    t = re.sub(r"[\s・ー\-]", "", to_hiragana(text))
    return bool(t) and all("ぁ" <= c <= "ゖ" for c in t)


def normalize_kana(text: str) -> str:
    """表記用假名：平假名、去掉空白與中黑。"""
    return re.sub(r"[\s・]", "", to_hiragana(text))


def to_romaji(kana: str) -> str:
    """平假名 → 小寫羅馬拼音（無空白）；長音 ou/oo/uu 收斂成單一母音。"""
    s = normalize_kana(kana)
    out: list[str] = []
    i = 0
    while i < len(s):
        pair = s[i : i + 2]
        if pair in _DIGRAPHS:
            out.append(_DIGRAPHS[pair])
            i += 2
            continue
        ch = s[i]
        if ch == "っ":
            nxt = s[i + 1 : i + 3]
            roma = _DIGRAPHS.get(nxt) or _MONO.get(s[i + 1 : i + 2], "")
            if roma:
                out.append("t" if roma.startswith("ch") else roma[0])
            i += 1
            continue
        if ch == "ー":
            i += 1
            continue
        if ch == "ん":
            nxt = _MONO.get(s[i + 1 : i + 2], "")
            out.append("n'" if nxt[:1] in ("a", "i", "u", "e", "o", "y") else "n")
            i += 1
            continue
        out.append(_MONO.get(ch, ch))
        i += 1
    roma = "".join(out)
    roma = re.sub(r"ou", "o", roma)
    roma = re.sub(r"oo", "o", roma)
    roma = re.sub(r"uu", "u", roma)
    return roma


def romaji_with_spacing(kana: str, hint: str | None) -> str:
    """用英文標籤的斷詞方式排版羅馬拼音（例：Fushimi Inari Taisha）；對不上就回傳首字大寫的單詞。"""
    base = to_romaji(kana).replace("'", "")
    if hint:
        letters = re.sub(r"[^a-z]", "", unicodedata.normalize("NFKD", hint).lower())
        if letters == base:
            words = re.findall(r"[A-Za-z]+", unicodedata.normalize("NFKD", hint))
            return " ".join(w.capitalize() for w in words)
    return base.capitalize()
