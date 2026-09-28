# 進度與交接（給下一段工作的 Claude）

使用者指示：Phase 1 完成後直接繼續 Phase 2、3（不用等確認）。工作分支 `claude/charming-hawking-gngkes`（也是 repo 預設分支，GitHub Pages 由它部署）。

## 環境限制
- 沙箱連不到 Wikidata / OSM / Wikimedia / openfreemap；raw.githubusercontent.com 與 api.github.com 可以。
- 外部資料採集一律在 GitHub Actions：`seed-region.yml`（輸入縣 slug，各縣平行，結果推到 `pipeline/seed-<run_number>`）、`enrich.yml`（需 `ANTHROPIC_API_KEY` secret，使用者尚未設定）。
- 觸發：GitHub MCP `actions_run_trigger`（workflow_id=seed-region.yml, ref=工作分支）。等待：`curl https://api.github.com/repos/yo02741/hitomeguri/actions/runs/<id>` 看 status。
- 結果檢查：`git fetch origin pipeline/seed-N`，看 commit 訊息的報告，再 `git checkout origin/pipeline/seed-N -- data/spots` 合併。

## Phase 1 狀態
- pipeline：`pipeline/major.py`（seed-region）、`enrich.py`、`build_bundles.py`、`geo.py`、`kana.py`、`sources/`；測試 `pipeline/tests`（pytest 全過）。
- 前端：`web/src/views/ExploreView.vue`、`components/MapView.vue`、`SpotPanel.vue`、`RegionSidebar.vue`、`HomeSidebar.vue`、`TabBar.vue`、`stores/catalog.ts`。
- 七縣（kyoto aichi osaka hyogo nara gifu shiga）已採集；S 級種子都在精選。
- 未完成：簡介與缺漏假名需要 enrich（等使用者設定 ANTHROPIC_API_KEY）。

## Phase 2、3 狀態（已完成，資料已上線）
- Phase 2：主題小店七縣已採集（茶、酒、拉麵、溫泉、寶可夢；寺社大點加 goshuin 主題）。前端主題開關、主題色標記、`?themes=` 同步。
- Phase 3：地區特色 12 筆（種子 × Wikidata）；直飛航線 7 條候選皆 `verified: false`，網站不顯示。
- 需要使用者：repo secret `ANTHROPIC_API_KEY` → 跑 `enrich.yml`（task=enrich，先 limit 20；之後 limit 0 跑全部）與 `enrich.yml`（task=verify-flights）。enrich 目前只補大點與主題小店，地區特色的簡介尚未接上。
- 已知資料缺口：香（incense）主題與御朱印授與細節需 agent + web search；官方 GI／地域團體商標／郷土料理來源未接；種子對不上的景點見各次 seed-region 報告（大須商店街、中部電力 MIRAI TOWER、常滑やきもの散歩道、川原町、高山 古い町並、灘五郷、伏見 酒蔵、伊根の舟屋）。
- 重跑順序：seed-region（保留主題小店）→ seed-themes → seed-specialties；每次合併 `git checkout origin/pipeline/<command>-N -- data/`。

## 桌機介面調整（Phase 3 後，使用者回饋）
- 左欄改為地圖左上的浮動面板；地區標籤縮小。
- 拉遠到縮放 10 以下關閉景點卡片；hover 放大景點，縮放 12 以上顯示照片（map bundle 新增 `i` 縮圖欄位）。
- 平移時地區跟著畫面中心的縣；範圍涵蓋太多縣時不指定。
- 手機版暫緩（PLAN.md §5 RWD）。待辦見根目錄 TODO.md。

## 之後
- Phase 4 期間限定、Phase 5 個人化（收藏、去過、匯出）等，見 PLAN.md §9；使用者授權到 Phase 3。
