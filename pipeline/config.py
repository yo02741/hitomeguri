"""可調整的參數（精選分數權重、數量上限等）。"""

import re

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

# 列在日文維基「{縣}の観光地」分類／清單條目裡的地點（人工整理的觀光地）加分，
# 讓沒有文化指定的熱門地點（國際通、瀨長島、購物中心、市場）也進得了前段
TOURISM_LIST_BONUS = 18.0
TOURISM_CATEGORY_DEPTH = 2

# 縣的官方觀光網站熱門排行（目前：沖繩 おきなわ物語）。取前 N 名，排名越前加分越多。
OFFICIAL_TOP_N = 400
# 官方網站的熱門排名是「旅客實際在看什麼」最直接的訊號：排名第 1 加 OFFICIAL_BONUS_MAX，
# 第 N 名加 OFFICIAL_BONUS_MIN（沒有維基條目的購物中心、市場也能進前段）
OFFICIAL_BONUS_MAX = 80.0
OFFICIAL_BONUS_MIN = 20.0
# 官方網站上的地點併入既有候選：名稱相同的距離上限
OFFICIAL_MATCH_DISTANCE_M = 2000
# 這些類型的官方條目不是景點（住宿、租車、旅行社）
OFFICIAL_EXCLUDE_CATEGORY = ("宿泊", "ホテル", "レンタカー", "レンタル", "旅行会社", "交通")
# 官方熱門清單裡的活動與季節花況（名稱判斷）
OFFICIAL_EXCLUDE_NAME_RE = re.compile(
    r"(^【[^】]+】|祭り?$|まつり|フェスタ|フェスティバル|花火|ライトアップ|イルミネーション|"
    r"の(桜|彼岸花|紅葉|コスモス|ひまわり|菜の花|藤|梅|あじさい|つつじ|ツツジ|アジサイ|ヒマワリ)$)"
)
# 其他類型的維基分類（{name} 換成縣名）：收進候選但不加分，靠瀏覽量排序；
# 分類不存在時 API 回傳空清單，不影響
EXTRA_CATEGORIES = [
    "{name}のショッピングセンター",
    "{name}の商業施設",
    "{name}の市場",
    "{name}の漁港",
    "{name}の島",
    "{name}の橋",
    "{name}の岬",
    "{name}の海水浴場",
    "{name}の商店街",
]

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
THEME_SPOTS_PER_PREF = {"tea": 80, "sake": 80, "ramen": 150, "onsen": 120}

# OSM 物件與 Wikidata 任一語言標籤相同時的合併距離（城郭、公園範圍大）
LABEL_MERGE_DISTANCE_M = 1200
