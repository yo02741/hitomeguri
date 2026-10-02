"""Repo 內固定路徑。所有指令以 repo 根目錄為基準，不依賴 cwd。"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
REGIONS_JSON = DATA / "regions.json"
SEED_DIR = DATA / "seed"
# 縣官方觀光網站的景點清單（seed-official）
OFFICIAL_DIR = SEED_DIR / "official"
SPOTS_DIR = DATA / "spots"
SPECIALTIES_DIR = DATA / "specialties"
# 擴充包（寶可夢人孔蓋等全國性的小點），一個擴充包一個檔案
PACKS_DIR = DATA / "packs"
TIMED_DIR = DATA / "timed"
# 鐵路路線圖層（OSM）
RAIL_DIR = DATA / "rail"
# 深度探索「祭典」：日文維基分類
FESTIVALS_DIR = DATA / "festivals"
# 深度探索「季節」：氣象廳生物季節平年值
SEASONS_JSON = DATA / "seasons.json"
PHRASES_DIR = DATA / "phrases"
FLIGHTS_JSON = DATA / "flights" / "taiwan_direct.json"
STATE_DIR = DATA / "_state"

WEB = ROOT / "web"
REGIONS_CSS = WEB / "src" / "styles" / "regions.css"
THEME_COLORS_JSON = WEB / "src" / "styles" / "theme-colors.json"
BUNDLES_DIR = WEB / "public" / "bundles"
GEO_JSON = WEB / "public" / "geo" / "prefectures.json"
CACHE_DIR = ROOT / "pipeline" / ".cache"
