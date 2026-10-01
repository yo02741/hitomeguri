# ひとめぐり — UI Design Guideline

> 前端視覺規格。token 實作在 `web/src/styles/theme.css`（Tailwind CSS v4）與自動產生的 `regions.css`。
> 資訊架構、路由與地區色的決定規則見 `UX-FLOW.md`；文案原則見 `PLAN.md` §6a。
> 視覺參考 mockup：https://claude.ai/artifact/L6mTRQ4a9c44uNik145pS5 的「v7 定稿」頁（全站流程、所有畫面、品牌、地區色）。其他頁面為早期版本，僅供參考。

---

## 1. 原則

1. **內容先於介面**：地圖、照片、地名是主角。介面用細線與留白區隔，不用大面積陰影與卡片堆疊。
2. **顏色有分工**：中性色撐起介面，**主題色**只用來標記「這是什麼」，**地區色**只用來標記「這是哪裡」。兩者永遠不互相取代。
3. **地名就是設計**：假名／漢字／羅馬拼音三行的名稱區塊是本產品的招牌，每個景點、每個地名都用同一套版式。
4. **沒有 AI 味**：不解釋功能、不加 emoji、不用 sparkle 圖示（完整規則見 `PLAN.md` §6a）。
5. **柔和**：地區色一律使用去飽和、疊白後的版本；需要強調時用 `strong`，不回頭用原色。
6. **整個介面帶著地區色**：背景、header、線條、文字都由目前的地區色產生（地區色滲透），不使用純白底與純黑字；沒有地區語境時使用「全國色」。
7. **動起來要有意思**：動態、光澤、漸層、3D 都可以用，用在回應操作（蓋章、收卡）、說明位置關係（換頁、面板）與表現季節和地區（飄落）；不做只為了吸引注意、一直重複的動畫。

---

## 1b. 品牌

### 名稱
- 名稱是 **ひとめぐり**，漢字寫作 **一巡り**，羅馬拼音 **HITOMEGURI**，意思是「走一趟」。
- 名稱不翻譯成中文、不加前後綴（不用「日本ひとめぐり」「ひとめぐり App」）。
- 內文中提到產品時寫「ひとめぐり」。

### Wordmark
與景點名稱區塊同一套版式：假名在上、漢字居中、羅馬拼音在下。mockup「v7 定稿」頁的「品牌・wordmark 與標語」畫板有各版本實例。

| 版本 | 用在 | 規格 |
|---|---|---|
| Hero（三行） | 首頁、關於頁、商店截圖 | 假名 `tracking-kana` → 漢字 `font-black`（字級依版面，漢字至少是假名的 4 倍）→ HITOMEGURI `font-latin font-bold uppercase`，字距 0.4–0.5em |
| Header（橫排） | 每頁 header 左側 | 左：假名 10px 疊在「一巡り」22px 900 上方；右：HITOMEGURI 13px `font-latin font-semibold`，底部對齊；整塊是回首頁的連結 |
| 地區色上 | 海報區、分享圖 | 同 Hero 三行，文字用 `text-on-region`，可加 `bg-region-accent` 正圓裝飾 |
| 最小尺寸 | 頁尾、小型標示 | 只用單行：「一巡り」16px 900，或「ひとめぐり」14px 700，或 HITOMEGURI 13px |

- 「一巡り」與「ひとめぐり」一律加 `lang="ja"`，使用 Noto Sans JP（「巡」「り」要是日文字形）。
- 不做斜體、描邊、漸層、陰影；不把三行拆開重排順序。
- Logo 圖形尚未設計，目前只使用 wordmark；不要自行加上 icon 或 emoji。

### 標語
- 全文固定為：**來一趟日本，才知道它有多大。**（全形逗號與句號，不改字、不加驚嘆號）
- 只出現在：首頁（地區模式）左欄標題、關於頁、商店上架描述與截圖、分享圖。
- 不放在 header、不放在每一頁、不當成按鈕文字或空狀態文案。

### 頁面標題
`<title>`：「{頁面名稱}｜ひとめぐり」，首頁只寫「ひとめぐり」。

---

## 2. 技術設定

- Tailwind CSS v4，CSS-first 設定，不使用 `tailwind.config.js`。
- Vite 專案使用 `@tailwindcss/vite` plugin；入口 CSS 為 `web/src/styles/theme.css`（已 `@import "tailwindcss"`）。
- 字體以 Google Fonts 載入：Noto Sans TC（400/500/700/900）、Noto Sans JP（400/700/900）、Barlow Semi Condensed（500/600/700），`display=swap`。
- `regions.css` 由 `data/regions.json` 產生（pipeline 指令 `build-region-css`），**不可手改**。
- 共用樣式組合寫成 Vue 元件，不用 `@apply` 堆 class；只有在 MapLibre 等第三方 DOM 無法套 class 時才用 CSS。

---

## 3. 顏色

### 3.1 中性色（地區色滲透）
中性色不是固定值，而是由目前的地區色（或全國色）計算：`s` = 代表色去飽和 20%（全國色 15%），`K` = `#121212`。

| token | 算法 | Tailwind | 用途 | 全國色 | 京都 |
|---|---|---|---|---|---|
| paper | `s` 7% 疊白 | `bg-paper` | 頁面、面板底色 | `#F2F4F7` | `#F4F2F6` |
| surface | 11% | `bg-surface` | 輸入框、次要區塊 | `#EAEDF2` | `#EDEAF1` |
| map | 14% | `bg-map-land` | 地圖陸地 | `#E5E8EE` | `#E8E5EE` |
| line-soft | 14% | `border-line-soft` | 清單列之間 | `#E5E8EE` | `#E8E5EE` |
| header | 20% | `bg-header` | header、手機底部 tab | `#D9DEE7` | `#DED9E6` |
| placeholder | 22% | `bg-placeholder` | 照片載入前、頭像底 | `#D6DBE4` | `#DBD5E4` |
| line | 28% | `border-line` | 區塊分隔、按鈕外框 | `#CAD1DD` | `#D1CADC` |
| ink | `s`:`K` = 22:78 | `text-ink` | 主要文字、大點符號底色 | `#1D222C` | `#221D2B` |
| ink-2 | 40:60（對 paper ≥ 7:1） | `text-ink-2` | 翻譯、次要內文 | `#262F40` | `#30253F` |
| sub | 62:38，自動加深到對 header ≥ 4.6:1 | `text-sub` | 標籤、說明、假名 | `#303F5A` | `#403058` |

- 47 縣的全部數值在 `data/regions.json`（`color.paper`…`color.sub`），CSS 變數在 `regions.css`。
- 檢查結果：47 縣 ink 對 paper 皆 ≥ 11.5:1，sub 對 header 皆 ≥ 4.6:1。
- 調整濃淡只改產生腳本的比例參數後重新產生，不手改色碼。

### 3.2 主題色（固定）
| 主題 | Tailwind 前綴 | 值 | 符號 |
|---|---|---|---|
| 大點 | `t-major` | 跟 `ink` | 名勝／神社／寺院／城（實心） |
| 茶 | `t-tea` | `#3F8F35` | 茶碗 |
| 酒 | `t-sake` | `#B0561C` | 德利 |
| 香 | `t-incense` | `#A4508B` | 線香 |
| 溫泉 | `t-onsen` | `#0E8FA0` | 湯氣 |
| 拉麵 | `t-ramen` | `#B07A00` | 碗與筷 |
| 寶可夢 | `t-pokemon` | `#1F6FC0` | 商店袋 |
| 御朱印・御守 | `t-goshuin` | `#C8102E` | 御朱印帳 |
| 城（擴充包） | `t-castle` | `#4F6475` | 天守 |
| 老舖・茶屋（擴充包） | `t-shinise` | `#7A5230` | 暖簾 |
| 角色商店（擴充包） | `t-chara` | `#6D4FC2` | 貓耳臉 |
| 自訂地點 | `t-custom` | 跟 `sub` | 依分類，虛線外框 |

- 主題色只出現在：符號描邊、擴充包的勾選色與開啟中的膠囊鈕、區塊小標旁的小符號。**不用作大面積底色**。

### 3.3 地區色（執行時決定）
| Tailwind | CSS 變數 | 用途 |
|---|---|---|
| `bg-region` / `text-on-region` | `--region-base` / `--region-on` | 海報區、名稱色帶、DAY 標記、封面色帶 |
| `bg-region-accent` | `--region-accent` | 海報區幾何圓形 |
| `bg-region-tint` | `--region-tint` | 選取列背景、照片佔位 |
| `bg-region-strong` / `border-region-strong` | `--region-strong` | 主按鈕、tab 底線、選取外框、focus ring |

- 在容器上設定 `data-pref="kyoto"`，裡面所有 `*-region*` utility 自動換色；**元件內不得寫死任何縣的色碼**。
- 容器巢狀時以最內層為準（例：大阪地圖頁中的京都景點卡片，卡片根元素設 `data-pref="kyoto"`）。
- 地區色是 `@theme inline`：utility 直接輸出 `var(--region-*)`，已狀覆寫才會生效。不要改成一般 `@theme`。
- `on_base` 47 縣目前皆為墨色；元件一律用 `text-on-region`，不假設是白字。

### 3.4 data-pref 放在哪裡
- **頁面層級**：在 App 根元素（`#app`）設定 `data-pref`，並加上 `bg-paper text-ink`，整頁的中性色與強調色一起切換。值依 `UX-FLOW.md` §2.3 決定：探索頁＝焦點縣、行程與紀錄＝封面縣；首頁、景點模式、行程列表、紀錄總覽、我的＝不設（使用 `:root` 的全國色）。
- **元件層級**：顏色與頁面不同的元件（景點卡片、DAY 標記、行程卡、縣色標籤）在自己的根元素設定 `data-pref`。
- 切換 `data-pref` 時整頁顏色以 200ms 過場（`transition-colors`），地圖陸地同步以 `setPaintProperty` 更新。

### 3.5 對比
- 文字對底色 ≥ 4.5:1；24px 以上粗體 ≥ 3:1。
- 符號與外框（非文字）對背景 ≥ 3:1。
- 白字只能放在 `bg-region-strong` 或 `bg-ink` 上。

---

### 3.6 和風紋樣與紙紋
- **紋樣**（`RegionMotif.vue`、`web/src/data/patterns.ts`）：海報區的裝飾圓裡填入傳統紋樣，依地方分配：北海道 亀甲、東北 麻の葉、關東 市松、中部 鱗、近畿 七宝、中國 矢絣、四國 菱、九州・沖繩 青海波；全國用青海波。
  - 圓是 `bg-region-accent`，紋樣以 `bg-region`（base 色）畫出；圖塊是白色＋透明的 SVG，當 alpha 遮罩（`wa-pattern wa-*` utility，定義在 `theme.css`）。不寫死色碼、不用 opacity 淡化地區色。
  - 只放在裝飾圓裡，不鋪滿海報區，不壓到地名文字；靜態，不動。
- **紙紋**（`paper-grain` utility）：feTurbulence 產生的極淡灰色顆粒，以 `background-blend-mode: multiply` 疊在 `bg-region` 底色上，只影響背景、不影響文字。用在地區標籤、深度探索頁標頭、景點卡片與擴充包卡片的名稱帶、旅前準備標頭。

---

## 4. 字體

### 4.1 字族
| 用途 | Tailwind | 字族 |
|---|---|---|
| 介面、中文 | `font-sans`（預設） | Noto Sans TC |
| 日文內容 | 加 `lang="ja"` 自動套用 | Noto Sans JP |
| 羅馬拼音、數字、代碼、日期 | `font-latin` | Barlow Semi Condensed |

**日文一定要標 `lang="ja"`**：同一個漢字在 TC 與 JP 字形不同（例：「骨」「直」），景點名、片語、地名若用 TC 字形會像錯字。

### 4.2 字級
| token | px | 字重 | 用途 |
|---|---|---|---|
| `text-display` | 58 | 900 | 海報區縣名 |
| `text-h1` | 36 | 900 | 手機景點名、旅行紀錄標題 |
| `text-h2` | 30 | 900 | 桌機景點名 |
| `text-h3` | 22 | 900 | 頁面標題、wordmark |
| `text-title` | 18 | 700 | 片語、地名清單的漢字 |
| `text-body` | 15 | 400 | 簡介內文（行高 1.8） |
| `text-body-sm` | 14 | 400 | 資訊列、清單、按鈕 |
| `text-label` | 13 | 400–700 | 次要標籤、小標 |
| `text-caption` | 12 | 400 | 假名行、credit、說明 |

- 標題一律 `font-black`（900），不使用襯線字、不使用斜體。
- 羅馬拼音：`font-latin font-semibold uppercase tracking-romaji`（海報區、景點名）；清單中可用首字大寫、不加字距。
- 假名行：`text-caption tracking-kana text-sub`（在地區色底上改 `text-on-region/80`）。

---

## 5. 版面

### 5.1 斷點
| 名稱 | 寬度 | 版面 |
|---|---|---|
| 手機 | < 768 | 單欄、底部 tab、bottom sheet |
| 平板 | 768–1279 | 地圖＋右欄（左欄收成可開關的抽屜） |
| 桌機 | ≥ 1024 | 地圖佔滿，左上浮動面板 `w-float` 300（地區標籤、主題篩選、景點／地區特色）；右欄 `w-panel` 400 |

### 5.2 間距
- 基準 4px（Tailwind 預設 spacing）。面板內距 `px-5`（20）～`px-6`（24）；清單列 `py-2.5`；區塊間距 `gap-4`～`gap-6`。
- 最小點擊區 44×44（`size-tap`、`min-h-tap`）。
- 手機頁面上方預留 safe area：`pt-[max(env(safe-area-inset-top),12px)]`；底部 tab 與 sheet 同理。

### 5.3 固定尺寸
| 元素 | 值 |
|---|---|
| Header | `h-header`（60） |
| 地區標籤（桌機地圖左上） | 高約 64，隨內容 |
| 手機海報條 | 高 88，只放縣名＋羅馬拼音 |
| 底部 tab | 高 56＋safe area |
| Bottom sheet | 收合 120／半開 55vh／全開 100vh−header |

---

## 6. 符號（主題 marker）

### 6.1 繪製規格
- 24×24 grid，線條 `stroke-width: 2`，圓頭圓角（`round`），無填色（御朱印帳內的印可實心）。
- 放在 `web/src/assets/symbols/*.svg`，以 `currentColor` 著色，透過 `<ThemeSymbol name="tea" />` 使用。
- 通用 UI 圖示（返回、定位、播放、帳號、放大縮小）使用同樣筆畫規格；可用 lucide 並統一 `stroke-width={1.8}`。
- 寺院不使用「卍」。寶可夢不使用任何官方角色、精靈球或 logo。

### 6.2 Badge 尺寸與狀態
| 情境 | 尺寸 | 樣式 |
|---|---|---|
| 地圖一般 marker | 32 | 白底＋2px 主題色外框＋主題色符號；`shadow-marker` |
| 大點 marker | 32 | 墨色實心底＋白色符號 |
| 選取中 | 40 | 同上＋外圈 `ring-3 ring-paper` 再加 `outline-3 outline-region-strong` |
| 未開啟的主題 | 32 | `opacity-35`（仍顯示，讓人知道附近有） |
| 自訂地點 | 32 | 虛線外框 `border-dashed border-t-custom` |
| 擴充包列 | 26 | 同一般 |
| 名稱區塊旁 | 36–42 | 同一般；在地區色底上維持白底 |

```html
<!-- 一般 marker -->
<span class="size-8 grid place-items-center rounded-badge border-2 border-t-tea bg-paper text-t-tea shadow-marker">
  <ThemeSymbol name="tea" class="size-[18px]" />
</span>
<!-- 大點 marker -->
<span class="size-8 grid place-items-center rounded-badge bg-t-major text-paper shadow-marker">
  <ThemeSymbol name="shrine" class="size-[18px]" />
</span>
```

- 同一地點屬於多個主題時（例：伏見稻荷＝大點＋御朱印），badge 並排、間距 4px，大點在前。
- 地圖縮小時 marker 以 MapLibre clustering 合併；cluster 用墨色圓形＋白色數字（`font-latin font-bold`），不用主題色。

---

## 7. 元件

以下為樣式配方；實作成 Vue 元件，props 控制變化。

### 7.1 Button
| 變體 | class |
|---|---|
| Primary | `h-11 px-4 rounded-control bg-region-strong text-white text-body-sm font-bold` |
| Secondary | `h-11 px-3.5 rounded-control border border-line bg-paper text-ink text-body-sm` |
| Toggle（已啟用，例：去過） | `border-[1.5px] border-visited bg-visited-tint text-visited`＋`aria-pressed="true"` |
| Icon | `size-tap grid place-items-center rounded-control border border-line bg-paper`＋`aria-label` |
| 在地區色底上的 Icon | `border-[1.5px] border-on-region text-on-region bg-transparent` |

- 一個畫面只有一個 Primary。按下 `active:translate-y-px`，不做縮放動畫。
- 停用：`opacity-40 cursor-not-allowed`，並加 `disabled`。

### 7.2 Tabs（功能導覽、頁內分頁）
- 底線式：`h-full px-4 border-b-3`；選取 `border-region-strong font-bold text-ink`，未選 `border-transparent text-sub`。
- 手機底部 tab：圖示＋文字，選取時圖示與文字 `text-ink`，未選 `text-sub`；不使用底色塊。

### 7.2a 段落目錄 SectionNav（旅前準備）
- 桌機左側直列（`sticky top-8`，寬 168px）：每項 `border-l-2 pl-3.5 py-1.5 text-body-sm`；目前段落 `border-region-strong font-bold text-ink`，其餘 `border-line text-sub`；數量用 `font-latin text-caption`。目前段落有子段落時展開（`pl-6 text-caption`，目前子段落 `font-bold text-ink`）。
- 手機頂部橫列（`sticky top-0`，`border-b border-line bg-paper`）：`h-8 rounded-full px-3 text-label`，目前段落 `bg-region-strong text-white font-bold`，換段時自動捲到中間。
- 每項都是 `#錨點` 連結；段落 `scroll-mt-16 lg:scroll-mt-8`。

### 7.3 Search
header 右側、登入鈕左邊（`SearchBox.vue`，每一頁都在；在行程、紀錄頁選了結果會回到探索頁）：`h-10 w-72 rounded-full border border-line bg-paper px-3.5`，聚焦時外框 `border-region-strong`，左側放大鏡圖示，placeholder「搜尋景點、地區」，input 帶 `aria-label`。結果是同寬的浮動卡（`rounded-card bg-paper shadow-float`，最高 60dvh），每列：縣色小方塊 14px＋假名／日文名（繁中名不同時接在後面、`text-sub`）＋右側縣名（縣的結果標「地區」）。上下鍵移動、Enter 選取、Esc 清除。

### 7.4 擴充包列（原主題開關列）
- 地圖上方浮動列，左緣對齊左側浮動面板外（`left: insetLeft`），靠左排、寬度不夠時換行；「只看收藏」膠囊鈕排在最前面。
- 深度探索入口：地圖頁左欄最下方獨立的一張卡（和清單分開，`rounded-card bg-paper shadow-float`）：左邊 40px 地區色圓底的書本圖示、「深度探索」＋小字「季節・祭典・地區特色・期間限定」、右邊 ›。
- 深度探索頁：桌機左欄（168px，sticky）上方是「‹ 地圖」外框按鈕（和地圖頁的入口在同一側），下方是段落目錄（SectionNav side，地區特色展開各組）；手機是標頭的「‹ 地圖」＋頂部橫列目錄。
- 每個擴充包一顆膠囊按鈕 `h-9 rounded-full px-3.5 text-label font-bold shadow-float`：圖示（主題色）＋名稱＋件數（`font-latin`）。開啟中改為主題色底白字（`bg-(--pack)`，`--pack` 設為 `var(--color-t-*)`，不寫死色碼）；目前地區沒有資料時 `opacity-50` 不能按。
- 列尾 36px 圓形圖示鈕（滑桿圖示，`aria-label="選擇擴充包"`）往右下打開設定卡（`w-72 rounded-card bg-paper shadow-float`）：每個擴充包一列 checkbox＋圖示＋名稱，下方小字列出組別。
- 開啟擴充包時：左側清單換成擴充包清單（`PackList.vue`，頂端「‹ 景點」返回、右側擴充包名稱＋件數；組別列與景點類型列同樣式，底線用主題色；地區頁依組別分段、首頁依縣分段；每列左側 10px 主題色圓點）。地圖上景點（圓點、群集）不透明度 0.3、名稱標籤與照片收起，只有擴充包的點可以選；擴充包的點獨立群集（半徑 40、縮放 12 以上散開），主題色填色、paper 外框，縮放 12 以上顯示名稱。
- 已經是景點的點（名城）點了直接開景點卡片，名城番號與スタンプ設置場所顯示在景點卡片的資訊列。其他擴充包的點的卡片（`PackPanel.vue`）：地區色標頭（主題色圓點＋「寶可夢・人孔蓋」小字、名稱）＋資訊列（地區、寶可夢與圖鑑編號、地址）＋底部「官方頁面」（外框按鈕）與「在 Google Maps 開啟」。人孔蓋不放圖片（著作權屬 The Pokémon Company），只連官方頁面。
- 景點卡片在簡介下方列出「附近的{擴充包}」（2 km 內、最多 6 個、依距離），點選即開啟該擴充包並選取那個點。
- 鐵路：地區頁一律畫出該縣的鐵路路線與車站（使用者決定，沒有開關；`bundles/rail/{pref}.json`，進入地區時載入），畫在縣界之上、景點之下：
  - 路線：OSM 的路線色（沒有時用 `--color-map-rail`），下面墊一條 paper 色的外框線，寬度隨縮放加粗。
  - 路線名：縮放 12 以上沿線顯示（`ink` 字、paper 光暈）。
  - 車站：縮放 12 以上畫白底小圓點，13 以上顯示站名；同名車站 500 m 內只留一個。

### 7.0 開場畫面 Splash
- 寫在 `web/index.html`（JS、字型下載前就顯示）；顏色佔位字 `%REGION_*%` 由 `vite.config.ts` 在建置時換成 `data/regions.json` 的全國色，`%SPLASH_DOTS%` 換成 47 都道府縣的圓點。
- 置中：Wordmark 三行（ひとめぐり／一巡り 38px 900／HITOMEGURI）外圍一個 184px 圓（`line` 細線），圓上等距 47 個圓點（半徑 4.2），JIS 順從正上方順時針：北海道在最上面，沖繩在最後。
- 進度就是圓點：還沒到的圓點是 `line` 色；走到哪一縣，那一縣的圓點亮成該縣的 `base` 色並微微放大（一次亮一顆，進度一次跳很多時也是一顆一顆追上）。JS 接手前 CSS 先依序亮前 14 縣（約三成）；之後依實際工作推進：字型、路由、景點資料、地區 bundle、底圖第一次畫完（`web/src/services/splash.ts` 的 `trackSplash`）。
- 全部完成、47 縣走滿一圈後：圓點往外擴散淡出，Wordmark 淡出，從圓心開一個越來越大的洞露出底下的畫面（mask 半徑以 `@property` 動畫，0.75s）。最少顯示 0.9s，最多等 10s。不放文字說明（無「載入中」字樣）。`prefers-reduced-motion` 時圓點直接亮、結束只淡出。
- Google Fonts 改為 preload 後再套用，不擋首次繪製。

### 7.5 地區標籤 RegionTag（原海報區 RegionHero）
- 桌機改為浮在地圖左上的小卡：`rounded-card bg-region text-on-region px-4 py-3 shadow-float`，設 `data-pref`。
- 裝飾：右上 104px 圓形 `bg-region-accent`；**只用正圓**，不用漸層、不用照片。
- 內容：左側假名（`text-caption tracking-kana`）＋縣名（`text-h3 font-black tracking-name`）；右側羅馬拼音（`font-latin font-bold text-body-sm tracking-[0.3em] uppercase`）＋地方名；已驗證的直飛航線在下一行（`font-latin font-semibold text-caption`）。
- 卡片本身不可點。左側是返回鍵：44px、左箭頭＋「全國」小字，hover 時 `bg-region-accent` 底，`aria-label="回到全國地圖"`，點了回首頁的日本地圖；與縣名之間用一條 25% 透明的直線分隔。
- 下方是景點清單卡（`rounded-card bg-paper shadow-float`）：清單標題「景點」（不標件數、不標示精選，PLAN.md §6），列出該縣全部大點，地圖也顯示全部大點。分頁下方是類型索引列（文字＋2px 底線，選中 `border-region-strong font-bold`；不限／寺社／城・史跡／博物館／自然／娛樂／其他，只列有景點的類型，再點一次取消），同時篩選清單與地圖；分組定義在 `web/src/data/categories.ts`。不篩選時清單依類型分段，段首為 sticky 小標（類型＋件數），段內依分數。每列左側 44px 圓角縮圖（lazy 載入）＋假名／名稱＋細類型；滑過一列在地圖上標出該景點，點選則選取並飛過去。捲動區用 `scroll-quiet`（theme.css）：捲軸平常透明、滑過才顯示，右側 `pr-3` 讓捲軸不貼字。
- 主題篩選（茶、酒等）暫停，見 PLAN.md §1。
- 首頁左上列出 47 都道府縣（依地方分組）；還沒有景點資料的縣字色用 `text-sub`，點進去用縣界範圍定位。

### 7.5a 地圖 hover
- 游標 14px 內最近的景點放大（半徑 11，外框 3），並顯示名稱小標（`bg-paper rounded-tag shadow-marker`）；點擊以放大中的景點為準。
- 不分縮放：沒被群集成數字的景點，有照片就直接畫成 48px 圓形照片（`rounded-full border-[3px] border-paper shadow-float`，選取中改 `border-region-strong`），名稱移到照片下緣；同畫面最多 80 張，分數高的優先、重疊時在上。縮放 10 以上顯示名稱標籤，互相擋到時留分數高的。群集半徑 50px、縮放 15 以上全部散開，讓照片彼此不太重疊。照片來自 map bundle 的 Commons 250px 縮圖，載入失敗就退回圓點。
- 不預先下載照片：只載入畫面上的照片與清單中捲到的縮圖（試過背景全抓，初始載入變慢且持續佔用網路）。
- 景點在可見範圍外（或被左上浮動面板蓋住）時，改在可見範圍邊緣畫 36px 圓形箭頭（`bg-region-strong text-white`，旋轉指向景點）＋名稱小標。
- 回首頁（含點左上地區標籤）時地圖拉回整個日本版圖（`JAPAN_BOUNDS`，含沖繩）。
- 地區頁畫出縣界：`--region-strong` 虛線（寬 1.5→2.5 隨縮放、dash 2.5/1.5），縣內疊 `--region-base` 14% 不透明度，畫在景點下面。縣界是簡化線（約 400 m 精度），縮放 11→13 淡出到 0.35，避免拉近時和海岸線對不齊。進入地區時定位到「縣的主要陸地＋主要景點」，看得到整個縣的形狀，離島（八重山、伊豆諸島）不算進去。
- 選取中的景點：另外放在不群集的來源，不會被併進群集數字；外面一圈固定的 `region-strong` 外框，加兩圈錯開半週期往外擴散、淡出的呼吸燈（半透明填色＋外框，2s，`--animate-pulse-ring`）；`prefers-reduced-motion` 時只留固定外框。從清單或搜尋選取時飛到縮放 15（群集全部散開）。
- hover 照片再放大成 88px；整張照片都算命中範圍。觸控裝置沒有 hover，點擊時直接取點擊位置附近最近的景點。

### 7.5b 收合
清單分段（首頁的地方、景點類型、擴充包的組別或縣）的小標可以點擊收合：左側 `CollapseChevron`（7px 直角兩邊 `border-r/b-[1.5px] border-current`，收合時 `-rotate-45` 朝右、展開時 `rotate-45` 朝下，150ms 轉動），收合時小標後面顯示件數。收合狀態存在探索頁 store，切換地區後保留。

### 7.5c 深度探索頁（`/region/:pref`）
- 入口：地區頁左欄最下方獨立一張卡（和景點清單分開，`rounded-card bg-paper shadow-float`）：左側 40px `bg-region` 圓裡放書本圖示，「深度探索」（`text-body-sm font-bold`）＋下一行「季節・祭典・地區特色・期間限定」（`text-caption text-sub`），右側 ›。手機沒有左欄，由地區清單進入。
- 海報區：`bg-region text-on-region`，右上 320px 正圓（紋樣見 §3.6）；假名（`text-body tracking-kana`）＋縣名（`text-display font-black`）＋羅馬拼音與地方名。手機在海報區左上放「‹ 地圖」返回。
- 桌機左欄（168px，sticky）：上方「‹ 地圖」外框按鈕（和地圖頁的入口在同一側），下方是段落目錄（SectionNav side：點了捲到該段，捲動時標出目前段落，地區特色展開各組）。手機改成頂部 sticky 的橫列目錄（SectionNav bar）。
- 內文 `max-w-5xl`，段落標題 `text-h3 font-black`，組別小標 `text-caption font-bold tracking-section text-sub`＋件數。
- 地區特色卡：`rounded-card border border-line`，有 Commons 照片才放 16:10 圖；假名／日文名＋繁中名、維基簡介最多 4 行、授權與來源連結。每組先顯示 9 項，其餘用「全部 N 項」展開。
- 季節月曆：左側現象名（`text-body-sm font-bold`＋`text-caption text-sub` 的「開花」「紅葉」），右側 12 欄時間軸（`border-l border-line-soft` 格線，本月 `bg-region-tint`）；日期點 `size-3 rounded-full bg-region-strong border-2 border-paper`，櫻花開花到滿開以 `h-2 rounded-full bg-region-strong` 連起來；日期 `font-latin text-caption font-bold`（例 `3.24 – 4.2`），靠近年底時放在點的左邊。多個觀測站用與地圖清單相同的文字索引列切換。下方出處一行：平年值・站名・氣象廳連結。
- 祭典：月份文字索引列（沒有祭典的月份 disabled）；每月小標＋件數；卡片 `rounded-card border border-line p-3` 橫排，有照片才放左側 96px 方圖；假名／日文名＋繁中名（沒有時放英文名）＋跨月時的月份範圍（`font-latin`，例 `7–8月`）、簡介最多 3 行（依序取中文、英文、日文維基，非中文的加 `lang`）、授權／維基百科／「在地圖上看」連結。月份 1 到 12 依序排。
- 地圖上的位置標記（祭典「在地圖上看」）：縣地圖頁網址帶 `?at=緯度,經度&label=名稱` 時飛到縮放 14，放一個 DOM 標記：名稱小標（`bg-paper rounded-tag shadow-marker`＋關閉鈕）＋ `region-strong` 圓點與呼吸燈，關閉或選取景點時移除。

### 7.6 名稱區塊 NameBlock（招牌元件）
三行固定順序：假名 → 漢字 → 羅馬拼音；所有日文加 `lang="ja"`。
| 情境 | 版式 |
|---|---|
| 景點詳情（桌機右欄） | `bg-region text-on-region px-5 py-4`，左側 42px badge，右側三行靠左；漢字 `text-h2` |
| 景點詳情（手機） | 頂部整塊地區色，三行置中或靠左；漢字 `text-h1` |
| 清單列（旅前準備地名、行程） | 白底，假名 `text-caption`、漢字 `text-title font-black`、羅馬拼音靠右 `font-latin` |

名稱旁一律有播放鈕（§7.10）。

### 7.7 資訊列 InfoRow
`flex py-2.5 border-b border-line-soft text-body-sm`；左側標籤 `w-[72px] text-sub`，右側內容。固定順序：最寄駅 → 分類 → 其他（御朱印、停留時間、附近）。

### 7.8 期間限定列
`flex items-center py-2 border-b border-line-soft text-body-sm`；左：名稱（若屬主題，前置 16px 主題符號）；右：`text-caption text-sub`「品牌・範圍」。日期範圍用 `font-latin`（例：`9.28 – 10.4`）。

### 7.9 行程封面 TripCover 與 DAY 標記
- 分段色帶：`flex h-2.5`，每段 `style="flex-grow: 天數"` 並設該段的 `data-pref` 與 `bg-region`。
- 封面：`bg-region text-on-region px-4 py-3.5`（封面主縣）；標題 `text-h3`～`text-2xl font-black`。
- DAY 標記：`size-11 rounded-badge bg-region text-on-region font-latin font-bold`，上方 `DAY`（10px）、下方數字（18px）；每個標記設當天主縣的 `data-pref`。

### 7.10 播放鈕（發音）
`size-tap rounded-full border border-line bg-paper grid place-items-center`；播放中改 `bg-region-tint`。`aria-label="播放 {漢字}"`。

### 7.11 片語列 PhraseRow（旅前準備）
- 三行：假名（`text-caption text-sub`）→ 日文（`text-title font-bold`, `lang="ja"`）→ 中文（`text-body-sm text-ink-2`）。
- 「聽」類的建議回答：外框 chip `px-2.5 py-1 rounded-tag border border-ink text-label`，日文在前、中文在後。
- 區塊小標：`text-label font-bold tracking-section`＋情境（`text-caption text-sub`）＋主題小符號＋延伸到右側的 1px 線。

### 7.12 印章 Stamp（去過）
- 70px 正圓、`border-2 border-visited text-visited`，旋轉 −10°～10°（依 id 固定亂數，同一個景點每次角度相同）。
- 內容三行：`訪問`（10px）／年月（`font-latin font-bold` 15px）／地名（10px）。
- 在地圖上的「全部去過」模式：marker 右上疊一個 14px 的小印章點（`bg-visited` 圓點）。

### 7.13 Bottom Sheet（手機）
`rounded-t-sheet bg-paper shadow-sheet`，頂部把手 `w-10 h-1 rounded-full bg-line mx-auto mt-2.5`。三段高度見 §5.3；拖曳用 pointer events，放開時吸附到最近的段。

### 7.14 照片
- 比例：桌機右欄高 150～170、手機 170～200，`object-cover`。
- 右下 credit：`text-[11px] text-sub`（在照片上改白字＋`bg-ink/50 px-1.5 rounded-tag`）。
- 無照片：`bg-placeholder`＋景點的主題符號（48px、`text-sub`）置中，不顯示「無照片」文字。

### 7.15 空狀態
一行 `text-body-sm text-sub` 置中，必要時加一個次要按鈕。不使用插畫、不使用 emoji。

### 7.15a 共編成員
- 行程頁：`h-9` 外框按鈕，左邊最多 4 個 24px 頭像（`-space-x-1.5`、`ring-2 ring-paper`）＋「共編 N」；點開是浮動卡（`rounded-card shadow-float`，寬 340px）：邀請連結（唯讀輸入框＋Primary「複製」、「重新產生連結」）與成員名單（頭像、名稱、建立者／移除／離開）。
- 頭像：Google 大頭貼圓形裁切；沒有時 `bg-region-tint` 圓底＋名字第一個字。
- 行程卡片：共編時多一行 20px 頭像＋「共編 N 人」。

### 7.16 日期選擇器 DatePicker / DateRangePicker
不用原生 `<input type="date">`（各瀏覽器長相不一，手機上還會跳系統滾輪）。
- 觸發鈕長得像輸入框：`h-10 rounded-control border border-line bg-paper px-2.5`＋月曆圖示；日期 `font-latin`，格式 `2026/10/12（一）`，區間 `2026/10/31（六） → 11/03（二）`。打開時外框 `border-region-strong`。
- 面板：`w-[304px] rounded-card bg-paper p-3 shadow-float`，Teleport 到 body、`fixed` 定位，下方放不下就翻到上方；沿用觸發鈕所在的 `data-pref`。
- 表頭：‹ 年月 ›，點年月往上一層（日 → 月 → 年，月、年都是 3 欄格子）。星期列：日 `text-danger`、六 `text-visited`（日本月曆的習慣），其餘 `text-sub`。
- 日期格 `size-10 rounded-control font-latin text-body-sm`：選取 `bg-region-strong text-white font-bold`；區間中間 `bg-region-tint`（連成一條，兩端圓角）；今天在數字下方加 4px 圓點；範圍外 `text-line`；非本月 `text-sub/50`。
- 底部：單日有「今天」「清除」；區間顯示「出發 → 回程」或「N 天」與「清除」。
- 鍵盤：方向鍵移動、Home／End 到週首週末、PageUp／PageDown 換月（加 Shift 換年）、Enter 選取、Esc 關閉並回到觸發鈕。
- 景點卡片的「去過」：標了之後按鈕右半邊是日期（`border-l border-visited/30`，今年只寫月日），點開同一個月曆。

### 7.17 截圖 gallery
- 瀑布流：`columns-2 sm:columns-3 lg:columns-4 gap-3`，每張 `break-inside-avoid mb-3`；圖片用原圖比例（`aspect-ratio: w / h`），最高 360px，太長的截圖 `object-cover object-top` 只露上半部。
- 卡片：`rounded-card border border-line bg-paper`，圖片下方品牌（`text-caption text-sub`）、品項（`text-body-sm font-bold`）、說明（`text-caption text-ink-2`，最多兩行）。
- 大圖：`<dialog>` 近全螢幕，左邊圖片可捲動（長截圖照原寬看得清楚字），右邊 300px 的文字欄：上一張／下一張、品牌、品項、說明、行程、編輯、刪除。手機改上下排。
- 新增／編輯：`<dialog>` 寬 560px；沒有圖時是虛線外框的「選擇圖片」區，可以拖曳或貼上；欄位：品牌（有建議清單）、品項、說明、行程。

### 7.18 旅前小書（列印）
- 螢幕上：頂部工具列（紙張 A5／A4、各段勾選、只放必備會話、「列印／存成 PDF」Primary），下面是照紙寬（148mm／210mm）預覽的白紙 `bg-white shadow-float`；換頁的位置用虛線標出。
- 列印：`@page` 依紙張設定大小與邊界；header、底部 tab、工具列 `print:hidden`；App 的固定高度捲動版面 `print:block print:h-auto print:overflow-visible` 攤開；縣色帶、DAY 標記 `print-color-adjust: exact`。
- 每一大段 `break-before: page`；列 `break-inside: avoid`。字級在紙上用 13px（A5）／14px（A4）為基準的相對大小。

### 7.19 景點收集卡
去過的景點做成像寶可夢卡那樣的收集卡（`SpotCard.vue`）。卡面內容只用景點既有的資料（照片、名稱、類型、文化指定），不自己編。

- 卡片：`aspect-[5/7]`，尺寸全部用 em（小卡 200px、放大 320px；收集冊的格子用 container query 跟著格寬）。框是地區色 `bg-region`＋紙紋，圓角 1em。
  - 正面由上到下：縣名＋羅馬拼音／指定標示（`bg-paper` 膠囊）／卡號；4:3 照片窗（沒有照片時放地區紋樣圓＋名稱第一個字）；假名／名稱（越長字越小，一行放得下）／羅馬拼音；最下面一條細線，左邊類型、右邊「ひとめぐり」。
  - 去過的印章：照片窗右下 4.4em 正圓，`border-visited text-visited`，「去過」＋日期，−12°。
  - 背面：紙色內框，縣名・類型・指定、名稱、中文名、維基簡介（最多 9 行）、簡介與照片的出處授權。
  - 卡號：縣內依分數排第幾（No.004）；名城卡用名城番號（100名城 No.44）。
- 稀有度（`services/card.ts`，map bundle 的 `d` 記最高的文化指定）：
  - 世界遺產：虹色箔片。
  - 日本100名城・続日本100名城：箔片只照地方紋樣的形狀（§3.6，例：中部是鱗紋），平放時就看得到淡淡的紋樣。
  - 國寶、特別史跡、特別名勝：金色箔片。
  - 其他：沒有箔片，只有傾斜與反光。
  - 右上寫實際的指定名稱（世界遺產、100名城、續100名城、國寶、特別史跡、特別名勝）。
- 光澤：滑鼠（手機可以按「用手機傾斜」用陀螺儀）位置 → CSS 變數 `--rx --ry --mx --my --hyp --o`（`composables/tilt.ts`，彈簧跟隨）。卡片 3D 傾斜 ±12～18°；反光是跟著光源的柔光（`mix-blend-mode: overlay`）；箔片只在照片窗裡（像實體閃卡的圖框），`color-dodge`、位置跟光源反向移動，平放時幾乎看不到、越斜越亮。
- 顏色只用 theme.css 的收集卡 token（`--color-foil-1..5`、`--color-gold-1..3`、`--color-glare`、`--color-shade`），只用在收集卡。
- 放大檢視（`CardViewer.vue`）：`bg-ink/75` 遮罩＋中央 320px 大卡；點卡片、Space、Enter 翻面（`@property --flip` 0.5s）；Esc、點背景、「關閉」離開。收集冊裡可以左右切換（← →、左右滑、兩側 ‹ ›，換卡時從滑動的方向轉進來），並有「地圖」連到那個景點。
- 入口：景點卡片名稱帶右側的卡片鈕；紀錄頁上方的收集冊入口（最近三張卡疊成扇形，滑過時展開）。
- 收集冊（`/log/cards`）：海報區（全國色、季節飄落）＋張數＋都道府縣數＋名城進度條，右側是日本地圖（`JapanMap.vue`，縣界取 `geo/prefectures.json` 簡化成 SVG，沖繩放左上的虛線框）：去過的縣塗該縣 `strong` 色，進頁面時依北到南一縣一縣蓋上去（放大 1.6 倍壓下、回彈），點去過的縣捲到那一縣的卡片；篩選膠囊（全部／世界遺產／名城／國寶・特別史跡・特別名勝，前面是箔片色的小色票）；依縣（JIS 順）分段，每段縣色直條＋縣名＋羅馬拼音＋張數，卡片 2／3／4 欄；卡片依序從下方翻上來（發牌）。地圖 bundle 還沒到的縣先放佔位卡。照片出處在卡片背面，頁尾註明。
- 新卡入手（`CardReveal.vue`、`services/cardReveal.ts`）：在景點卡片按下「去過」時，畫面暗下（`bg-ink/50`），收集卡從下方轉兩圈飛到中央（1.15s）；落定時背後放射狀的光（虹卡是箔片虹色、金卡金色、名城該縣 `accent`、一般白光，慢慢旋轉）、一圈光往外擴、蓋上去過的印章、一道光掃過卡面，手機輕震一下。停 1.9～2.6 秒（越稀有越久）後縮小、轉動飛進「紀錄」分頁（桌機頂部、手機底部，看得到的那個），分頁跳一下。點任何地方或 Esc 直接收進去；清單列的快捷鈕不播（一次標很多個時會很吵）。

---

## 8. 地圖樣式（MapLibre）
- 底圖：OpenFreeMap Positron 為基底，樣式 JSON 放在 `web/src/map/style.json`，以下顏色對應 token：
  - 陸地：`--region-map`（切換縣時以 `setPaintProperty` 更新，過場 200ms）
  - 綠地、山：`--color-map-green`
  - 水：`--color-map-water`
  - 鐵道：`--region-line`，1.5～2px，不加顏色區分路線（行程路線才用色）
  - 地名標籤：`--region-sub`，日文，`localIdeographFontFamily` 設為 `"Noto Sans JP", sans-serif`
- 行程路線（行程頁）：當天主縣的 `--region-strong`，4px，端點圓頭；轉乘段用虛線。路線改變（開頁、換天、排序）時從起點畫到終點（0.8～2.4s，前後慢中間快），筆尖是 `--region-strong` 圓點加 `paper` 外框。
- 市區棋盤道路等細節交給底圖，不自行繪製。

---

## 9. 動態
動態可以有彈跳、縮放、3D、粒子與漸層，時長依效果決定（不限 250ms）。原則：
- 有理由才動：回應自己的操作（蓋章、收卡、星星）、說明位置關係（換頁、面板、選中標示）、表現季節與地區（飄落、地圖塗色）。不做只為了吸引注意、一直重複的動畫。
- 不擋操作：動畫進行中照常可以點；長的過場（新卡入手）點一下就跳過。
- 常駐的動畫（季節飄落）離開畫面或分頁切到背景時暫停。
- 一般的轉場用 `ease-out-soft`；地圖飛行（flyTo）≤ 1.2s。
- 尊重 `prefers-reduced-motion`：以下全部關掉（`theme.css` 已處理 CSS；canvas、WAAPI 的效果各自判斷），只留淡入淡出。

目前的動態：
- 開場畫面：47 縣圓點依進度亮起、結束時擴散開洞（§7.0）。
- 換頁過場（View Transitions API，`services/viewTransition.ts`）：整頁淡入淡出 0.22s；地圖頁的地區標籤 ↔ 深度探索頁的標頭（色塊、縣名、假名、羅馬拼音、紋樣圓）0.45s 從一個長成另一個。同一頁只換網址參數不做；頂部、底部分頁列不淡化。
- 滑動指示（`composables/indicator.ts`）：頂部分頁的底線、手機底部分頁的上緣線、段落目錄（左側直線含展開的子段落、手機的底色膠囊）滑到新的位置，0.3s。
- 景點卡片：換景點時內容淡入上滑 10px（0.26s）；手機從下方升上來（0.32s）。
- 去過的蓋章：自己按下時勾勾像印章從上方壓下去、微微回彈，並擴出一圈 `visited` 色墨暈（0.42s；換景點、同步來的變化不播）。
- 收藏的星星：自己按下時轉一下彈出（0.45s）。
- 選單、日期選擇、搜尋結果打開時淡入並移動 4px（0.16s，往上開的從下方）。
- 行程的停留點：排序、換天時滑到新的位置（TransitionGroup，0.25s）；離開不做動畫。
- 數字滾動（`RollingNumber.vue`）：件數改變時每一位數像里程表滑到新的數字（0.5s）。
- 載入中的佔位（`skeleton` utility、`SkeletonRows.vue`）：佔位色上一道淡光掃過，取代「載入中」文字。
- 收集卡的傾斜、翻面、發牌、新卡入手、收集冊地圖蓋上去的縣（§7.19）。
- 季節飄落（`SeasonDrift.vue`、`services/season.ts`）：深度探索頁與收集冊的海報區飄櫻花瓣、紅葉、銀杏、雪或螢火蟲（canvas）。季節先看氣象廳本季觀測（這個縣正在開花、轉紅、轉黃的期間限定），沒有時依月份（3–4 月櫻花、6–7 月螢火蟲、10–11 月紅葉、12–2 月雪；北海道、沖繩另外算）。葉片會翻轉、左右飄，游標經過時被吹開。顏色是 theme.css 的 `--color-sakura-*`、`--color-momiji-*`、`--color-ichou-*`、`--color-snow`、`--color-hotaru`。網址加 `?season=sakura` 等可以預覽。
- 行程路線從起點畫到終點（§8）。

---

## 10. 無障礙
- 所有互動元素用原生 `<button>`、`<a>`、`<input>`；圖示按鈕必有 `aria-label`。
- Focus ring：2px `--region-strong`＋2px offset（`theme.css` 全域設定），不可移除。
- 擴充包開關、tab、toggle 要有 `aria-pressed` 或 `aria-selected`。
- 顏色不是唯一辨識：主題靠符號形狀、自訂地點靠虛線與「自訂」標籤、去過靠印章。

---

## 11. 暗色模式
MVP 不做。token 已集中在 `theme.css` 與 `regions.css`，之後以 `@custom-variant dark` 覆寫中性色與地區色 token 即可，元件不需要改。

---

## 12. 禁止清單
- 寫死任何縣的色碼或主題色碼（一律用 token）。
- 地區色用在主題 marker；主題色用在按鈕或大面積底色。
- 毛玻璃、大圓角卡片堆疊（圓角上限 `rounded-card` 10px，sheet 除外）。紋樣與紙紋只用 §3.6 的方式。
- 漸層只用在光與材質（收集卡的箔片與反光、新卡入手的光、骨架的掃光）；不用漸層當介面的底色或按鈕色，也不用紫藍漸層（PLAN.md §6a）。
- 襯線字、斜體、emoji、sparkle 圖示、「AI」字樣。
- 以 CSS `opacity` 做地區色的淡化（淡化已在 token 產生時算好）。
- 使用純白 `#FFFFFF` 當頁面底色或純黑當文字色（白色只用於主按鈕文字、marker 底、卡片內層）。
- 日文內容缺 `lang="ja"`。
