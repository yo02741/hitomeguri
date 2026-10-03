# ひとめぐり（一巡り）— 開發規劃

> 本文件是交給 Claude Code 的開工規格。請依「開發階段」逐階段實作，每階段完成驗收條件後再進下一階段。
> 前端的資訊架構、路由、User Stories、UI flow 與地區色規則見 **`UX-FLOW.md`**；視覺規格見 **`DESIGN.md`**。衝突時前端以這兩份為準。
> **成本前提：Firebase 維持免費的 Spark 方案，不升級 Blaze。** 唯一付費項目是 Claude API 用量。
> 本文件是最初的規格，後來的使用者決定以「決策更新」引用框或各 Phase 的「實作」說明標示；目前狀態與交接見 `docs/PROGRESS.md`。

---

## 1. 產品定位

**名稱**：ひとめぐり（一巡り／HITOMEGURI），意思是「走一趟」。介面上以三行版式呈現（ひとめぐり／一巡り／HITOMEGURI），與景點名稱區塊一致。
**標語**：來一趟日本，才知道它有多大。

**一句話**：一個「行程上游的發現層 + 旅前準備」—— 幫我決定日本某地「去哪、為什麼、什麼時候」，挑好後排成簡單行程匯出到 Google Maps，並在出發前學會這趟會用到的日文。

- **不做**：交通時間計算。
  - 原本也不做多人協作；使用者 2026-09-30 決定加入行程共編（邀請連結，成員都能編輯，見 `docs/行程共編驗收.md`）。
- **要做**：
  1. **大點層**：各地主要景點（依類型分段），先搭行程骨架。
  2. **主題層**：茶、酒（精釀）、香（老香鋪/香道）、溫泉、拉麵、寶可夢（寶可夢中心、ポケふた、Pokémon GO 活動）、御朱印・御守…可各自開關的主題地圖，用來「塞小點」。
     - 決策更新：主題層改為「擴充包」，只收筆數精簡、值得專程去的。目前是寶可夢、城（100 名城・續 100 名城）、老舖・茶屋、角色商店；溫泉、酒、拉麵、居酒屋因筆數多或不影響行程規劃而不做（使用者 2026-09-30 決定）。
  3. **地區特色**：名產與特色（例：愛媛柑橘、道後溫泉、岡山白桃/葡萄），附產季。
  4. **期間限定層**：超商限定、麥當勞限定、祭典、花火、賞楓等，有時間區間，依日期自動浮現。
  5. **個人化**：Google 登入、收藏、去過、自訂清單。
  6. **行程**：選景點 → 手動排進每一天 → 匯出 Google Maps / KML / CSV。
  7. **旅前準備**：依行程自動整理「這趟會遇到的日文」—— 地名念法、場景會話（分「會聽到的」與「要說的」）、地區特色詞彙、包裝常見字，出發前用 flashcard 練習。
  8. **台灣直飛**：各地區有哪些台灣機場（TPE / RMQ / KHH / TNN）可直飛、哪些航空公司，顯示在地區面板。
- **MVP 範圍**：名古屋（愛知，含岐阜近郊）與關西（京都、大阪、兵庫、奈良，含滋賀近郊）。種子清單見 `data/seed/seed_from_guides.json`（§5.0）。現已擴展到全國 47 縣。
- **視覺 mockup**：https://claude.ai/artifact/L6mTRQ4a9c44uNik145pS5 （以「v7 定稿」頁與 `DESIGN.md` 為準）。
- **參考**：traveldoko.com（地圖＋圓形照片 marker、精選/全部切換、地區篩選、右下角「本週限定」統計卡、匯出）。**不可爬取或複製其資料**。

---

## 2. 技術棧（全免費架構）

| 層 | 選擇 | 備註 |
|---|---|---|
| 前端 | Vue 3 + Vite + TypeScript + Pinia + Vue Router | |
| 樣式 | Tailwind CSS v4（`@tailwindcss/vite`，CSS-first `@theme`） | token 在 `web/src/styles/theme.css`，規格見 `DESIGN.md` |
| 地圖 | MapLibre GL JS + OpenFreeMap 底圖 | 免 key、免費；底圖做成可替換設定 |
| Hosting | Firebase Hosting（Spark） | 前端 + **靜態景點資料 JSON** 一起部署 |
| 使用者資料 | Cloud Firestore（Spark） | **只存使用者資料**（收藏、去過、清單、行程、學習進度） |
| 登入 | Firebase Auth（Google 登入，Spark） | 已在另一專案實作過，可沿用 |
| 資料 pipeline / 排程 | **GitHub Actions**（cron 排程 workflow）+ Python | 取代 Cloud Functions / Cloud Scheduler |
| 景點資料庫 | **Git repo 內的 JSON 檔（data/）** | 取代 Firestore 主資料與 Cloud Storage；PR 即審核佇列 |
| 語音 | 瀏覽器 Web Speech API（ja-JP） | 旅前準備的發音，免費、不存音檔 |
| LLM | Anthropic Claude API（Python SDK） | 只用於查證與翻譯實際來源（§5 決策更新）：`translate-summaries` 翻譯英文簡介、`verify-flights` 帶 web search 查證航線 |

### 為什麼這樣換
- **Cloud Functions** 需要 Blaze → 改用 GitHub Actions 定時跑 Python。
- **Cloud Storage for Firebase** 自 2026-02-03 起一律需要 Blaze（即使只用預設 bucket）→ bundle 改成靜態檔放在 Hosting。
- **Firestore 讀取**有每日免費額度（Spark：每日 50k 讀、20k 寫、20k 刪，1 GiB 儲存；實作時再到官方定價頁確認）→ 景點目錄完全不經 Firestore，前端讀 Hosting 上的靜態 JSON，Firestore 只剩個人資料的少量讀寫。
- GitHub Actions：public repo 免費無限制；private repo 每月有免費分鐘數，排程要控制在額度內（實作時確認目前額度）。

### Claude API
- `ANTHROPIC_API_KEY` 存在 **GitHub Actions secrets**，不可寫進程式或 commit；前端**絕不**直接呼叫 Claude API。
- 在 Anthropic Console 設定月用量上限。
- 模型（實作時到 https://docs.claude.com 確認最新 model string 與 Batch / web search 用法）：
  - model string 以程式為準：`pipeline/translate.py`（翻譯）、`pipeline/verify_flights.py`（查證航線）。
  - 原本規劃的「LLM 大量補全簡介、tags、詞彙」已停用（§5 決策更新）。

---

## 3. Repo 結構

```
/
├── CLAUDE.md                     # 給 Claude Code 的專案規則（見 §11）
├── PLAN.md                       # 本文件
├── firebase.json                 # Hosting + Firestore（無 Functions、無 Storage）
├── .firebaserc
├── firestore.rules
├── firestore.indexes.json
├── .github/workflows/
│   ├── ci.yml                    # 每次推送：前端 typecheck + vitest + build、pipeline lint + test + 資料檢查
│   ├── firebase-hosting.yml      # main 有變更 → 部署 Firebase Hosting
│   ├── pages.yml                 # main 有變更 → 部署 GitHub Pages
│   ├── harvest-timed.yml         # 每日：期間限定（直接提交 main）
│   ├── refresh-data.yml          # 每週／每月／每季：重新採集並開 PR（Phase 6）
│   ├── pipeline-pr-closed.yml    # 自動 PR 關閉後刪分支
│   ├── seed-region.yml           # 手動：各縣大點（推到 pipeline/* 分支）
│   ├── seed-pack.yml             # 手動：全國一次抓的項目（擴充包、地區特色、祭典、季節、鐵路…）
│   ├── verify-flights.yml        # 手動：查證直飛航線（需 ANTHROPIC_API_KEY）
│   ├── probe.yml                 # 手動：取回網頁看結構與使用條款（沙箱連不到外站時用）
│   └── cleanup-branches.yml      # 手動：刪除 pipeline/* 分支
├── data/                         # ★ 主資料（source of truth，人可讀、可 diff；依 id 排序）
│   ├── regions.json              # 47 縣名稱、地方、地區色
│   ├── spots/{prefecture}.json   # 大點
│   ├── specialties/{prefecture}.json
│   ├── festivals/{prefecture}.json
│   ├── rail/{prefecture}.json    # 鐵路路線與車站
│   ├── packs/*.json              # 擴充包（寶可夢、城、老舖・茶屋、角色商店）
│   ├── timed/{yyyy-mm}.json      # 期間限定
│   ├── seasons.json              # 氣象廳生物季節平年值
│   ├── phrases/                  # 旅前準備的會話與詞彙
│   ├── translations/             # 英文簡介的中文翻譯
│   ├── flights/taiwan_direct.json # 台灣直飛航線（未查證的不顯示）
│   └── seed/                     # 攻略候選、官方觀光網站清單、排除清單
├── pipeline/                     # Python 資料 pipeline
│   ├── sources/                  # wikidata、wikipedia、osm、jma、maff、pokefuta、meijo、官方觀光網站…
│   ├── major.py                  # 大點（seed-region）
│   ├── wiki.py                   # 維基簡介與念法
│   ├── specialties.py、festivals.py、seasons.py、rail.py、timed.py
│   ├── packs.py、pack_castles.py、pack_shinise.py、pack_chara.py  # 擴充包
│   ├── validate.py、diff_report.py  # 資料檢查、PR 變更報告
│   ├── build_bundles.py          # data/ → web/public/bundles/ 精簡 JSON
│   ├── models.py                 # pydantic schema（與 §4 對應）
│   └── cli.py                    # 所有指令的入口
└── web/                          # Vue 前端
    ├── public/bundles/           # build 時產生，不 commit
    └── src/
        ├── components/           # MapView、SpotPanel、PackBar、PackList、SectionNav、DatePicker…
        ├── composables/          # scrollSpy、prep、markedSpots、floating…
        ├── stores/               # Pinia：catalog、explore、user、marks、trips、finds
        ├── services/             # firebase、bundles、export、calendar、image…
        ├── data/                 # 擴充包、主題、地區、類型等前端定義
        ├── styles/               # theme.css（Tailwind token）、regions.css（自動產生）
        └── views/
```

---

## 4. 資料模型

### 4.1 景點目錄（Git repo 內 JSON，pydantic 定義）

**Spot**（`data/spots/{prefecture}.json` 內的陣列元素）
```ts
{
  id: string,                      // 穩定 id，例 "wd-Q12345" 或 "osm-node-123"
  name: { ja: string, kana?: string, romaji?: string, zh_tw: string, en?: string },
  location: { lat: number, lng: number },
  prefecture: string,              // slug，例 "kyoto"
  city?: string,
  kind: "major" | "theme",
  themes: string[],                // ["tea","sake","beer","incense","onsen","ramen", ...]
  tags: string[],
  featured: boolean,
  score: number,
  summary_zh: string,
  best_months?: number[],
  stay_minutes?: number,
  nearest_stations?: [{ name: { ja, kana, romaji, en? }, distance_m: number }],
  images: [{ url, author, license, source_url }],
  external_ids: { wikidata?, osm?, google_place_id? },
  sources: [{ url, fetched_at }],
  goshuin?: { available: boolean, limited?: string, note_zh?: string },   // 御朱印（限定款另掛 timed item）
  omamori?: { note_zh: string }[],                                         // 有特色的御守
  status: "published" | "closed",  // 待審核的資料只存在於未合併的 PR
  verification?: { checked_at, result, notes },
  updated_at: string
}
```

**Specialty**（`data/specialties/{prefecture}.json`）
```ts
{
  id, name: { ja, kana, romaji, zh_tw },
  prefecture, area?,
  category: "fruit"|"food"|"craft"|"onsen"|"drink"|...,
  season_months?: number[],
  summary_zh,
  source_type: "gi" | "regional_trademark" | "kyodo_ryori" | "llm_research",
  sources: [{ url, fetched_at }],
  related_spot_ids?: string[],
  updated_at
}
```

**TimedItem**（`data/timed/{yyyy-mm}.json`）
```ts
{
  id, kind: "product" | "event" | "seasonal",
  category: string,                // "konbini","mcdonalds","fireworks","autumn_leaves","festival",...
  brand?: string,
  title: { ja, zh_tw }, summary_zh,
  scope: "national" | "regional" | "spot",
  prefectures?: string[], location?: { lat, lng }, spot_id?: string,
  valid_from: string, valid_to: string,
  relevance: number,
  image?: { url, source_url },
  source_url: string,
  updated_at
}
```

**Phrase**（`data/phrases/...`）
```ts
{
  id: string,
  context: { theme?: string, spot_kind?: string, specialty_id?: string, situation: string },
                                   // situation 例："ramen_shop_order","onsen_entry","train_ticket","konbini_checkout"
  direction: "hear" | "say" | "read",
                                   // hear=會被問/會聽到（練聽懂）；say=要開口說；read=招牌/包裝/站牌上會看到
  ja: string, kana: string, romaji: string, zh_tw: string,
  answer_hint?: { ja, kana, zh_tw }, // hear 類的建議回答，例：「にんにく入れますか？」→「お願いします / 大丈夫です」
  note_zh?: string,                // 使用情境說明
  priority: 1 | 2 | 3,             // 1=一定會遇到
  reviewed: boolean
}
```

### 4.2 前端 bundle（`build_bundles.py` 產生，部署到 Hosting）
- `bundles/_index.json`：各都道府縣的版本號、筆數。
- `bundles/map/{prefecture}.json`：地圖用精簡資料（id、座標、名稱、kind、themes、featured、縮圖）。
- `bundles/detail/{prefecture}.json`：完整景點資料（點 marker 時載入該區的 detail 檔，可 cache）。
- `bundles/specialties/{prefecture}.json`：地區特色一縣一檔（深度探索、旅前準備只載入用到的縣；版本在 `_index.json` 的 `specialties`）。全國一個檔的 `bundles/specialties.json` 暫時照寫，給還沒更新的舊版前端用。
- `bundles/timed/current.json`（只含尚未過期的）、`bundles/phrases.json`。

**FlightRoute**（`data/flights/taiwan_direct.json`）
```ts
{
  origin: "TPE" | "TSA" | "RMQ" | "KHH" | "TNN",
  dest: string,                    // IATA，例 "NGO","KIX","UKB"
  airlines: [{ name_zh: string, iata?: string }],
  frequency_note_zh?: string,      // 例「每日多班」「每週約 3 班」
  season?: string,                 // 例「2026 冬季班表」（航空業 IATA 夏/冬季班表）
  verified: boolean,
  checked_at: string,
  sources: [{ url, fetched_at }]
}
```

### 4.3 Firestore（只存使用者資料）
行程與旅行紀錄是同一個 entity（`trips`，以 `status` 區分），自訂地點存在 `places`，「去過」由已完成的 trip 與 marks 推導。完整定義見 **`UX-FLOW.md` §3**。
```
users/{uid}
users/{uid}/trips/{tripId}
users/{uid}/trips/{tripId}/progress/{phraseId}
users/{uid}/places/{placeId}
users/{uid}/marks/{spotId}
users/{uid}/lists/{listId}
```

### 4.4 地區資料
`data/regions.json`：都道府縣的名稱（ja / kana / romaji / zh_tw）、所屬地方、地區色 tokens（強調色＋整頁中性色），以及沒有地區語境時用的 `national`（全國色）。規則見 **`UX-FLOW.md` §2**。縣界 GeoJSON（国土数値情報 N03，簡化後）放在 `web/public/geo/prefectures.json`，用於前端判斷目前焦點縣與自訂地點所屬縣。

---

## 5. 資料 Pipeline

### 流程
```
採集（GitHub Actions）→ 去重、對齊 Wikidata → 資料檢查（validate-data）＋變更報告（diff-report）→ 開 PR（= 審核佇列）→ 使用者 review 合併 → main 的推送自動部署（firebase-hosting.yml、pages.yml）
```
原則：**能用結構化開放資料撈的不交給 LLM 想；LLM 負責翻譯、摘要、分類、判斷、驗證與詞彙生成，且必須保留來源 URL。**

> **決策更新（使用者，Phase 3 後）：所有內容一律來自網路上的實際來源，不用 LLM 產生網路上沒有的內容。**
> - 景點簡介不由 LLM 撰寫；改取自有授權可用的來源（例：維基百科開頭段落，CC BY-SA，須標示出處與授權），沒有來源就不顯示。
> - 假名念法取自來源：Wikidata P1814、OSM `name:ja-Hira`、日文維基百科開頭括號內的讀音；都沒有時留空，不由 LLM 猜。
> - LLM（Claude API）只可用於「查證與擷取」：例如帶 web search 查航線是否存在、從已取得的網頁擷取欄位，結果必須附來源 URL。這類工作放在未來的排程（Phase 6）才需要 `ANTHROPIC_API_KEY`。
> - 下方 §5.7 enrich 的「LLM 補寫簡介／念法」停用；§5.5、§5.6 若涉及 LLM 生成，實作前需再與使用者確認。

### 5.1 大點
- **來源**：
  - Wikidata SPARQL（https://query.wikidata.org/）：位於某都道府縣（`P131*`）的觀光地、寺社、城、庭園、博物館等；取座標 `P625`、圖片 `P18`、假名表記 `P1814`、各語言標籤、sitelinks 數。都道府縣 QID 實作時查詢確認，不要硬寫猜測值。
  - OpenStreetMap（Overpass API）：`tourism=attraction|museum|viewpoint`、`historic=*` 補漏。
- **精選分數**（權重做成設定可調）：Wikipedia 瀏覽量（Wikimedia REST pageviews API，看 zh / en / ja）、Wikidata sitelinks 數、文化指定（世界遺產、國寶、特別名勝/名勝、特別史跡）。各區取前 N 名或門檻以上 → `featured: true`。
  - **不在介面標示「精選」**（使用者決定）：公開資料裡沒有「第一次去該去哪」的訊號（例：沖繩波上宮不在官方觀光網站瀏覽排行前 400，Wikivoyage 把它和玉陵、識名園並列），分數只能反映知名度，不等於推薦。分數用於清單段內排序、地圖照片與名稱標籤的優先順序；`featured` 只用來產生首頁的全國總覽（`bundles/featured.json`，各縣分數前 20）。
- **圖片**：Wikidata `P18` → Wikimedia Commons（`Special:FilePath/{file}?width=400`），**存作者與授權並在 UI 顯示 credit**。
- **最近車站**：OSM `railway=station`，取 `name`、`name:ja-Hira`、`name:ja-Latn`、`name:en`（缺的再由 LLM 補、標記待確認）。

### 5.0 種子清單（攻略）
- `data/seed/seed_from_guides.json`：從我先前兩份攻略（名古屋、關西）抽出的 77 個景點/店家、13 個地區特色、7 條直飛航線。
- **只當候選名單**：攻略本身是 AI 生成，座標、營業狀態、創業年份、航線全部要經 pipeline 對齊 Wikidata / OSM / 官網並驗證，不可直接上線。
- `guide_tier: "S" | "A"` 作為 featured 分數的加分訊號；不在 Wikidata/OSM 大點候選內的種子要主動補查。
- **攻略的文字不可沿用**（含 emoji 與口語），簡介一律依 §6a 文風重新生成。

### 5.2 主題小店
- **OSM 先撈**：酒 `craft=brewery|winery|distillery`、`shop=alcohol`；茶 `shop=tea`、`amenity=cafe`+`cuisine=tea`；拉麵 `cuisine=ramen`；溫泉 `natural=hot_spring`、`amenity=public_bath`+`bath:type=onsen`。
- **OSM 不足的主題**（老香鋪/香道、地方香水、特定老舖）：agent（Sonnet + web search）按地區搜尋候選，再與 OSM / 官網交叉比對座標。
- **不可**長期儲存 Google Places 或食べログ的內容；最多存 `google_place_id` 產生 Google Maps 連結。
- **寶可夢**（theme `pokemon`）：
  - 寶可夢中心 / 寶可夢商店：官方店舖一覽頁取得名稱與地址，再對齊 OSM 座標。
  - ポケふた（寶可夢人孔蓋）：官方有各地設置資訊，依都道府縣收錄。
  - Pokémon GO：只收官方公告的**日本地區活動**（掛 timed item）。**不收 PokéStop / 道館座標**（Niantic 資料，不可抓取）。
  - **IP 注意**：介面不使用寶可夢角色圖、logo 或官方圖片；marker 用自家的文字/圖示，只存官方頁面連結。
- **御朱印・御守**（theme `goshuin`）：
  - 對象是大點與主題層中的神社、寺院（Wikidata / OSM `amenity=place_of_worship` + `religion=shinto|buddhist`）。
  - agent 以各寺社官網為主查詢：是否授與御朱印、有無限定御朱印、特色御守，寫入 `goshuin` / `omamori` 欄位並附來源。
  - **期間限定御朱印**（季節、祭典、正月）另建 timed item（`category: "goshuin"`），出現在期間限定清單。

### 5.2b 台灣直飛航線
- 航線會隨 IATA 夏季 / 冬季班表變動，屬「會過期的資料」。
- 來源：各航空公司官網航線頁、桃園 / 台中 / 高雄機場官網的航班資訊；由 agent（Sonnet + web search）每季檢查，每筆存來源與 `checked_at`。
- 不存票價、不做比價；前端只顯示「哪些機場直飛、哪些航空公司」，並附官網連結。
- 以 `seed_from_guides.json` 的 flights 為初始候選（`verified: false`），驗證後才上線。

### 5.3 地區特色
- 已接上：農林水產省「うちの郷土料理」（各縣地域検索頁 `search_menu/area/{slug}.html`，只取名稱與網址）；日文維基分類「ご当地ラーメン」（特色拉麵，使用者要求當作特色小吃）、「名古屋めし」、「{縣}の郷土料理」；攻略種子。每項對到 Wikidata／維基條目取中文名、念法、Commons 照片、維基簡介（中文優先）。`seed-specialties` 在 `seed-pack.yml` 一個 job 跑全國。
- 還沒接：地理的表示（GI）、地域團體商標（茶、酒、水果等），之後補。
- 不用 LLM 補寫介紹（使用者決定）；念法取自 Wikidata／維基開頭。
- 溫泉地算景點（有位置、可排行程），不放地區特色；個別日歸溫泉之後做成擴充包（使用者確認）。

### 5.3b 季節（深度探索）
- 來源：氣象廳「生物季節観測」累年値 CSV（`https://www.data.jma.go.jp/sakura/data/ruinenchi/{種目}.csv`，Shift_JIS）的平年值欄；利用條件為公共データ利用規約（第1.0版），須標示出處。
- 取梅開花（001）、櫻花開花（004）與滿開（005）、紫藤開花（007，2021 年起停止觀測，平年值仍在）、繡球花開花（009）、銀杏黃葉（013）、楓葉紅葉（015）；觀測站對到縣（`pipeline/seasons.py` 的 STATIONS），寫 `data/seasons.json`。`seed-seasons` 在 `seed-pack.yml` 跑。
- 沖繩等地的「櫻花」是氣象廳的代替種目（ひかんざくら），照樣顯示。

### 5.3c 祭典（深度探索）
- 來源：日文維基分類「{縣}の祭り」（含一層子分類），經 Wikidata P31 篩掉山鉾、神社、人物、團體；總論條目（一覧、三大）與開頭段落寫著已停辦的不收。依日文維基一年瀏覽量取前 60 個。
- 月份：Wikidata P837／P2922 的標籤；沒有時取日文維基開頭的「毎年○月」「○月…行われる」「○月下旬」（舊曆不取）。都沒有就不寫。
- 名稱、念法、照片、簡介（中文優先）同地區特色的做法；座標取 P625，沒有時用舉行地點（P276）的座標。`data/festivals/{縣}.json`，bundle 一縣一檔。`seed-festivals` 在 `seed-pack.yml` 跑。

### 5.4 期間限定
- 來源（實作時確認網址，遵守 robots.txt 與 ToS）：PR TIMES（RSS）、7-Eleven / FamilyMart / LAWSON / 日本麥當勞 新商品或新聞頁、各地觀光協會活動頁（花火、祭典、賞楓、賞櫻）；必要時 agent 搜尋。
- LLM：判斷旅客相關性、抽出 `valid_from/valid_to`、判斷全國/地區/景點限定、寫繁中摘要。
- 只存事實摘要 + 來源連結；官方圖片只存連結。

### 5.5 旅前準備詞彙（phrases）
- **主題會話模板**（`phrases/themes/{theme}.json`）：每個主題 × 情境生成一次、人工 review 後長期共用。例：
  - 拉麵：食券機、にんにく入れますか（hear）、麺のかたさ かため/ふつう/やわらかめ（hear + say）、替え玉（say）
  - 溫泉：タオル、入れ墨（read/hear）
  - 酒藏：試飲（say/read）；神社：御朱印（say）
  - 通用（`common.json`）：買票/乗り換え/IC カード、超商「温めますか」「袋いりますか」（hear）、包裝字 季節限定・地域限定・新発売・数量限定（read）
- **景點與車站念法**：直接來自 Spot 的 `name.kana/romaji` 與 `nearest_stations`（Wikidata P1814 / OSM 優先，LLM 補的要標記 `reviewed: false`）。
- **地區特色詞彙**：來自 Specialty 的 `name.kana/romaji`。
- 生成時要求 LLM 輸出 JSON schema；**地名念法錯誤率高（例：大阪「放出」はなてん），不可只靠 LLM，必須優先使用結構化來源**。

### 5.6 去重 / 實體對齊
- 座標距離（例 < 80m）+ 名稱相似度（ja 正規化後）；有 OSM `wikidata=*` tag 時優先使用。

### 5.7 LLM 補全與驗證
- **enrich**（已停用，見 §5 決策更新）：原本規劃用 Message Batches API 讓 LLM 補寫簡介與念法。
- **verify**：針對低分、有衝突或久未檢查的資料，以 web search 確認營業狀態、限定商品/活動真實性與日期，結果寫入 `verification` 並保存來源 URL。
- **審核 = PR review**：每次 pipeline 產出開一個 PR，PR 描述列出新增/修改/下架筆數與需要特別看的項目（驗證衝突、LLM 補的念法）。我合併後才上線。

### 5.8 排程（GitHub Actions）
| Workflow | 頻率 | 內容 |
|---|---|---|
| `harvest-timed.yml` | 每日 17:50 JST | 期間限定（氣象廳），有變更直接提交 main 並觸發部署 |
| `refresh-data.yml` | 每週一；每月、每季第一週範圍較大 | 擴充包、祭典、地區特色、維基簡介、各縣大點重採 → 開 PR（Phase 6） |
| `pipeline-pr-closed.yml` | 自動 PR 關閉時 | 刪除 pipeline/* 分支 |
| `firebase-hosting.yml`、`pages.yml` | push 到 main | 產生 bundles → build 前端 → 部署（只部署 Hosting，Firestore 規則由使用者在 Console 發布） |
| `ci.yml` | 每次推送 | 前端 typecheck + vitest + build；pipeline lint + test + 資料檢查 |

- 所有 workflow 支援 `workflow_dispatch` 手動觸發，並可指定都道府縣。
- 注意 GitHub Actions 單一 job 時間上限與每月分鐘數；大範圍任務依都道府縣分批、跨多次執行。
- 首次大量匯入也可在本機跑 `python -m pipeline.cli seed-region kyoto`，再手動開 PR。

---

## 6. 前端功能

- **地圖**：MapLibre，主題符號 marker（`DESIGN.md` §6）+ clustering；縣內顯示全部大點、可依類型篩選；擴充包（一次開一個，地圖上方的列）；鐵路路線；地圖跨縣界自動切換地區（`UX-FLOW.md` §1.3）。
- **景點卡片**：照片（含 credit）、日文名稱＋假名＋羅馬拼音、繁中簡介、最佳季節、建議停留、最近車站、來源連結、「在 Google Maps 開啟」、收藏 / 去過 / 加入行程。
- **地區頁**：該都道府縣的地區特色（名產、產季）。
- **期間限定**：探索頁左欄列出目前焦點縣＋全國、尚未過期的 timed items，依結束日排序，點擊在地圖標示（`UX-FLOW.md` A6）。
- **搜尋**：景點名稱（ja / kana / romaji / zh）與類別，前端對 bundle 搜尋。
- **個人化**（需登入）：收藏、去過、自訂清單；「去過」在地圖以不同樣式顯示。
- **行程（Trip）**：見 Phase 7。
- **旅前準備（Prep Pack）**：見 Phase 7。
- **RWD**：手機優先（旅途中用手機看）。
  - **不收古墳**（使用者決定）：名稱以古墳／古墳群／天皇陵／御陵結尾者在 seed-region 排除（`major.drop_non_spots`）。
  - **主題層暫停**（使用者決定先專注景點）：茶、酒、溫泉、拉麵、寶可夢、御朱印的 UI 先隱藏，資料保留。之後重新定義：酒要的是當地特色酒而非店家；茶要的是特色茶與茶館。
  - **不標示精選**（使用者決定）：見 §5「精選分數」。清單只分「景點／地區特色」，景點依類型分段、段內依分數。
  - **手機版**（2026-10-03 使用者解除暫緩）：原本只調整桌機版、手機只求能開不壞版；現在手機版面一起做。新功能與改版要同時看 390 寬的手機與桌機。

---

## 6a. 視覺與文案

### 視覺規格
調性、顏色、字體、版面、符號、元件、地圖樣式全部以 **`DESIGN.md`** 為準（Tailwind v4 token：`web/src/styles/theme.css`、`regions.css`）。
地區色的決定規則見 **`UX-FLOW.md` §2**。本節只保留文案規則。

### 文案原則：不要有 AI 味（重要）
介面上的每個字都要像旅遊書或車站標示，而不是 AI 產品在解釋自己。
- **不解釋功能、不說明為什麼做這個**。PLAN.md 裡的設計理由是給開發者看的，**絕對不可出現在 UI 上**。
- **不做 onboarding 說明卡、功能介紹清單、歡迎訊息**。功能靠版面自己說話；真的需要時，一行短字即可。
- **標籤用名詞，短**：「收藏」「去過」「加入行程」「匯出」「本週限定」，不用「一鍵輕鬆…」「智慧推薦…」「探索…的無限可能」。
- **空狀態一句話**：例「還沒有收藏的地方」，不加鼓勵語、不加 emoji。
- **不出現**：✨ 等 sparkle 圖示、「AI 生成」「AI 推薦」「Powered by AI」標記、紫藍漸層、emoji、驚嘆號、「讓我們…」「您」式客服口吻。
- 旅前準備三區用文字標籤「聽」「說」「讀」（或簡潔的線條 icon），不用 emoji。
- 資料來源以小字「來源」連結呈現，不寫說明段落。
- Tooltip / 說明文字只在不看會用錯的地方出現。

### LLM 生成內容的文風（寫入 enrich / phrases 的 prompt）
- 寫法參考旅遊指南書：事實、具體、短。簡介 60–100 字。
- 用具體資訊取代形容詞：年代、特色、看什麼、吃什麼、什麼季節最好。
- **禁用句型**：「不僅…更是…」「值得一提的是」「無論你是…都能…」「絕對不能錯過」「必訪」「宛如」「讓人流連忘返」「完美融合」、結尾總結句、反問句、驚嘆號、emoji。
- 不對讀者說話（不用「你可以」「推薦大家」）。
- pipeline 產生後以規則檢查禁用詞，命中的重新生成，並列在 PR 描述中。

---

## 7. Firestore 安全規則要點

- `users/{uid}/**`：僅 `request.auth.uid == uid` 可讀寫；其餘路徑一律拒絕。
- 景點目錄不在 Firestore，無需規則。
- 對寫入內容做基本驗證（欄位型別、陣列長度上限），避免單一使用者寫爆免費額度。

---

## 8. 匯出

- **CSV**：名稱（ja / zh）、座標、Google Maps 連結、備註。
- **KML**：可匯入 Google My Maps；行程匯出時每天一個 folder。
- **Google Maps 轉乘連結**：相鄰景點間用 Maps URLs（`https://www.google.com/maps/dir/?api=1&origin=...&destination=...&travelmode=transit`）；一天多點時可用 `waypoints`，但各平台支援的 waypoint 數量有限，實作時確認並在超過時拆段。

---

## 9. 開發階段與驗收條件

### Phase 0 — 專案骨架
- repo 結構、Vue + Vite + TS、Firebase 初始化（**只開 Hosting / Firestore / Auth**，Spark 方案）、Emulator Suite、pipeline Python 環境（pyproject / uv 或 pip）。
- Google 登入可運作（沿用既有實作）。
- ✅ 驗收：`firebase emulators:start` 可跑，前端能登入並顯示空白地圖；確認專案沒有啟用任何需要 Blaze 的服務。

### Phase 1 — 名古屋＋關西大點（端到端打通）
- 狀態：完成；之後擴展到全國 47 縣（Phase 6 的一部分）。簡介與念法改取自維基百科，不用 LLM 補全。
- 先用京都府跑通整條 pipeline：`seed-region kyoto`：Wikidata + OSM + 種子清單 → 去重 → 精選分數 → Batch 補全 → `data/spots/kyoto.json` → `build_bundles.py` → 地圖顯示。
- 跑通後依序擴到 aichi、osaka、hyogo、nara，再補 gifu、shiga（近郊一日遊）。
- ✅ 驗收：六個以上府縣的精選與全部景點上圖；`seed_from_guides.json` 的 S 級景點都在精選內（例：伏見稻荷、清水寺、名古屋城、熱田神宮、東大寺、北野異人館）；照片有 credit，卡片有假名與最近車站。

### Phase 2 — 主題層（MVP 範圍）
- 狀態：主題層改為「擴充包」（寶可夢、城、老舖・茶屋、角色商店，見 §1）；原本 OSM 撈的茶、酒、拉麵、溫泉小店資料保留在 7 縣的 `data/spots`，前端不顯示。
- OSM 撈茶、酒、拉麵、溫泉；agent 搜尋老香鋪/香道；寶可夢中心、ポケふた；寺社御朱印・御守欄位；LayerToggle。
- ✅ 驗收：宇治、西尾看得到茶的主題點；京都市內看得到老香鋪；大阪、京都、名古屋的寶可夢中心上圖；伏見稻荷、熱田神宮卡片有御朱印資訊。

### Phase 3 — 地區特色＋台灣直飛
- 狀態：地區特色完成（農林水產省郷土料理＋維基分類）；GI 與地域團體商標還沒接。直飛航線候選未查證（需 `ANTHROPIC_API_KEY`），網站不顯示。
- 接 GI、地域團體商標、郷土料理資料，全國先匯入（量不大）；種子清單的 specialties 一併對齊。
- 驗證台灣直飛航線，地區面板顯示。
- ✅ 驗收：選京都府顯示宇治茶等與產季；選愛知顯示八丁味噌、西尾抹茶；地區面板顯示已驗證的直飛航線與來源。

### Phase 4 — 期間限定
- PR TIMES + 超商 + 麥當勞 + 賞楓/花火/祭典；探索頁左欄的期間限定清單；過期自動移除。
- 實作（2026-09-29，v1）：來源只有氣象廳本季的生物季節觀測（さくら開花／滿開、いちょう黄葉、かえで紅葉；
  公共データ利用規約 1.0，標示出典）。`pipeline/timed.py`、`harvest-timed.yml`（每天，直接提交 main 並觸發部署）、
  `bundles/timed.json`；前端在地圖左側面板、深度探索「期間限定」、旅前準備（行程期間內）。
  不收：7-Eleven（規約禁止私人使用以外的複製、頒布）、PR TIMES（一般規約第 6 條：只限閲覽、私人使用、引用）；
  FamilyMart、LAWSON、麥當勞的規約頁沒找到，推定相同。花火、祭典的當年日期沒有開放來源（BODIK 自治體イベント一覧 API 暫時 502，待評估）。
- ✅ 驗收：清單只顯示未過期項目並依結束日排序，地區限定商品掛在正確都道府縣。

### Phase 5 — 個人化與匯出
- 收藏、去過、清單；CSV / KML / Google Maps 轉乘連結。
- 實作（2026-09-29）：`web/src/stores/marks.ts`、`components/SpotActions.vue`、`views/MeView.vue`、`ListView.vue`、`LogView.vue`、`services/export.ts`。
  CSV、KML 每個景點附 Google Maps 連結；有順序的轉乘路線連結放到 Phase 7（行程的每一天）。
- ✅ 驗收：登入後收藏幾個點 → 匯出 KML 可成功匯入 Google My Maps。

### Phase 6 — 自動化排程 + PR 審核流程 + 擴展全國
- 所有 GitHub Actions workflow、自動開 PR、自動部署；依都道府縣逐步 seed 全國。
- 實作：`refresh-data.yml` 每週一（寶可夢、城、祭典）、每月第一週（再加老舖、角色商店、地區特色、各縣維基簡介與念法）、每季第一週（再加各縣大點重採）自動採集，推到 `pipeline/refresh-<run>` 並開 PR；PR 描述附 `diff-report`（各檔新增、刪除、修改，簡介／念法／中文名／座標的變更）與 `validate-data`（格式、依 id 排序、schema、來源、禁用詞、bundle 能否建出），檢查結果也寫成 commit 狀態「資料檢查」。新的自動 PR 取代還沒合併的舊 PR；PR 關閉後 `pipeline-pr-closed.yml` 刪除分支。期間限定維持每天直接提交 main（`harvest-timed.yml`）。
- ✅ 驗收：排程連續跑一週無錯誤、每次產出都是可 review 的 PR；合併後網站自動更新；全國 bundles 產生完成；GitHub Actions 分鐘數與 Firestore 用量都在免費額度內。

### Phase 7 — 行程 + 旅前準備
**7a. 行程（Trip）**
- 從景點卡片「加入行程」；行程編輯頁可建立天數、拖曳景點排進某天、未排入的放「待排」區。
- 每天顯示當日景點地圖；一鍵產生當日 Google Maps 轉乘連結；整趟匯出 KML / CSV。
- 不做交通時間計算。

**7b. 旅前準備（Prep Pack）**
- 由行程**在前端即時組裝**（不需後端、不即時呼叫 LLM）：
  1. **地名與車站**：行程內所有景點與其最近車站的 漢字 / かな / romaji / 英文（解決「買票時不知道上野怎麼念」）。
  2. **場景會話**：依行程涵蓋的 themes 與景點類型，帶入對應主題模板＋通用會話；分三區顯示：
     - **聽**（hear）：會被問、會聽到的，附建議回答（例：「にんにく入れますか？」→ 要／不要怎麼回）
     - **說**（say）：要開口說的
     - **讀**（read）：招牌、包裝、站牌上會看到的字
  3. **地區特色詞彙**：行程所在都道府縣的 specialties（例：白桃 はくとう）。
  4. **期間限定詞**：行程日期內相關 timed items 的關鍵字。
- 依 `priority` 排序，可篩選「只看一定會遇到的」。
- 每個詞可點擊用 Web Speech API（`lang="ja-JP"`）念出來。
- **Flashcard 練習**：正面日文（或聽音）、背面中文與情境；簡單 Leitner box 間隔重複，進度存 `users/{uid}/trips/{tripId}/progress`。
- **旅途模式**：手機版依行程天數排序，當天會用到的詞排最上面；支援離線（PWA 快取 phrases bundle）。
- **（之後再做）客製化加強**：若想針對特定景點即時生成更細的詞彙（例：德島拉麵的生卵、ライス），前端寫入 `users/{uid}/prep_requests/{id}`，由排程 workflow 撿起來生成後寫回；Spark 下不使用 Cloud Functions。
- 實作（2026-09-29）：`stores/trips.ts`、`services/trip.ts`、`views/TripsView.vue`、`TripView.vue`、`PrepView.vue`、`PracticeView.vue`、`services/prep.ts`；
  會話在 `data/phrases/common.json`、`themes/*.json`（109 句，`reviewed: false`，待人工校對），`build-bundles` 產生 `bundles/phrases.json`。
  主題依行程景點類型（寺社、博物館、城、樂園、公園）、名稱含「温泉」、所在縣的地區特色（拉麵、茶、酒）選取。
  尚未做：旅途模式的離線（PWA）、客製化加強、期間限定詞（Phase 4 之後接上）、自訂地點、照片匯入、行程頁的直飛航線。
- ✅ 驗收：建立一個「京都＋宇治 3 天」行程 → 旅前準備頁列出所有景點與車站念法、茶／拉麵等主題會話（hear/say/read 分區）、宇治茶等特色詞；每個詞可發音；flashcard 可練習並保存進度。

---

## 10. 已確認的外部限制（實作時仍需到官方文件再確認最新狀態）
- Cloud Storage for Firebase 自 2026-02-03 起需要 Blaze → 本專案不使用。
- Cloud Functions 需要 Blaze → 本專案不使用，改 GitHub Actions。
- Firestore Spark 有每日讀寫額度 → 景點目錄走靜態檔。

---

## 11. 給 Claude Code 的工作規則（請同步寫入 CLAUDE.md）

- 一次只做一個 Phase；每個 Phase 結束時總結做了什麼、還缺什麼，等我確認再繼續。
- **不得引入任何需要 Firebase Blaze 方案的服務**（Cloud Functions、Cloud Storage、Extensions 等）；需要後端運算一律用 GitHub Actions 或本機 script。
- 開發與測試一律使用 Firebase Emulator；**未經我同意不要執行 `firebase deploy`**。
- 任何 API key、service account 不可 commit；本機用 `.env`（加入 .gitignore），CI 用 GitHub Actions secrets。前端不得包含 Claude API key。
- 外部資料採集：遵守各站 robots.txt 與使用條款、設定合理 rate limit 與 User-Agent；不爬 traveldoko、Google Maps、食べログ。
- 每筆資料都要保留來源 URL 與取得時間；**不用 LLM 產生網路上沒有的內容**（簡介、念法等一律取自實際來源，沒有就留空）；LLM 只用於查證與擷取，且必須附來源 URL。
- LLM 呼叫先用小量資料（例 20 筆）驗證 prompt 與輸出 schema，再跑整區 batch；記錄 token 用量並寫進 PR 描述。
- `data/` 的 JSON 以穩定順序（依 id 排序）與固定縮排輸出，讓 PR diff 可讀。
- **UI 文案遵守 §6a「不要有 AI 味」**：不把本文件的設計理由、功能說明寫進介面；不加 onboarding 說明卡、emoji、sparkle 圖示、「AI」標記。寫任何 UI 文字前先問：車站標示或旅遊書會這樣寫嗎？
- LLM 生成的簡介與詞录說明遵守 §6a 文風規則，並做禁用詞檢查。
- 樣式只用 `DESIGN.md` 定義的 token 與元件配方；不得寫死色碼。`regions.css` 由 `python -m pipeline.cli build-region-css` 從 `data/regions.json` 產生，不可手改。
- Python 用 type hints + pydantic；前端用 TypeScript strict。
- 不確定的外部 API 細節（網址、參數、額度、model string）先查官方文件再實作，不要猜。
