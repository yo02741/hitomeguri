# ひとめぐり — 給 Claude Code 的專案規則

產品：ひとめぐり（一巡り／HITOMEGURI），日本景點主題地圖與旅前準備。標語「來一趟日本，才知道它有多大。」

## 先讀哪些文件
- `PLAN.md`：開發規格、資料 pipeline、資料模型、開發階段與驗收條件（§9）。
- `UX-FLOW.md`：資訊架構、路由、地區色決定規則、User Stories、UI flow。前端實作以此為準。
- `DESIGN.md`：視覺規格、Tailwind token、元件配方。與 PLAN.md 衝突時前端以 UX-FLOW / DESIGN 為準。
- 視覺 mockup：https://claude.ai/artifact/L6mTRQ4a9c44uNik145pS5 的「v7 定稿」頁。

## 工作規則（PLAN.md §11）
- 一次只做一個 Phase；每個 Phase 結束時總結做了什麼、還缺什麼，等使用者確認再繼續。
- **不得引入任何需要 Firebase Blaze 方案的服務**（Cloud Functions、Cloud Storage、Extensions 等）；需要後端運算一律用 GitHub Actions 或本機 script。
- 開發與測試一律使用 Firebase Emulator；**未經使用者同意不要執行 `firebase deploy`**。靜態站台由 Actions 部署：Firebase Hosting（https://hitomeguri-7d87a.web.app/ ，`firebase-hosting.yml`，使用者同意推 main 就部署；只部署 Hosting）與 GitHub Pages（`pages.yml`）。
- 任何 API key、service account 不可 commit；本機用 `.env` / `.env.local`（已在 .gitignore），CI 用 GitHub Actions secrets 或 variables。前端不得包含 Claude API key。
- 外部資料採集：遵守各站 robots.txt 與使用條款、設定合理 rate limit 與 User-Agent；不爬 traveldoko、Google Maps、食べログ。
- 每筆資料都要保留來源 URL 與取得時間。**不用 LLM 產生網路上沒有的內容**（使用者決定）：簡介、念法等一律取自實際來源（維基百科、Wikidata、OSM…），沒有就留空。LLM 只用於查證、擷取與翻譯實際來源的原文（例：帶 web search 查航線；英文簡介翻成繁體中文，介面英文一行、中文一行，`translate-summaries`），不自己寫介紹；結果必須附來源 URL。這類工作在 Actions 上跑，需要 `ANTHROPIC_API_KEY` secret。
- 使用 LLM 查證時先用小量資料（例 20 筆）驗證 prompt 與輸出 schema，再跑整批；記錄 token 用量並寫進 PR 描述。
- `data/` 的 JSON 以穩定順序（依 id 排序）與固定縮排輸出，讓 PR diff 可讀。
- **UI 文案遵守 PLAN.md §6a「不要有 AI 味」**：不把設計理由、功能說明寫進介面；不加 onboarding 說明卡、emoji、sparkle 圖示、「AI」標記、驚嘆號。寫任何 UI 文字前先問：車站標示或旅遊書會這樣寫嗎？
- LLM 生成的簡介與詞彙說明遵守 §6a 文風規則，並做禁用詞檢查。
- 樣式只用 `DESIGN.md` 定義的 token 與元件配方；不得寫死色碼。`regions.css` 由 `python -m pipeline.cli build-region-css` 從 `data/regions.json` 產生，不可手改。
- Python 用 type hints + pydantic；前端用 TypeScript strict。
- 不確定的外部 API 細節（網址、參數、額度、model string）先查官方文件再實作，不要猜。

## 常用指令
```bash
cd web && npm run dev                 # 前端（預設連本機 emulator）
cd web && npm run typecheck && npm run build
npx firebase emulators:start --project demo-hitomeguri --only auth,firestore
uv venv && uv pip install -e ".[dev]" # pipeline 環境
.venv/bin/python -m pipeline.cli build-region-css
.venv/bin/python -m pipeline.cli build-bundles          # data/spots → web/public/bundles（gitignore）
.venv/bin/ruff check pipeline && .venv/bin/pytest -q
```

## 資料 pipeline 在 GitHub Actions 上跑
Claude Code 的雲端沙箱連不到 Wikidata、OSM、Wikimedia，也沒有 Claude API key，所以採集與補全放在 Actions：
- `seed-region.yml`（手動）：輸入縣 slug，各縣平行採集，結果推到 `pipeline/seed-<run>` 分支。command=seed-region 會連同維基百科簡介與念法一起做；seed-wiki 只更新已有大點的縣的簡介與念法（`pipeline/wiki.py`）。
- `harvest-timed.yml`（每天 17:50 JST＋手動）：期間限定（氣象廳本季觀測，`pipeline/timed.py`）。只改 `data/timed/`，有變更直接提交 main 並觸發 Firebase Hosting、Pages 部署（例外：不走 pipeline/* 審核分支）。
- `verify-flights.yml`（手動，需 `ANTHROPIC_API_KEY` secret）：帶 web search 查證直飛航線，留待排程使用。原本 LLM 補簡介／假名的 enrich 已移除（違反「內容來自實際來源」原則）。
- 產出分支檢查報告（commit 訊息與 Actions 摘要）後再合併進 `main`。

## 分支
- `main`：預設分支，也是工作分支；推上去就會部署 Firebase Hosting 與 GitHub Pages（`pages.yml` 只部署預設分支）。
- `pipeline/<指令>-<run 編號>`（例：`pipeline/seed-region-23`）：Actions 採集結果的暫存審核分支。檢查報告後用
  `git checkout origin/pipeline/... -- data/...` 合併進 `main`，之後用 `cleanup-branches.yml`（手動）刪除；
  還沒合併的填在 keep 保留。Claude Code 的雲端 session 只能推自己的工作分支，不能直接刪別的分支。

## 結構速覽
- `data/`：景點主資料（source of truth）。`regions.json` 47 縣名稱、地方、地區色；`seed/` 攻略候選清單。
- `pipeline/`：Python 資料 pipeline，`models.py` 對應 PLAN.md §4 的 schema，`cli.py` 為指令入口。
- `web/`：Vue 3 + Vite + TypeScript + Pinia + Vue Router + Tailwind v4 + MapLibre。token 在 `src/styles/theme.css`。
- `firebase.json`、`firestore.rules`：只有 Hosting、Firestore、Auth。`users/{uid}/**` 僅本人可讀寫；`trips/{id}` 僅成員可讀寫（共編）。

## 目前進度
- Phase 0 完成：骨架、Emulator、Google 登入、空白地圖、GitHub Pages 部署。
- Phase 1–3 完成；47 縣都有景點資料（Phase 6 的全國擴展），簡介與念法取自維基百科。詳見 docs/PROGRESS.md。
- Phase 5（收藏、去過、清單、KML / CSV 匯出）完成，等使用者驗收（docs/Phase5驗收.md）。
- Phase 4 v1（期間限定：氣象廳觀測）完成，等使用者驗收（docs/Phase4驗收.md）；超商、麥當勞、PR TIMES 因使用條款不收。
- Phase 7（行程、旅前準備、練習）完成，等使用者驗收（docs/Phase7驗收.md）。
- 驗收回饋第一輪（docs/回饋修改驗收.md）：自製日期選擇器、清單快捷去過與批次補日期、旅前準備段落目錄、連鎖店 Google 快捷搜尋、截圖收藏（圖片壓縮後存 Firestore，不用 Cloud Storage）、旅前小書（瀏覽器列印存 PDF）。行程共編已實作（docs/行程共編驗收.md）：行程在最上層 `trips/{id}`，成員都能編輯，邀請連結 `invites/{code}`。會話 `data/phrases` 是編輯整理的內容（非來源擷取），`reviewed: false` 待使用者校對。Firestore 規則在 `firestore.rules`，改了要請使用者貼到 Firebase Console 發布。
