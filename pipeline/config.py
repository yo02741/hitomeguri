"""可調整的參數（精選分數權重、數量上限等）。"""

# 每縣最多收錄的大點數，以及精選數量。
MAX_SPOTS_PER_PREF = 400
FEATURED_PER_PREF = 20

# Wikidata 候選：有文化指定且 sitelinks 至少這麼多（排除大量登錄有形文化財的附屬建物）。
MIN_SITELINKS_HERITAGE = 3

# 瀏覽量權重：服務對象是台灣旅客，中文維基權重較高。
PAGEVIEW_WEIGHTS = {"jawiki": 1.0, "zhwiki": 3.0, "enwiki": 2.0}
PAGEVIEW_FACTOR = 12.0
SITELINK_FACTOR = 1.5

# 文化指定加分：以指定項目的日文標籤比對（第一個命中的關鍵字決定標籤與分數）。
HERITAGE_RULES: list[tuple[str, str, float]] = [
    ("世界遺産", "世界遺產", 25.0),
    ("国宝", "國寶", 10.0),
    ("特別名勝", "特別名勝", 8.0),
    ("特別史跡", "特別史跡", 8.0),
    ("重要文化財", "重要文化財", 3.0),
    ("名勝", "名勝", 3.0),
    ("史跡", "史跡", 3.0),
]
HERITAGE_BONUS_CAP = 35.0

# 攻略種子清單的加分（PLAN.md §5.0）；S 級一律列入精選。
GUIDE_TIER_BONUS = {"S": 30.0, "A": 12.0}

# 最近車站
STATION_MAX_DISTANCE_M = 1500
STATION_MAX_COUNT = 2

# 去重：座標距離與附屬建物合併距離
DEDUPE_DISTANCE_M = 80
SUBPART_DISTANCE_M = 500

# 精選的分類上限（其餘分類用預設值）
FEATURED_CATEGORY_CAP = {"寺院": 8, "神社": 6, "古墳": 2, "城": 4, "": 6}
FEATURED_CATEGORY_CAP_DEFAULT = 4

# 每縣每主題最多收錄的小店數（依資料完整度排序）
THEME_SPOTS_PER_PREF = {"tea": 80, "sake": 80, "ramen": 150, "onsen": 120, "pokemon": 20}
