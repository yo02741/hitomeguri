# 進度與交接（給下一段工作的 Claude）

工作分支 `main`（repo 預設分支；推上去就部署 Firebase Hosting 與 GitHub Pages）。

## 目前狀態（2026-10-03）

**網站**：https://hitomeguri-7d87a.web.app/ 、https://yo02741.github.io/hitomeguri/

| 範圍 | 狀態 | 文件 |
|---|---|---|
| 探索（47 縣大點、搜尋、鐵路、類型篩選） | 完成 | PLAN.md §9 Phase 1、6 |
| 擴充包（寶可夢、城、老舖・茶屋、角色商店） | 上線，等驗收 | docs/擴充包驗收.md |
| 深度探索（季節、祭典、地區特色、期間限定；左側段落目錄） | 完成 | UX-FLOW.md A8 |
| 期間限定 v1（氣象廳） | 等驗收 | docs/Phase4驗收.md |
| 收藏、去過、清單、匯出 | 等驗收 | docs/Phase5驗收.md |
| 自動化排程＋PR 審核 | 等第一次自動 PR 與一週排程 | docs/Phase6驗收.md |
| 行程、旅前準備、練習、旅前小書 | 等驗收 | docs/Phase7驗收.md、docs/回饋修改驗收.md |
| 行程共編 | 等驗收 | docs/行程共編驗收.md |
| 設計質感：和風紋樣、紙紋 | 上線 | DESIGN.md §3.6 |
| 特效（景點收集卡、收集冊、開場動畫、操作過渡、新卡入手、季節飄落、路線繪製） | 上線（2026-10-02 合併進 main） | docs/特效說明.md |
| 離線（PWA）、經縣值、分享圖、位置小框、開卡包、立體地形、換縣墨暈、更多箔片、景點排除地區 | 等驗收；經縣值要貼 Firestore 規則 | docs/第三輪驗收.md |
| 收集卡樣式（基本、季節、全景、金箔、特別全景） | 等驗收 | docs/特效說明.md §9 |
| 年代主題（江戶～令和、時間軸）、收集卡無限抽、新卡種、十連抽、季節照片 | 等驗收；cards 規則要貼 | docs/年代主題驗收.md、DESIGN.md §13、§7.19a |
| 旅人第三版（157 件、散步的旅人）＋抽獎券（共用、不重複、NEW） | 等驗收；meta/wallet 規則要貼 | docs/旅人驗收.md、DESIGN.md §7.19b、§7.24 |
| 成就（紀念章帳：初訪 47 格＋40 個成就、新卡入手的成就章、這趟的成就、抽獎券） | 等驗收；規則不用改 | docs/成就驗收.md、DESIGN.md §7.25 |
| 手機版面（1024 以下）：第一階段（到得了、不壞）、第二階段（單手、少捲動：景點卡片三段高度、chip 軌道、站名板首頁、行程天數條、復原、打橫精簡 header 等） | 三個階段都在 main，等實機驗收（第三階段：位置小框、匯出選單、主畫面圖示、小字級三階等）；規則不用改 | docs/手機版計畫.md、docs/手機版第一階段驗收.md、docs/手機版第二階段驗收.md、docs/手機版第三階段驗收.md |

**原則的變更**（詳見 PLAN.md 的決策更新）：
- 內容一律取自實際來源，不用 LLM 寫簡介或念法；LLM 只用於翻譯與查證。原本的 enrich 已移除。
- 主題層改為擴充包；溫泉、酒、拉麵、居酒屋不做。7 縣舊的主題小店資料（`data/spots` 裡 `kind: theme`）保留但前端不顯示。
- 不標示「精選」；分數只用於排序與首頁總覽。

**待辦**：見根目錄 `TODO.md`。

- 開場畫面短版（2026-10-09，使用者決定）：完整版播完一次後記 `hitomeguri:splash-seen`，之後只淡出 0.5 秒（DESIGN.md §7.0）。
  手機 4 倍 CPU 降速、preview 建置量到的開場消失時間（3 次中位數）：第一次 8.9 秒、回訪 7.0 秒（工作完成到消失 1.1 → 0.5 秒，另外省掉補點與最少顯示時間）。
- 字型精簡（2026-10-09）：Noto Sans TC／JP 改寫字重範圍 400..900（同一批可變字型檔，CSS 705 → 241 個 @font-face），地方名補 `lang="ja"`；首頁字型下載 1.58 → 1.25 MB，外觀不變。900 沒拿掉（見 docs/效能檢測.md「字型精簡」）。
- 數字字型分兩種（2026-10-09，使用者決定）：`font-latin` 只留給看板數字（大計數、DAY、卡號、印章）與羅馬拼音；日期、距離、件數等資料數字改 `font-num`。昭和、平成的點陣字（DotGothic16、VT323）因此只出現在看板上，資料數字用內文字型（粉圓、Chiron GoRound TC，等寬數字）；其他年代外觀不變（DESIGN.md §4.1）。
- 茶的地圖圓點（2026-10-09，使用者決定）：江戶、昭和的 `--color-t-tea` 改 `#3C8933`，對陸地最低 2.94 → 3.17（昭和京都），江戶 2.97 → 3.20；其他年代不變。`test_region_contrast.py` 拿掉例外下限，另外檢查這兩個年代。

## 開發紀錄（依時間；早期內容有些已過時，以上方「目前狀態」為準）

### 環境限制
- 沙箱連不到 Wikidata / OSM / Wikimedia / openfreemap；raw.githubusercontent.com 與 api.github.com 可以。
- 外部資料採集一律在 GitHub Actions（見 CLAUDE.md「資料 pipeline 在 GitHub Actions 上跑」）。早期的 `enrich.yml`（LLM 補全）已移除。
- 觸發：GitHub MCP `actions_run_trigger`（workflow_id=seed-region.yml, ref=main）。等待：`curl https://api.github.com/repos/yo02741/hitomeguri/actions/runs/<id>` 看 status。
- 結果檢查：`git fetch origin pipeline/seed-N`，看 commit 訊息的報告，再 `git checkout origin/pipeline/seed-N -- data/spots` 合併。

### Phase 1 狀態
- pipeline：`pipeline/major.py`（seed-region）、`enrich.py`、`build_bundles.py`、`geo.py`、`kana.py`、`sources/`；測試 `pipeline/tests`（pytest 全過）。
- 前端：`web/src/views/ExploreView.vue`、`components/MapView.vue`、`SpotPanel.vue`、`RegionSidebar.vue`、`HomeSidebar.vue`、`TabBar.vue`、`stores/catalog.ts`。
- 七縣（kyoto aichi osaka hyogo nara gifu shiga）已採集；S 級種子都在精選。
- 未完成：簡介與缺漏假名需要 enrich（等使用者設定 ANTHROPIC_API_KEY）。

### Phase 2、3 狀態（已完成，資料已上線）
- Phase 2：主題小店七縣已採集（茶、酒、拉麵、溫泉、寶可夢；寺社大點加 goshuin 主題）。前端主題開關、主題色標記、`?themes=` 同步。
- Phase 3：地區特色 12 筆（種子 × Wikidata）；直飛航線 7 條候選皆 `verified: false`，網站不顯示。
- 需要使用者：repo secret `ANTHROPIC_API_KEY` → 跑 `enrich.yml`（task=enrich，先 limit 20；之後 limit 0 跑全部）與 `enrich.yml`（task=verify-flights）。enrich 目前只補大點與主題小店，地區特色的簡介尚未接上。
- 已知資料缺口：香（incense）主題與御朱印授與細節需 agent + web search；官方 GI／地域團體商標／郷土料理來源未接；種子對不上的景點見各次 seed-region 報告（大須商店街、中部電力 MIRAI TOWER、常滑やきもの散歩道、川原町、高山 古い町並、灘五郷、伏見 酒蔵、伊根の舟屋）。
- 重跑順序：seed-region（保留主題小店）→ seed-themes → seed-specialties；每次合併 `git checkout origin/pipeline/<command>-N -- data/`。

### 桌機介面調整（Phase 3 後，使用者回饋）
- 左欄改為地圖左上的浮動面板；地區標籤縮小。
- 拉遠到縮放 10 以下關閉景點卡片；hover 放大景點，縮放 12 以上顯示照片（map bundle 新增 `i` 縮圖欄位）。
- 平移時地區跟著畫面中心的縣；範圍涵蓋太多縣時不指定。
- 手機版暫緩（PLAN.md §5 RWD；2026-10-03 已解除，手機版面一起做）。待辦見根目錄 TODO.md。
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

### 擴充包、搜尋、深度探索（9/28）
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

### 鐵路、官方網站、祭典（9/29）
- 鐵路路線圖層（`pipeline/rail.py`、seed-rail）：OSM 鐵路路線 relation（`out geom`），上下行與列車種別合併為一條線、
  直通運轉與列車名稱（のぞみ、大和路快速）不當路線、同一段軌道只畫一次；只留縣界內的路段與車站，同名車站 500 m 內只留一個。
  沖繩 1 線、京都 29 線、東京 89 線、大阪 55 線（run 26）；東京 bundle 390 KB（gzip 92 KB），開啟「鐵路」才載入。
- 官方觀光網站：東京 GO TOKYO（sitemap，911 筆，頁面沒有座標只比對名稱）、京都観光Navi（類別清單頁，804 筆）、
  大阪 OSAKA-INFO（清單是 JavaScript 載入，sitemap 只有 45 筆）沒有熱門排序，列出的景點一律加 20 分，只併入既有景點、不新增。
  對上：東京 273/400、京都 296/646、大阪 17/657。清單另外採集存檔（`seed-official` → `data/seed/official/`），
  seed-region 讀存檔（東京逐頁取要 16 分鐘，和採集一起跑會超過時限）。
- 景點重新採集（run 28–30，全國）：大點 18915 → 19302。東京排除南鳥島、南硫黄島、鳥島（一般不能登島）與東京都島嶼部、豊島区。
- 諸島／列島放回景點（使用者決定）；學校（震災遺構、文化財、廃校、旧〇〇例外）與道路名稱在採集時排除。
- 祭典：1 到 12 月依序排；「在地圖上看」改為回到縣地圖並放位置標記；沒有中文名時顯示英文名。
  祭典與地區特色的簡介依序取中文、英文、日文維基，照片沒有 Wikidata P18 時取維基百科主圖（限自由授權）。
- 鐵路：地方的 JR 線多半只有軌道 relation（route=railway），一併收；只畫營運中的旅客線路段（way 的 railway 標籤），
  廃線、建設中、貨物線、側線不畫。鳥取 1→6 條、北海道 8→20 條。
- 地區特色：接上農林水產省「うちの郷土料理」料理頁的介紹與念法、英文版的英文名與介紹（公共データ利用規約 第1.0版，標示出典）；
  照片與食譜有第三方提供者（條款要求事先向負責單位確認），使用者決定不取。卡片與祭典右上角加 Google 搜尋按鈕（日文名＋縣名）。
- 採集 workflow 推送前先併入最新的工作分支（跑的期間 workflow 檔有改時，GitHub App 推送會被拒）。

### 之後
- 手機版面第二階段（2026-10-03，分支 `feat/mobile-2`）：`docs/手機版計畫.md` §3 的 1–31 項。新增的共用件：`services/toast.ts`（復原）、`services/confirm.ts`（站內確認框）、
  `services/sheetSnap.ts`（景點卡片三段高度）、`composables/tabNav.ts`（分頁記憶）、`composables/swipe.ts`、`viewport.ts` 的 `coarse`、`land`，Tailwind 變體 `land:`、token `--spacing-tabbar`。
  地區特色 bundle 改成一縣一檔（`bundles/specialties/{縣}.json`）。Google Maps 與 LINE 的官方文件沙箱打不開，依搜尋摘錄實作。驗收見 docs/手機版第二階段驗收.md。
- 手機版面第三階段（2026-10-03，已合併進 main）：`docs/手機版計畫.md` §4 的 1–11 項（決定 O1、P2、Q2、R3）。`services/export.ts` 的 `shareOrDownload`（canShare 說可以才分享）、
  `web/build/icons.ts`（建置時從 regions.json 畫主畫面圖示，不加套件）、`composables/floating.ts` 不超過分頁列、`tabNav.ts` 的 `switchesTab`；`--text-label` 拿掉，小字只剩 body-sm／caption／micro。
  扭蛋的黑色小方塊是沙箱軟體繪圖造成，沒有改。分享檔案的官方文件沙箱打不開，依搜尋摘錄實作。驗收見 docs/手機版第三階段驗收.md。
- Phase 4 期間限定等，見 PLAN.md §9。
- Phase 4 v1（2026-09-29）：期間限定只接氣象廳（`pipeline/timed.py`、`pipeline/sources/jma.py` 的 parse_sakura／parse_autumn）。
  沙箱連不到氣象廳：頁面格式用 `probe.yml` 看；測試的網頁片段取自實際格式。
- Phase 7（2026-09-29）：行程（trips）、旅前準備、練習。資料在 Firestore `users/{uid}/trips`、`trips/{id}/progress`。
  測試時 Pinia 的 trips store 只有在元件用到時才建立：Playwright 裡先 `import('/src/stores/trips.ts')` 再 `useTripsStore()`。
- 行程共編（2026-09-30）：行程搬到最上層 `trips/{id}`（members 可讀寫），邀請 `invites/{code}`，加入時邀請碼寫在 `member_info.{uid}.via` 讓規則檢查。
  測試：Auth 模擬器會把同 email 的 Google 登入併成同一個帳號，多帳號測試要用不同 sub 與 email（登入過的 sub 會一直連到原帳號）。
- 驗收回饋第一輪（2026-09-30）：見 docs/回饋修改驗收.md。截圖收藏存在 Firestore `users/{uid}/finds`（縮圖）與 `find_images`（原圖），
  圖片在瀏覽器壓縮（web/src/services/image.ts）。改了 firestore.rules 之後，模擬器的熱重載會被沙箱的代理擋下（Unable to parse JSON），要重開模擬器。
  旅前小書用瀏覽器列印：App 的固定高度捲動版面要加 `print:` 變體攤開（寫在 base layer 的 @media print 會被 utility 蓋掉）。
- 成就（2026-10-02）：`data/achievements.ts`（目錄）、`data/achvRules.ts`（規則文案）、`services/achievements.ts`（純函式：上下界推算達成日、evaluate、diffKnown）、
  `stores/achievements.ts`（NEW 比對、takeRecent、inTrip）、`bundles/achievements.json`（`build_achievements`）。前端第一次有單元測試：
  `cd web && npm run test`（vitest，只測純函式；`vitest.config.ts` 不載入 PWA plugin）。
  marks、trips store 加 `synced`（`includeMetadataChanges`，只有 metadata 變的 snapshot 不重建）。
  emulator 的 uid 不是登入時給的 sub，測 localStorage（`hitomeguri:achv-known:<uid>`）要從 user store 取 uid。
  成就頁沒有用 `content-visibility: auto`：段落還沒畫時高度是估的，手機段落目錄跳過去會停錯位置。
- Phase 5（2026-09-29）：收藏、去過、清單、KML / CSV 匯出。資料在 Firestore `users/{uid}/marks`、`lists`（UX-FLOW.md §3）。
  測試方式：`npx firebase emulators:start --project demo-hitomeguri --only auth,firestore` ＋ `npm run dev`，
  Playwright 用 `signInWithCredential(GoogleAuthProvider.credential('{"sub":…}'))` 登入 emulator（uid 由 emulator 指派）。
  沙箱連不到 openfreemap：截圖時用 `page.route` 回傳只有背景層的 style。
