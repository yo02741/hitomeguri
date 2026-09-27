# ひとめぐり（一巡り／HITOMEGURI）

來一趟日本，才知道它有多大。

日本景點主題地圖與旅前準備：先排必去大點，再用主題（茶、酒、香、溫泉、拉麵、寶可夢、御朱印）塞小點；附期間限定、台灣直飛、行程匯出 Google Maps、地名念法與情境日文、旅行紀錄。

## 文件

| 檔案 | 內容 |
|---|---|
| `PLAN.md` | 開發規格：技術棧、資料 pipeline、資料模型、開發階段、工作規則、文案原則 |
| `UX-FLOW.md` | 資訊架構、地區色規則、User Stories、UI flow、路由 |
| `DESIGN.md` | UI 設計準則與 Tailwind 元件配方 |
| `CLAUDE.md` | 給 Claude Code 的專案規則 |

## 結構

```
data/            景點目錄等主資料（JSON，source of truth）
pipeline/        Python 資料 pipeline（採集、去重、LLM 補全、驗證、產生 bundle）
web/             Vue 3 + Vite + TypeScript 前端
firebase.json    Hosting + Firestore（Spark 免費方案；不用 Functions / Storage）
```

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
.venv/bin/pytest -q
```

`npm run dev` 時前端預設連本機 emulator；正式 build 一律連真實 Firebase 專案。

## 資料出處

- 景點：Wikidata（CC0）、OpenStreetMap contributors（ODbL）
- 照片：Wikimedia Commons，各張依原作者與授權標示於景點卡片
- 縣界：出典：地球地図日本（国土地理院），經 dataofjapan/land 轉為 GeoJSON 後簡化
- 底圖：OpenFreeMap（OpenStreetMap）
