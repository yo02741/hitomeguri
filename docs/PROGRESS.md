# 進度與交接（給下一段工作的 Claude）

工作分支 `main`（repo 預設分支；推上去就部署 Firebase Hosting 與 GitHub Pages）。

## 目前狀態（2026-10-03）

**網站**：https://hitomeguri-7d87a.web.app/ 、https://yo02741.github.io/hitomeguri/

| 範圍 | 狀態 | 文件 |
|---|---|---|
| 探索（47 縣大點、搜尋、鐵路、類型篩選） | 完成 | PLAN.md §9 Phase 1、6 |
| 國際機場當成景點（類型「機場」；国土交通省「各空港における国際線就航状況調べ」） | 32 個機場已併進 data（seed-airports #82），等驗收 | PLAN.md §5.1 |
| 縣內規劃的資料（市区町村界、車站停靠路線與新幹線、鐵路路網） | pipeline 完成，資料已採集（seed-rail #75、N03） | PLAN.md §4.5、§5.3d、§5.3e |
| 縣內規劃 2、3：小區塊（地區選單、區界、`?area=`）、車站卡片、全國地圖的新幹線 | 等驗收 | UX-FLOW.md A1c、A2b、B5，DESIGN.md §7.5d、§7.13a |
| 縣內規劃 4：日帰り（行程每天的住的車站、單日來回） | 等驗收；規則不用改 | UX-FLOW.md C8，DESIGN.md §7.9c、§8 |
| 擴充包（寶可夢、城、老舖・茶屋、角色商店） | 上線，等驗收 | docs/擴充包驗收.md |
| 深度探索（季節、祭典、地區特色、期間限定；左側段落目錄） | 完成 | UX-FLOW.md A8 |
| 期間限定 v1（氣象廳） | 等驗收 | docs/Phase4驗收.md |
| 收藏、去過、清單、匯出 | 等驗收 | docs/Phase5驗收.md |
| 自動化排程＋PR 審核 | 等第一次自動 PR 與一週排程 | docs/Phase6驗收.md |
| 行程、旅前準備、練習、旅前小書 | 等驗收 | docs/Phase7驗收.md、docs/回饋修改驗收.md |
| 行程共編 | 等驗收 | docs/行程共編驗收.md |
| 設計質感：和風紋樣、紙紋 | 上線 | DESIGN.md §3.6 |
| 特效（景點收集卡、收集冊、開場動畫、操作過渡、新卡入手、季節飄落、路線繪製） | 上線（2026-10-02 合併進 main） | docs/特效說明.md |
| 離線（PWA）、經縣值、分享圖、位置小框、開卡包、換縣墨暈、更多箔片、景點排除地區 | 等驗收；經縣值要貼 Firestore 規則 | docs/第三輪驗收.md |
| 收集卡樣式（基本、季節、全景、夜景、墨繪、切手、特別全景）＋這裡做過的事（勾選） | 等驗收；cards 規則要貼（多了 `t`） | DESIGN.md §7.19a、§7.19b |
| 年代主題（江戶～令和、時間軸）、收集卡無限抽、新卡種、十連抽、季節照片 | 等驗收；cards 規則要貼 | docs/年代主題驗收.md、DESIGN.md §13、§7.19a |
| 旅人第三版（163 件：含成就服裝 6 件、散步的旅人）＋抽獎券（共用、不重複、NEW） | 等驗收；meta/wallet 規則要貼 | docs/旅人驗收.md、DESIGN.md §7.19b、§7.24 |
| 成就（紀念章帳：初訪 47 格＋40 個成就、新卡入手的成就章、這趟的成就、抽獎券） | 等驗收；規則不用改 | docs/成就驗收.md、DESIGN.md §7.25 |
| 手機版面（1024 以下）：第一階段（到得了、不壞）、第二階段（單手、少捲動：景點卡片三段高度、chip 軌道、站名板首頁、行程天數條、復原、打橫精簡 header 等） | 三個階段都在 main，等實機驗收（第三階段：位置小框、匯出選單、主畫面圖示、小字級三階等）；規則不用改 | docs/手機版計畫.md、docs/手機版第一階段驗收.md、docs/手機版第二階段驗收.md、docs/手機版第三階段驗收.md |

**原則的變更**（詳見 PLAN.md 的決策更新）：
- 內容一律取自實際來源，不用 LLM 寫簡介或念法；LLM 只用於翻譯與查證。原本的 enrich 已移除。
- 主題層改為擴充包；溫泉、酒、拉麵、居酒屋不做。7 縣舊的主題小店資料（`data/spots` 裡 `kind: theme`，1190 筆）2026-10-09 刪除（使用者決定）。
- 不標示「精選」；分數只用於排序與首頁總覽。
- 立體地形（国土地理院標高圖磚＋陰影、地圖右下「立體」鈕）2026-10-10 移除（使用者決定）；地圖的傾斜、旋轉照舊。

**待辦**：見根目錄 `TODO.md`。

- 國際機場當成景點（2026-10-11，使用者決定：那覇空港這類機場原本被排除）：有國際定期客運航班的機場收成景點，類型「機場」（清單的類型索引多一組「機場」，`web/src/data/categories.ts`），不列入精選。哪些機場算數看国土交通省每季的「各空港における国際線就航状況調べ」定期便 Excel（2026年夏期；同一份表的 PDF 取不出文字，報道発表「国際定期便の概要」的 PDF 只有摘要），Wikidata、OSM 的國際機場標記不可靠所以不用（PLAN.md §5.1）。`seed-airports`（`pipeline/airports.py`，seed-pack.yml，輸入 `url` 可換新一季的 Excel）：取出儲存格文字（PDF 用 pypdf）→ 和 Wikidata 的日本機場（IATA 代碼、沒有廢止、有座標與日文名，只有軍用類型的排除）比對日文名、別名、去掉「空港」的地名、通稱與 IATA 代碼（東京、大阪、名古屋、札幌不單獨比對）→ `data/seed/airports.json`（`models.AirportSeed`，`validate-data` 檢查）＋機場景點直接併進 `data/spots/{縣}.json`（名稱、念法、簡介、照片、最近車站與其他景點同一套，來源多一筆這份表的網址；清單上已經沒有的機場移除）。例外只給清單上的 QID：`major.drop_non_spots`、`curate.wikidata_non_spots`（prune-spots --wikidata）；`seed-region` 重採時用 `major.apply_airports` 把清單上的機場加回來。縣由座標與縣界判斷，在海上、埋立地（長崎、北九州、神戸）時用 Wikidata 所在地，再沒有取最近的縣界（`geo.nearest_prefecture`）。景點卡片的來源顯示「国土交通省」，`/credits` 加一列。測試 `pipeline/tests/test_airports.py`（仿 PDF 文字與 Wikidata 結果的 fixture）。自衛隊共用的機場（百里、小松、美保、徳島）Wikidata 的標籤是「○○飛行場」，改用別名裡的民航名稱（茨城空港、小松空港、米子鬼太郎空港、徳島阿波おどり空港；`airports.civil_name`），念法留空、中文用日文名。seed-airports #82 對到 32 個機場（新千歳、函館、帯広、青森、花巻、仙台、茨城、成田、羽田、新潟、富山、小松、静岡、中部、関西、米子、岡山、広島、徳島、高松、松山、福岡、北九州、佐賀、長崎、熊本、大分、宮崎、鹿児島、石垣、那覇、下地島），已併進 `data/`。
- 縣內規劃 4：日帰り（2026-10-11，使用者決定；UX-FLOW.md C8，DESIGN.md §7.9c）：
  - pipeline：`pipeline/daytrip.py` 產生 `bundles/daytrip.json`（一個市区町村一筆：代碼、名稱、政令指定都市名、縣、區名的位置、分數最高的 3 個景點與最近車站、其餘景點的車站；1106 筆，289 KB／gzip 約 95 KB；`models.DaytripBundle`、`_index.json` 的 `daytrip`）。build-bundles 用剛寫好的 map bundle（`m`、`st`）與市区町村 bundle（`l`）。`pipeline/tests/test_daytrip.py`。
  - 前端：`services/daytrip.ts` 移植 `rail_graph` 的 Dijkstra（新幹線權重 0.97、同分依節點 index、小數 1 位同 Python round；對照資料 `services/fixtures/rail-graph-small.expected.json` 由 pytest 產生，vitest 比對；實際的路網從東京駅出發 3805 站的 km 與新幹線 km 和 Python 完全相同，約 45 ms），目的地依城市合起來（政令指定都市的區、東京 23 區）、住的城市不列（車站在那一縣的區界裡找）、距離取各區所有車站裡最近的一站，分三段（60 km 內、60–150 km、新幹線 150–450 km 且路上新幹線 ≥ 20 km）。站名搜尋（繁體字、全形、「駅」「站」）、最近車站。`composables/daytrip.ts`、`StayPicker.vue`、`DaytripList.vue`、`MapView` 的 `daytrip` 圖層，`TripView` 每天的「住在 ▾」「單日來回」（桌機地圖左上的面板＋地圖記號與新幹線路線，手機下方對話框）。
  - 住的車站存在 `days[i].stay = { st, n }`（firestore.rules 不用改）；`services/trip.ts` 的 `copyDays`、`setStay`、`parseStay`，移動、移除、復原、改天數、刪一天、加景點都帶著它（vitest）。路網重建後車站 id 換了時用站名找回來。離線用：有住的車站時也先抓路網與目的地。
  - 截圖檢查（1440×900、390×844）：住東京 → 60 km 內有川越市（約 38 km）、鎌倉市（約 44 km），60–150 km 有小田原、箱根、宇都宮、日光市（約 141 km，新幹線），新幹線有名古屋市（約 326 km）、黒部市、富山市、立山町（約 389 km）、軽井沢町（約 402 km，繞新潟）、金沢市（約 427 km）；展開川越市加到 DAY 1、重新整理後住的車站還在。距離跟著鐵路資料（TODO.md 已知限制「鐵路」）。
- 縣內規劃 2、3（2026-10-11，使用者決定）：
  - 小區塊（UX-FLOW.md A2b，DESIGN.md §7.5d）：縣地圖畫市区町村界（`--region-sub` 細線）與區名（縮放 8.5～13.5，底圖在縣內的市町村名用 `within` 篩掉不重複），景點清單多「地區」（`AreaPicker.vue`：有景點的區依代碼、件數，政令指定都市的區排在市名底下；桌機在標題下一整列，手機在類型索引列最前面），地圖上點區塊也能選；選了清單只留那一區、地圖移到那一區、外框加粗。網址 `?area=代碼`，選區新增一筆歷史（返回回到上一個區），換縣時不帶過去。`services/areas.ts`（vitest）。地圖出處在縣地圖多国土数値情報，`/credits` 加用途、授權（CC BY 4.0／公共データ利用規約）、出典標示與加工註記。bundle 改了兩點：所属未定地不放、多 `l`（區名位置，`topo.label_point` polylabel）；版本改取輸出內容的雜湊。
  - 車站（UX-FLOW.md B5，DESIGN.md §7.13a）：縣地圖的車站可以點（一般的站縮放 12、新幹線站 9 起，新幹線站畫雙圈），景點、群集一直優先。車站卡片（`StationPanel.vue`，`?station=路網節點 id`）：站名、停靠的路線（路線色、新幹線）、附近的景點（最近車站是這一站的依分數，沒有時 1.5 km 內最近的 5 個），點了打開景點卡片。景點卡片的「最寄駅」是鐵路圖層裡那一站時可以點。`services/stations.ts`（vitest）。
  - 全國地圖的新幹線（UX-FLOW.md A1c）：`build_shinkansen` 產生 `bundles/shinkansen.json`（12 條線、175 站，46 KB／gzip 15 KB；OSM 的碎段先接成長折線再簡化，`models.ShinkansenBundle`、pytest），首頁畫淡淡的線與站，點了站進入那個縣的車站卡片。
  - 新幹線站的判斷照 seed-rail #75 的資料，有誤判與漏掉的站（TODO.md 已知限制「鐵路」）；`pipeline/rail.py`、`rail_graph.py` 另外在修，修好重建 bundle 就跟著對。
  - 截圖檢查：1440×900、390×844、844×390（東京的台東区、渋谷区、中央区，點區塊、`?area=` 直接開與返回，神奈川的横浜市各區，東京駅、上野、浅草、新横浜、ガーラ湯沢的車站卡片，全國地圖的新幹線）。
- 專心模式（2026-10-11，使用者決定，TODO.md「縣內規劃」1）：進入一縣後地圖鎖在這個縣附近、只畫這個縣的景點與擴充包的點，縣界以外蓋一層紙色變淡（底圖地名之下）；拖曳、縮放不再換縣，「‹ 全國」或返回才離開。首頁放大到某個縣照樣進入那個縣；搜尋、連結、「附近的…」到別縣的點照樣換縣。範圍由 `services/geo.ts` 的 `focusArea` 算（整個縣含離島＋縣界外 1.5 度內的景點＋四周的海；拉遠的極限不算小笠原這種 5 度以外的離島），`MapView` 的 `focus` 用 MapLibre `transformConstrain` 以扣掉側欄、清單卡、景點卡片之後的可見範圍為準鎖住鏡頭，可見範圍中間也要看得到這個縣的陸地（縣界多邊形與縣界外的景點），再拖就停住。程式定位不受限制；卡片換段之後鏡頭在範圍外時不拉回來。之後的「日帰り」圖層疊在 `focus-mask` 之上，範圍由 `focusArea` 的 `extra` 加（UX-FLOW.md §1.3、A2，DESIGN.md §7.5a）。
- 縣內規劃的資料（2026-10-11，TODO.md「縣內規劃」2–4，只做 pipeline，前端之後做）：
  - 市区町村界：`seed-municipalities`（`pipeline/municipalities.py`、`pipeline/sources/n03.py`）取国土数値情報 N03（CC BY 4.0；出處「「国土数値情報（行政区域データ）」（国土交通省）（https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html）をもとにひとめぐり作成」，前端用到時加到 `/credits`），念法取 Wikidata P429→P1814。政令指定都市用區、東京是特別區。拓撲保持簡化（`pipeline/topo.py`）寫 `data/municipalities/{縣}.json`（一縣 400 KB 以內），bundle `municipalities/{縣}.json`（200 KB 以內）。
  - 景點的區：`Spot.municipality`（6 碼代碼），`assign-municipalities`（離線）寫進 `data/spots`；seed-region 重採時重新判斷；map bundle 多 `m`。
  - 鐵路：`seed-rail` 多取 highspeed 與停靠點名稱；路線多 `shinkansen`、`edges`（相鄰站與沿軌道距離），車站多 `lines`、`shinkansen`，`extra_stations` 放縣外的鄰站。軌道全被別的線畫過的線也留著（東京都內的東北新幹線）。
  - 路網：`build-rail-graph`（`pipeline/rail_graph.py`，離線；build-bundles 也產生）`bundles/rail-graph.json`，`shortest`、`within` 與測試；景點的最近車站對到路網節點（map bundle 的 `st`）。沒有時刻表，只有 km 與能否搭新幹線（新幹線 ≥ 20 km）。
  - `validate-data` 檢查區界（代碼檢查碼、縣、排序、格式）、景點的區、鐵路的參照與距離。
  - **要在 Actions 跑**（seed-pack.yml，依序）：先 `probe.yml` 看 N03 資料頁與 robots.txt → `seed-rail`（全國）→ `seed-municipalities`（全國）→ 合併兩個分支的 `data/rail`、`data/municipalities` → `assign-municipalities`（本機或 seed-pack）→ 合併 `data/spots` → `validate-data`、`build-bundles`。現在的 `data/rail` 沒有停靠路線與相鄰站，路網只有步行轉乘邊。

- 圖示（2026-10-11，使用者決定）：從提案 A–D（`docs/screenshots/圖示提案.png`）選定。主畫面與 PWA 圖示用 A「巡の輪」（全國紙色＋紙紋、line 細圓、47 縣 strong 色圓點、中央墨色「巡」，全部在中心 80% 的圓內，同一張當 manifest 的 any 與 maskable），瀏覽器分頁用 D 的 favicon（紙色圓角方塊上的「巡」＋下緣 47 縣色帶），取代 Vite 預設的閃電 `favicon.svg`。都由 `web/build/icons.ts` 在建置時從 `data/regions.json` 畫出，原始碼不寫色碼：「巡」的外框存在 `web/build/glyph-meguri.ts`（Noto Sans JP Black，SIL OFL 1.1），點陣化在 `web/build/raster.ts`（不加套件）。輸出 `apple-touch-icon.png` 180、`icons/icon-192.png`、`icon-512.png`、`favicon.svg`、`favicon-32.png`（`maskable-*.png` 拿掉）；`web/build/icons.test.ts` 檢查安全區、47 縣顏色與 PNG（DESIGN.md §1b）。iPhone 已經加到主畫面的要重新加一次才會換圖示；Android 由 Chrome 之後檢查 manifest 時更新。
- 資料來源頁（2026-10-11，使用者決定）：地圖下緣那條兩行的出處太佔位置，散步的旅人也會走過去。地圖上只留「© OpenStreetMap | © OpenMapTiles | 資料來源」，所有尺寸一開始收成 ⓘ；底圖 style 自帶的 OpenFreeMap 出處拿掉，改列在 `/credits`（DESIGN.md §8）。`/credits` 列出實際用到的來源、用途與授權（OSM、OpenMapTiles、OpenFreeMap、地球地図日本、Wikidata、維基百科、Commons、瀏覽量、農林水産省、気象庁、官方觀光網站、ポケモンローカルActs、観光庁多言語解説文DB、字型）與注意事項；入口是地圖出處與帳號選單。散步的旅人只走到地圖右下控制鈕左邊 280px 以外。
- 這裡做過的事移到景點卡片（2026-10-11，使用者決定）：收集冊只看收集到的卡。放大檢視拿掉任務清單，回到原本的卡寬與「關閉」位置；景點卡片（去過的景點）多一小段勾選，勾了照樣播新卡入手（DESIGN.md §7.19a）。

- 收集卡重新設計（2026-10-10，使用者決定）：拿掉銀箔、金箔（已抽到的讀到時略過、下次寫入時刪掉，不退券）。每一種卡都有固定的拿法，由現在的紀錄算出來（`services/cardVariants.ts` 的 `ownedVariants`）：季節看去的日期，沒去過的季節用抽獎券抽（「抽一張」「十連抽」、第一次去過的免費抽都只抽季節卡）；景點卡片的「這裡做過的事」勾選（2026-10-11 從放大檢視移到景點卡片，收集冊只看收集到的卡）：晚上去過→夜景（有夜景照片的景點）、蓋了紀念章或寄了明信片→切手、拿到御朱印（寺院、神社）或寫了旅日記→墨繪，取消就拿掉；景點在已結束的行程裡→全景（自動）。特別全景改成每個景點都有的紀念卡：其他樣式都有了才有，卡面印初訪與再訪日期、那趟行程、收齊的各樣式小章；世界遺產、國寶加虹色箔片與亮片；不能抽。每個景點 9 種（有夜景照片 10 種）。勾選存在 `users/{uid}/cards/{景點 id}` 的 `t`，**firestore.rules 的 cards 改了，要貼到 Console**（沒貼之前卡片的寫入都會被擋，先記在這台裝置）。
- 收集卡的橫卡（2026-10-10，使用者決定）：全景、特別全景、夜景的照片是橫的（寬/高 ≥ 1.2）時卡片做成 7:5 橫卡；拿掉「太寬、太小就整張放、墊模糊底」，一律裁切鋪滿。收集冊、十連抽、開卡包一覽的直格子裡橫卡轉 90 度橫躺；放大檢視、新卡入手、開卡包翻的那張、十連抽放大直立顯示（DESIGN.md §7.19、§7.19a）。直橫看資料裡的原圖寬高（`images`、`season_images` 的 `width`、`height`；map bundle 的 `ia` 與 `si` 第 4 欄），**要在 Actions 跑一次 seed-pack 的 `seed-photo-sizes`**（全國，產出分支 `pipeline/seed-photo-sizes-<run>`，合併 `data/spots` 後 build-bundles），之前資料沒有寬高的全部維持直卡。新採的照片（seed-region、seed-photos、seed-season-photos）會一起記寬高。
- 換樣式時照片先閃上一張（2026-10-10 修）：卡面只有一個 `<img>` 換網址，新照片載入前瀏覽器一直顯示舊照片。改成 `<img>` 依照片重建、載入完成才顯示（之前是地區紋樣）；換照片時失敗重試的次數歸零；季節照片還不知道有沒有時不拿主照片頂替。全景卡背面的名稱原本是白字（看不到），改回墨色。

- 浮世繪裡的景點（2026-10-09，使用者決定）：收集冊裡的一頁 `/log/cards/ukiyoe`（DESIGN.md §7.19c），描繪我們景點的真實浮世繪，去過的地方亮起來；不是新卡種。資料 `data/ukiyoe.json` 由 `seed-ukiyoe`（`pipeline/ukiyoe.py`，seed-pack.yml）從 Wikidata 與 Commons 取得，只收公有領域、CC0、CC；`validate-data` 檢查 schema、排序、景點、授權與出處；bundle `ukiyoe.json`（`index.extras.ukiyoe`）。資料由 seed-ukiyoe #69 產生：63 個景點、159 幅（公有領域 143、CC0 12、CC 4，授權不明的 3 幅不收）。

- 開場畫面短版（2026-10-09，使用者決定）：完整版播完一次後記 `hitomeguri:splash-seen`，之後只淡出 0.5 秒（DESIGN.md §7.0）。
  手機 4 倍 CPU 降速、preview 建置量到的開場消失時間（3 次中位數）：第一次 8.9 秒、回訪 7.0 秒（工作完成到消失 1.1 → 0.5 秒，另外省掉補點與最少顯示時間）。
- 字型精簡（2026-10-09）：Noto Sans TC／JP 改寫字重範圍 400..900（同一批可變字型檔，CSS 705 → 241 個 @font-face），地方名補 `lang="ja"`；首頁字型下載 1.58 → 1.25 MB，外觀不變。900 沒拿掉（見 docs/效能檢測.md「字型精簡」）。
- 數字字型分兩種（2026-10-09，使用者決定）：`font-latin` 只留給看板數字（大計數、DAY、卡號、印章）與羅馬拼音；日期、距離、件數等資料數字改 `font-num`。昭和、平成的點陣字（DotGothic16、VT323）因此只出現在看板上，資料數字用內文字型（粉圓、Chiron GoRound TC，等寬數字）；其他年代外觀不變（DESIGN.md §4.1）。
- 茶的地圖圓點（2026-10-09，使用者決定）：江戶、昭和的 `--color-t-tea` 改 `#3C8933`，對陸地最低 2.94 → 3.17（昭和京都），江戶 2.97 → 3.20；其他年代不變。同一天刪除主題小店後，這個圓點已不在畫面上；token 之後也刪除（見「刪除 `t-tea`」）。
- 刪除舊的主題小店（2026-10-09，使用者決定）：7 縣 `data/spots` 的 `kind: theme`（茶、酒、拉麵、溫泉）1190 筆刪除（愛知 200、岐阜 71、兵庫 228、京都 246、奈良 72、大阪 257、滋賀 116），景點總數 19062 → 17872。`seed-themes` 指令（`pipeline/themes.py`、OSM 主題查詢）、`kind` 的 `"theme"`、地圖的主題色外框、沒用到的 `ThemeBadge`、`data/themes.ts` 與 `--color-t-sake／incense／onsen／ramen／goshuin` 一併移除；map bundle 不再帶 `t`（主題）；`data/seed/seed_from_guides.json` 沒人讀的 23 筆 `kind: theme` 種子一併刪除（`test_seed_spots_are_major_only`）。detail bundle 7 縣合計 5.18 → 4.48 MB（gzip 922 → 832 KB；47 縣合計 26.84 → 26.13 MB），7 縣 map bundle 845 → 834 KB（拿掉大點上的 `t`）；地圖、清單、搜尋、擴充包截圖前後一致。`--color-t-tea` 當時先保留。
- 中性色層次（2026-10-09，使用者決定採用，成為預設外觀；DESIGN.md §3.1a）：令和的 surface、map、line-soft、header、placeholder、line 補明度下限，28 縣＋全國有變（全國、京都、東京、德島只換 tint）；line 對 paper 全國最低 1.15 → 1.30（香川 `#F2EAD9` → `#E4DCCB`，1.15 → 1.31；千葉 1.15 → 1.31），香川 header 對 paper 1.09 → 1.17。千葉、愛媛的 sub 各加深一步（對 header ≥ 4.6）。五個年代的 tint 改成比 surface 深（48/48，原本比紙還亮），選取列加 1.5px region-strong 內框（RegionLists、PackList、TripStopList）。對比測試全過（48 組 × 6 個年代；sub 對 tint 最低 4.99）。前後對照：`docs/screenshots/中性色-*.jpg`。先以 `?neutral=1` 預覽，採用後 `build-region-css` 直接把補下限的值寫進 `regions.css` 與 `theme-colors.json`（新增令和 `modern`，加 `header`），`regions-neutral.css`、`data-neutral`、`neutral-preview:` 變體拿掉；開場畫面、分享圖、PWA 標題列（manifest `theme_color`、`meta[name=theme-color]`）改讀 `theme-colors.json`，和頁面同色。
- 刪除 `t-tea`（2026-10-09，使用者決定）：主題小店刪除後畫面上沒有任何地方用到（擴充包的 `color` 只有 pokemon、castle、shinise、chara），`--color-t-tea`（令和 `#3F8F35`，江戶、昭和 `#3C8933`）、`test_tea_token_on_map`、DESIGN §3.2 的「茶」列一併拿掉。
