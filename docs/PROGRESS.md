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

## Phase 2、3 狀態（程式已完成，資料待跑）
- Phase 2：`pipeline/themes.py`（seed-themes）、前端主題開關／主題色標記／`?themes=`。
- Phase 3：`pipeline/specialties.py`（seed-specialties，含航線候選）、`pipeline/verify_flights.py`（需 API key）、前端地區特色與海報區航線（只顯示 verified）。
- 資料順序：seed-region（run 6 進行中）→ 合併 → seed-themes（command=seed-themes）→ 合併 → seed-specialties → 合併。
  每次合併：`git checkout origin/pipeline/<command>-N -- data/`，commit、push（Pages 自動部署）。
- 需要使用者：repo secret `ANTHROPIC_API_KEY` → 跑 enrich.yml（先 limit 20）與 enrich.yml task=verify-flights。

## 之後
- Phase 4 期間限定、Phase 5 個人化（收藏、去過、匯出）等，見 PLAN.md §9；使用者只授權到 Phase 3。
