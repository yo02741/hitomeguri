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

## 下一步
1. Phase 2 主題層（PLAN.md §5.2、§9）：OSM 撈茶、酒、拉麵、溫泉 → `kind: "theme"` 景點；寶可夢中心；寺社御朱印欄位；前端 LayerToggle（主題開關、URL `?themes=`）、主題符號 marker（DESIGN.md §6、主題色 token `t-*`）。
2. Phase 3 地區特色＋台灣直飛（PLAN.md §5.2b、§5.3）：`data/specialties/`、`data/flights/taiwan_direct.json`（種子 flights 為 verified:false 候選，驗證需 agent + web search，沒有 API key 前只能先放候選並在 UI 標示未驗證或不顯示）；地區面板顯示。
