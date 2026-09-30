# ひとめぐり（一巡り／HITOMEGURI）

**網站**：[Firebase Hosting](https://hitomeguri-7d87a.web.app/) ・ [GitHub Pages](https://yo02741.github.io/hitomeguri/)

來一趟日本，才知道它有多大。

日本景點地圖與旅前準備：先排必去的景點，再用擴充包找值得專程去的小點，出發前整理好行程、念法與會用到的日文。

## 功能

- **探索**：47 縣的景點地圖。
  - 景點卡片有照片、假名／漢字／羅馬拼音、最近車站和維基百科簡介。
  - 可依類型篩選，也能用日文、假名、中文、羅馬拼音搜尋。
  - 地區頁一律顯示鐵路路線與車站。
- **擴充包**：
  - 寶可夢（人孔蓋、寶可夢中心與商店）
  - 城（日本100名城・続日本100名城，名城番號與スタンプ設置場所）
  - 老舖・茶屋（香舖、和菓子、茶舖、茶屋・甘味處）
  - 角色商店
- **深度探索**：各縣的季節（花期月曆）、祭典、地區特色（郷土料理、特色拉麵）、期間限定。
- **期間限定**：氣象廳的櫻花、紅葉觀測，每天自動更新；連鎖店的限定品提供快捷搜尋與截圖收藏。
- **收藏與紀錄**：收藏、去過（含日期）、自訂清單。
  - 旅行紀錄地圖。
  - 匯出 KML、CSV、Google Maps 連結。
- **行程**：
  - 把景點排進每一天，也可以用邀請連結和旅伴共編。
  - 出發前的旅前準備：地名念法、情境會話、練習卡。
  - 旅前小書，可列印或存成 PDF。

## 部署

| 位置 | 網址 | 部署方式 |
|---|---|---|
| Firebase Hosting | https://hitomeguri-7d87a.web.app/ | 推送 `main` 時由 `.github/workflows/firebase-hosting.yml` 部署（只部署 Hosting） |
| GitHub Pages | https://yo02741.github.io/hitomeguri/ | 推送 `main` 時由 `.github/workflows/pages.yml` 部署 |

- Firestore 規則（`firestore.rules`）不會自動部署，修改後要貼到 Firebase Console 發布。
- 只用 Firebase 的免費方案（Spark）：Hosting、Firestore、Auth；不用 Functions、Storage。

## 文件

| 檔案 | 內容 |
|---|---|
| `PLAN.md` | 開發規格：技術棧、資料 pipeline、資料模型、開發階段、工作規則、文案原則 |
| `UX-FLOW.md` | 資訊架構、地區色規則、User Stories、UI flow、路由 |
| `DESIGN.md` | UI 設計準則與 Tailwind 元件配方 |
| `CLAUDE.md` | 給 Claude Code 的專案規則 |
| `TODO.md` | 需要使用者做的事、已知限制、之後的想法 |
| `docs/PROGRESS.md` | 目前狀態與開發紀錄 |
| `docs/*驗收.md` | 各階段與各次修改的驗收說明 |
| `docs/設計質感研究.md` | 動畫、紋樣、收集卡等設計研究 |

## 結構

```
data/            主資料（JSON，source of truth；景點、擴充包、地區特色、祭典、鐵路、期間限定、會話）
pipeline/        Python 資料 pipeline（採集、對齊、資料檢查、變更報告、產生 bundle）
web/             Vue 3 + Vite + TypeScript + Tailwind v4 + MapLibre 前端
docs/            狀態、驗收說明與研究
.github/         CI、部署、資料採集與排程的 workflow
firebase.json    Hosting + Firestore + Auth
```

## 資料怎麼更新

外部資料的採集都在 GitHub Actions 上跑。

- **自動**（`refresh-data.yml`）：採集完推到 `pipeline/refresh-<編號>` 分支並開 PR，PR 描述附變更報告與資料檢查結果，合併後自動部署。
  - 每週一：寶可夢、城、祭典。
  - 每月第一週：再加老舖、角色商店、地區特色、各縣維基簡介。
  - 每季第一週：再加各縣景點重採。
- **每天**（`harvest-timed.yml`）：期間限定，有變更直接提交 `main`。
- **手動**（`seed-region.yml`、`seed-pack.yml`）：推到 `pipeline/*` 分支，檢查後合併。

## 本機開發

需要 Node 22、Python 3.11、uv、Java 17+（Firebase Emulator）。

```bash
# 前端
cd web && npm install
cp .env.example .env.local        # 填 Firebase Web 設定；只用 emulator 時可先留空
npm run dev                       # http://localhost:5173

# Firebase Emulator（Auth + Firestore），另開一個終端
npx firebase emulators:start --project demo-hitomeguri --only auth,firestore

# pipeline
uv venv && uv pip install -e ".[dev]"
.venv/bin/python -m pipeline.cli build-region-css   # 由 data/regions.json 重新產生 regions.css
.venv/bin/python -m pipeline.cli build-bundles      # data/ → web/public/bundles/
.venv/bin/python -m pipeline.cli validate-data      # 資料檢查
.venv/bin/ruff check pipeline && .venv/bin/pytest -q
```

`npm run dev` 時前端預設連本機 emulator；正式 build 一律連真實的 Firebase 專案。

## 資料出處

- 景點：Wikidata（CC0）、OpenStreetMap contributors（ODbL）
- 照片：Wikimedia Commons，各張依原作者與授權標示於卡片
- 簡介與部分念法：維基百科（中文、日文、英文）開頭段落，CC BY-SA 4.0，卡片標示出處條目；中文經 OpenCC 做簡繁字元轉換，英文簡介另有中文翻譯
- 郷土料理：農林水產省「うちの郷土料理」（公共データ利用規約 第1.0版）
- 季節與期間限定：氣象廳 生物季節観測（公共データ利用規約 第1.0版）
- 祭典、特色拉麵、100 名城、老舖：日文維基百科的分類與一覽條目（CC BY-SA 4.0）
- 寶可夢人孔蓋：ポケモンローカルActs 官方頁面（只存名稱、位置與連結，不使用圖片）
- 縣界：出典：地球地図日本（国土地理院），經 dataofjapan/land 轉為 GeoJSON 後簡化
- 底圖：OpenFreeMap（OpenStreetMap）
