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
- 第二輪：主題層 UI 暫停；左側清單改為精選／全部／地區特色，與地圖連動；首頁列出 47 縣；拿掉照片預先下載；
  拉遠到縮放 7 以下回到首頁；Google Maps 改用「名稱＋縣名」搜尋。
- 第三輪（載入速度）：首頁只載 `bundles/featured.json`（各縣精選），進入地區才載該縣地圖 bundle；地圖 bundle 只放大點；
  Firebase SDK 改動態 import（未設定時不下載）；探索頁直接打包進主程式；字型拿掉 Noto Sans TC 500。
  清單加類型篩選；地圖 bundle 的 `c` 改為類型（跳過世界遺產等文化指定）。
- 第四輪：移除全部古墳（data 與 pipeline）；奈良、大阪的精選空缺改由分數次高者遞補（奈良 手向山八幡宮、長谷寺——長谷寺為人工挑選，
  因分類上限會讓「国鉄D51形蒸気機関車」這類物件遞補上來；大阪 難波宮、ひらかたパーク）。類型改為文字索引列＋清單依類型分段；
  捲軸滑過才顯示；畫面外景點在邊緣顯示箭頭；回首頁拉回整個日本。
- 開場畫面（DESIGN.md §7.0）：Wordmark＋一巡圓弧動畫＋依實際載入推進的進度條；地區標籤改為左側返回鍵。
- 簡介與念法改取自維基百科（`pipeline/wiki.py`），移除 LLM 補寫。
- 全國擴展（Phase 6 的一部分）：seed-region run 14 採集其餘 40 縣。之後整理規則：
  - 只收有 Wikidata 項目的點（攻略種子例外）：OSM-only 的點多是遊樂設施、動物舍、店家，分數也都是 0
  - 人工排除清單 `data/seed/exclude.json`（人物、物品、園區內設施、世界遺產總稱等 61 筆）
  - `prune-spots` 指令把規則套用到既有資料並遞補精選（不需連網）；seed-region 採集時也套用同樣規則
  - `featured.json` 只留地圖需要的欄位；定位範圍忽略離群點（東京的小笠原）
- 景點候選來源重整（沖繩驗收：使用者列的 14 個沖繩地點找到 12 個，原本 7 個）：
  - 日文維基「{縣}の観光地」分類（含子分類 2 層）與同名清單條目，列出的加分
  - 其他維基分類（購物中心、商業施設、市場、漁港、島、橋、岬、海水浴場、商店街），不加分
  - 縣官方觀光網站熱門排行（目前只有沖繩：おきなわ物語，`pipeline/sources/okinawastory.py`），
    排名 1→400 加 80→20 分；只取名稱、座標、類型與網址
  - 新類型：購物、市場、海灘、岬、島、橋；道の駅不再被當車站排除
  - 附屬建物併入：主體名稱至少 4 字，官方或清單列出的不併入
  - 寫爬蟲前用 `probe.yml` 在 Actions 取回網頁確認 robots.txt 與結構（沙箱連不到外站）
  - 還沒找到：サンエー浦添西海岸パルコシティ（官方頁無座標、名稱寫法不同）、泡瀬漁港（不在官方前 400）
- 拿掉「精選」（使用者決定）：公開資料沒有「第一次去該去哪」的訊號（波上宮不在官方瀏覽排行前 400，
  Wikivoyage 那霸篇把它和玉陵、識名園並列），分數只反映知名度。清單改為「景點／地區特色」，縣內地圖顯示全部大點；
  分數只用於段內排序、照片與名稱標籤的優先順序，以及首頁全國總覽（各縣前 20）。

## 擴充包、搜尋、深度探索（9/28）
- 擴充包列（地圖上方）：一次開一個，左側清單換成擴充包清單，景點變淡；目前只有寶可夢（人孔蓋 482 個、寶可夢中心與商店 30 間），
  設定可隱藏；網址 `?pack=`；景點卡片列出 2 km 內的擴充包項目。
- 景點搜尋（header 右側）：全國索引 `bundles/search.json`，第一次點搜尋框才載入；日文、假名、中文、羅馬拼音都能搜。
- 地區頁：選定縣時顯示虛線縣界；拉遠時保留目前的縣（縮放 5 以下才回全國）；選取的景點不參與群集並有呼吸燈；
  區域與景點類型分段可收合；清單標題拿掉件數（每縣上限 400 個大點）。
- 非景點規則（`prune-spots --wikidata`，run 9）：政令指定都市的區、令制國、祭典、戰役、國立／國定公園與半島、山地、諸島等廣域地名
  （看名稱結尾；世界遺產例外）。抽查出島、上高地、六甲山、大涌谷、天神西通り、銀座、先斗町、布引五本松ダム都保留。
- 深度探索頁 `/region/:pref`（UX-FLOW.md A8）：
  - 季節：氣象廳生物季節平年值（seed-seasons run 13：58 站、47 縣）
  - 祭典：日文維基「{縣}の祭り」（seed-festivals；見 PLAN.md §5.3c）
  - 地區特色：農林水產省郷土料理＋維基分類（ご当地ラーメン、名古屋めし、{縣}の郷土料理）
- 官方觀光網站熱門排行（景點分數加成）：福岡 クロスロードふくおか（瀏覽次數排序，run 24：前 400 中 190 個對上）、北海道 HOKKAIDO LOVE!（人気順，run 26：218 個對上）。官方清單裡的活動與季節花況不當景點；同名比對距離放寬到 5 km。東京、京都、大阪的官方網站沒有熱門排序。
- `seed-pack.yml` 的 concurrency 改為依指令分組（同一組只保留一個等待中的 run，不同指令排在一起會互相取消）。

## 之後
- Phase 4 期間限定、Phase 5 個人化（收藏、去過、匯出）等，見 PLAN.md §9；使用者授權到 Phase 3。
