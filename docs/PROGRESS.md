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
| 旅人第三版（163 件：含成就服裝 6 件、散步的旅人）＋抽獎券（共用、不重複、NEW） | 等驗收；meta/wallet 規則要貼 | docs/旅人驗收.md、DESIGN.md §7.19b、§7.24 |
| 成就（紀念章帳：初訪 47 格＋40 個成就、新卡入手的成就章、這趟的成就、抽獎券） | 等驗收；規則不用改 | docs/成就驗收.md、DESIGN.md §7.25 |
| 手機版面（1024 以下）：第一階段（到得了、不壞）、第二階段（單手、少捲動：景點卡片三段高度、chip 軌道、站名板首頁、行程天數條、復原、打橫精簡 header 等） | 三個階段都在 main，等實機驗收（第三階段：位置小框、匯出選單、主畫面圖示、小字級三階等）；規則不用改 | docs/手機版計畫.md、docs/手機版第一階段驗收.md、docs/手機版第二階段驗收.md、docs/手機版第三階段驗收.md |

**原則的變更**（詳見 PLAN.md 的決策更新）：
- 內容一律取自實際來源，不用 LLM 寫簡介或念法；LLM 只用於翻譯與查證。原本的 enrich 已移除。
- 主題層改為擴充包；溫泉、酒、拉麵、居酒屋不做。7 縣舊的主題小店資料（`data/spots` 裡 `kind: theme`，1190 筆）2026-10-09 刪除（使用者決定）。
- 不標示「精選」；分數只用於排序與首頁總覽。

**待辦**：見根目錄 `TODO.md`。

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
