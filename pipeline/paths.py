"""Repo 內固定路徑。所有指令以 repo 根目錄為基準，不依賴 cwd。"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
REGIONS_JSON = DATA / "regions.json"
SEED_DIR = DATA / "seed"
SPOTS_DIR = DATA / "spots"
SPECIALTIES_DIR = DATA / "specialties"
TIMED_DIR = DATA / "timed"
PHRASES_DIR = DATA / "phrases"
FLIGHTS_JSON = DATA / "flights" / "taiwan_direct.json"
STATE_DIR = DATA / "_state"

WEB = ROOT / "web"
REGIONS_CSS = WEB / "src" / "styles" / "regions.css"
BUNDLES_DIR = WEB / "public" / "bundles"
