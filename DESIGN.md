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
- 字體以 Google Fonts 載入：Noto Sans TC（400/700/900）、Noto Sans JP（400/700/900）、Barlow Semi Condensed（500/600/700），`display=swap`。
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

- `font-latin` 一律等寬數字（theme.css 的 base 設 `tabular-nums`）。「n / 總數」整段放在同一個 `whitespace-nowrap font-latin` 裡，斜線與總數不換字型、不斷成兩行。

**日文一定要標 `lang="ja"`**：同一個漢字在 TC 與 JP 字形不同（例：「骨」「直」），景點名、片語、地名若用 TC 字形會像錯字。

### 4.2 字級
| token | px | 字重 | 用途 |
|---|---|---|---|
| `text-display` | 58 | 900 | 海報區縣名 |
| `text-h1` | 36 | 900 | 地區色海報區內的頁面標題（收集冊、經縣值、成就）、旅前小書封面 |
| `text-h2` | 30 | 900 | 頁面標題（紀錄、行程、旅人…）、景點名（桌機與手機） |
| `text-h3` | 22 | 900 | 區塊標題、wordmark |
| `text-title` | 18 | 700 | 片語、地名清單的漢字 |
| `text-body` | 15 | 400 | 簡介內文（行高 1.8）；CJK 內文用 15px，因為漢字的字面比拉丁字大，14px 讀長文吃力。卡片上限制行數的簡介維持 `text-body-sm` |
| `text-body-sm` | 14 | 400 | 資訊列、清單、按鈕 |
| `text-label` | 13 | 400–700 | 次要標籤、小標 |
| `text-caption` | 12 | 400 | 假名行、credit、說明；要讀的資訊（出處、羅馬拼音、按鈕字）最小到這一級 |
| `text-micro` | 11 | 700 | 膠囊標籤、徽章（NEW、縣名標、「全國」、DAY） |

- 標題一律 `font-black`（900），不使用襯線字、不使用斜體。
- 頁面標題（h1）、區塊標題（h2）與紀錄頁卡片標題的字距一律 `tracking-title`（0.06em，年代主題的大標也用這個 token）。站名標式的地名（`tracking-name`）、Wordmark 不在此列。
- 字級一律用 token（rem），會跟著瀏覽器的預設字級放大；不寫 `text-[Npx]`。例外：Wordmark 上的裝飾假名、旅前小書的列印版面、收集卡卡面以 em 縮放的微縮字、§7.12 的印章、旅人衣櫃的「穿」封印。
- 羅馬拼音：`font-latin font-semibold uppercase tracking-romaji`（海報區、景點名）；清單中可用首字大寫、不加字距。
- 假名行：`text-caption tracking-kana text-sub`（在地區色底上改 `text-on-region/80`）。
- 清單裡的名稱（景點、擴充包、停留點、紀錄）可以換兩行（`line-clamp-2 break-words`，列 `items-start`）；假名行與其他次要資訊才單行截斷，截斷的假名加 `title`。
- 長名稱：日文標題（h1–h3、`text-title`）依文節斷行（base 的 `word-break: auto-phrase`，Safari 不支援時維持原樣）；不加 `text-wrap: balance`、`line-break: strict`，Safari 會把片假名從字中間切開。羅馬拼音加 `wrap-anywhere`，不撐出面板；清單裡靠右的羅馬拼音最多佔 40%。

---

## 5. 版面

### 5.1 斷點
| 名稱 | 寬度 | 版面 |
|---|---|---|
| 手機 | < 768 | 單欄、底部分頁列、景點卡片是 bottom sheet；header 只有 wordmark、搜尋鈕（§7.3）與帳號 |
| 平板 | 768–1023 | header 同桌機（分頁、搜尋框；間距收成 `gap-4`、搜尋框 `w-56`）；地圖與景點卡片同手機（bottom sheet、海報條），沒有底部分頁列 |
| 桌機 | ≥ 1024 | 地圖佔滿，左上浮動面板 `w-float` 300（地區標籤、主題篩選、景點／地區特色）；右欄 `w-panel` 400 |

### 5.2 間距
- 基準 4px（Tailwind 預設 spacing）。面板內距 `px-5`（20）～`px-6`（24）；清單列 `py-2.5`；區塊間距 `gap-4`～`gap-6`。
- 最小點擊區 44×44（`size-tap`、`min-h-tap`）。
- 手機頁面上方預留 safe area：`pt-[max(env(safe-area-inset-top),12px)]`（只有 status bar 設成 `black-translucent` 時才需要；目前沒設，上方不留）。
- 底部分頁列 `box-content h-14 pb-[env(safe-area-inset-bottom)]`：內容固定 56px，home indicator 的高度加在外面；貼著分頁列的浮動提示（AppUpdate）用 `bottom-[calc(5rem+env(safe-area-inset-bottom))]`。
- 橫向時左右的瀏海：header 用 `pl-[max(1rem,env(safe-area-inset-left))]`、`pr-[max(1rem,env(safe-area-inset-right))]`（`md:` 起 1.5rem）。

### 5.3 固定尺寸
| 元素 | 值 |
|---|---|
| Header | `h-header`（60） |
| 地區標籤（桌機地圖左上） | 高約 64，隨內容 |
| 手機海報條 | 高 56，只放縣名＋羅馬拼音 |
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
- 送出中（新增行程、補登旅行、加入共編）同樣停用並加 `aria-busy`，文字不變；有兩個同等的實心按鈕時，次要的那個降為 Secondary（例：行程結束後「開卡包」是 Primary，「旅前準備」是 Secondary）。
- 頁面上方的返回連結用 `BackLink.vue`：`text-label font-bold`、14px 左箭頭＋上一層的名字；一般底 `text-sub hover:text-ink`，地區色頁首上 `on-region`（`text-on-region hover:underline`）。

### 7.2 Tabs（功能導覽、頁內分頁）
- 底線式：`h-full px-4 border-b-3`；選取 `border-region-strong font-bold text-ink`，未選 `border-transparent text-sub`。
- 手機底部 tab：圖示＋文字，選取時圖示與文字 `text-ink`，未選 `text-sub`；不使用底色塊。

### 7.2a 段落目錄 SectionNav（旅前準備）
- 桌機左側直列（`sticky top-8`，寬 168px）：每項 `border-l-2 pl-3.5 py-1.5 text-body-sm`；目前段落 `border-region-strong font-bold text-ink`，其餘 `border-line text-sub`；數量用 `font-latin text-caption`。目前段落有子段落時展開（`pl-6 text-caption`，目前子段落 `font-bold text-ink`）。
- 手機頂部橫列（`sticky top-0`，`border-b border-line bg-paper`）：`h-8 rounded-full px-3 text-label`，目前段落 `bg-region-strong text-white font-bold`，換段時自動捲到中間。
- 每項都是 `#錨點` 連結；段落 `scroll-mt-16 lg:scroll-mt-8`。

### 7.3 Search
header 右側、登入鈕左邊（`SearchBox.vue`，每一頁都在；在行程、紀錄頁選了結果會回到探索頁；手機見下）：`h-10 w-56 lg:w-72 rounded-full border border-line bg-paper px-3.5`，聚焦時外框 `border-region-strong`，左側放大鏡圖示，placeholder「搜尋景點、地區」，input 帶 `aria-label`。結果是同寬的浮動卡（`rounded-card bg-paper shadow-float`，最高 60dvh），每列：縣色小方塊 14px＋假名／日文名（繁中名不同時接在後面、`text-sub`）＋右側縣名（縣的結果標「地區」）。上下鍵移動（清單跟著捲到選到的那一筆）、Enter 選取、Esc 清除。input 是 `role=combobox`，用 `aria-activedescendant` 指向選到的 option（id 由 `useId()` 產生，兩個實例不撞 id），結果筆數放在 `aria-live` 的隱藏文字；`enterkeyhint="search"`。
- 手機（< 768）：header 右側、帳號左邊放一顆放大鏡鈕（`size-tap`，`aria-label`「搜尋景點、地區」、`aria-expanded`）。點了展開佔滿 header 的搜尋列（`bg-header`）：`SearchBox full` 自動聚焦＋右邊「取消」（`text-body-sm text-sub`）；結果鋪滿 header 與底部分頁列之間（`fixed inset-x-0 top-header`，`border-t border-line`，不圓角、不加陰影）。選了結果、按取消、按 Esc、換頁都會收起，焦點回到放大鏡鈕。

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
- 選取中的景點：另外放在不群集的來源，不會被併進群集數字；外面一圈固定的 `region-strong` 外框（不做擴散的呼吸燈；`--animate-pulse-ring` 只用在祭典「在地圖上看」的位置標記）。從清單或搜尋選取時飛到縮放 15（群集全部散開）。
- hover 照片再放大成 88px；整張照片都算命中範圍。觸控裝置沒有 hover，點擊時直接取點擊位置附近最近的景點。
- 位置小框（`JapanLocator.vue`）：縮放 6.5 以上時出現日本全圖（像手機相機放大時的全景小窗）。桌機在左側浮動面板右邊、和「深度探索」卡底部對齊（132px 寬）；手機在地圖右上（96px）。`bg-paper/90 rounded-card shadow-float`，各縣 `--region-line`、目前的縣 `--region-accent`，目前看的範圍畫成 `--region-strong` 框（太小時改成一個點加擴散的圈），下方一行縣名與倍率（以日本全圖為 ×1，縮放每加 1 放大 2 倍，例「長野 ×8.2」）。只顯示，不能點。沖繩照日本地圖的慣例放在左上的虛線框。

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
| 景點詳情（手機） | 頂部整塊地區色，三行靠左；漢字 `text-h2`（同桌機） |
| 清單列（旅前準備地名、行程） | 白底，假名 `text-caption`、漢字 `text-title font-black`、羅馬拼音靠右 `font-latin` |

名稱旁一律有播放鈕（§7.10）。

### 7.7 資訊列 InfoRow
`flex py-2.5 border-b border-line-soft text-body-sm`；左側標籤 `w-[72px] text-sub`，右側內容。固定順序：最寄駅 → 分類 → 其他（御朱印、停留時間、附近）。

### 7.8 期間限定列
`flex items-center py-2 border-b border-line-soft text-body-sm`；左：名稱（若屬主題，前置 16px 主題符號）；右：`text-caption text-sub`「品牌・範圍」。日期範圍用 `font-latin`（例：`9.28 – 10.4`）。

### 7.9 行程封面 TripCover 與 DAY 標記
- 分段色帶：`flex h-2.5`，每段 `style="flex-grow: 天數"` 並設該段的 `data-pref` 與 `bg-region`。
- 封面：`bg-region text-on-region px-4 py-3.5`（封面主縣）；標題 `text-h3`～`text-2xl font-black`。
- DAY 標記：`size-11 rounded-badge bg-region text-on-region font-latin font-bold`，上方 `DAY`（`text-micro` 11px）、下方數字（18px）；每個標記設當天主縣的 `data-pref`。

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
- 右下 credit：`text-caption text-sub`（在照片上改白字＋`bg-ink/50 px-1.5 rounded-tag`）。
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
  - 世界遺產：虹色箔片＋亮片（兩層不同間距的小光點，跟著光源移動）。
  - 日本100名城・続日本100名城：箔片只照地方紋樣的形狀（§3.6，例：中部是鱗紋），平放時就看得到淡淡的紋樣。
  - 國寶：金色箔片＋金色亮片。
  - 特別史跡、特別名勝：反向閃卡，照片窗外的卡框有金色光澤，照片不加箔片。
  - 其他：沒有箔片，只有傾斜與反光。
  - 右上寫實際的指定名稱（世界遺產、100名城、續100名城、國寶、特別史跡、特別名勝）。
- 光澤：滑鼠（手機可以按「用手機傾斜」用陀螺儀）位置 → CSS 變數 `--rx --ry --mx --my --hyp --o`（`composables/tilt.ts`，彈簧跟隨）。卡片 3D 傾斜 ±12～18°；反光是跟著光源的柔光（`mix-blend-mode: overlay`）；箔片只在照片窗裡（像實體閃卡的圖框），`color-dodge`、位置跟光源反向移動，平放時幾乎看不到、越斜越亮。
- 顏色只用 theme.css 的收集卡 token（`--color-foil-1..5`、`--color-gold-1..3`、`--color-glare`、`--color-shade`），只用在收集卡。
- 放大檢視（`CardViewer.vue`）：`bg-ink/75` 遮罩＋中央 320px 大卡；點卡片、Space、Enter 翻面（`@property --flip` 0.5s）；Esc、點背景、「關閉」離開。收集冊裡可以左右切換（← →、左右滑、兩側 ‹ ›，換卡時從滑動的方向轉進來；觸控拖曳時卡片跟著手指走，第一張、最後一張往外拉有阻力，拉過 48px 或甩得夠快（>0.11px/ms）才換，不然 0.2s 彈回；按住方向鍵連續換卡時不播轉進來），並有「地圖」連到那個景點。
- 入口：景點卡片名稱帶右側的卡片鈕；紀錄頁上方的收集冊入口（最近三張卡疊成扇形，滑過時展開）。
- 收集冊（`/log/cards`）：海報區（全國色、季節飄落）＋張數＋都道府縣數＋名城進度條，右側是日本地圖（`JapanMap.vue`，縣界取 `geo/prefectures.json` 簡化成 SVG，沖繩放左上的虛線框）：去過的縣塗該縣 `strong` 色，進頁面時依北到南一縣一縣蓋上去（放大 1.6 倍壓下、回彈；每縣間隔 55ms，去過的縣多時縮短，整段約 0.6 秒內蓋完，47 縣全去過也在 1.4 秒內結束），點去過的縣捲到那一縣的卡片；篩選膠囊（全部／世界遺產／名城／國寶・特別史跡・特別名勝，前面是箔片色的小色票）；依縣（JIS 順）分段，每段縣色直條＋縣名＋羅馬拼音＋張數，卡片 2／3／4 欄；卡片依序從下方翻上來（發牌）。地圖 bundle 還沒到的縣先放佔位卡。照片出處在卡片背面，頁尾註明。
- 開卡包（`PackOpening.vue`）：結束的行程在行程頁有「開卡包」（這台裝置還沒開過的加紅點）。這趟去過的地方包成一包（主縣的 `bg-region`＋紙紋＋紋樣圓、一巡り、行程名、張數，輕輕浮動、一道光掃過）；點了上緣撕開、包裝往下掉（0.9 秒，途中點任何地方、Space、Enter 直接發牌），卡片從下方升上來疊在中央（卡背是主縣色＋紋樣圓＋一巡り）。點一下翻面（一般在前、最稀有的最後；稀有卡翻開時背後放光、手機輕震），再點收到下方一排；「全部翻開」直接跳到一覽。翻完是全部卡片的一覽＋「收集冊」。
- 新卡入手（`CardReveal.vue`、`services/cardReveal.ts`）：在景點卡片按下「去過」時，畫面暗下（`bg-ink/50`），收集卡從下方轉兩圈飛到中央（1.15s）；落定時背後放射狀的光（虹卡是箔片虹色、金卡金色、名城該縣 `accent`、一般白光，慢慢旋轉）、一圈光往外擴、蓋上去過的印章、一道光掃過卡面，手機輕震一下。停 1.9～2.6 秒（越稀有越久）後縮小、轉動飛進「紀錄」分頁（0.48s：前三成用 `ease-out-soft` 立刻抬起縮小，回應點擊，之後才加速飛進；背景 0.24s 淡出）（桌機頂部、手機底部，看得到的那個），分頁跳一下。點任何地方或 Esc 直接收進去；清單列的快捷鈕不播（一次標很多個時會很吵）。


### 7.19a 收集卡的樣式（同一個景點好幾種卡）
像寶可夢卡同一隻有基本卡、全圖卡、特別插畫卡，同一個景點也有好幾種樣式（`services/cardVariants.ts`）。

- 怎麼拿到（§7.19b）：去過就有基本卡，加上去的那天的季節卡；其他樣式用抽的，只抽還沒有的。
  - 基本：去過就有。
  - 季節（春景・夏景・秋景・冬景）：去的日期（3–5 月春、6–8 月夏、9–11 月秋、12–2 月冬）就有那一季；也抽得到。卡框鋪該季的小紋樣（櫻花瓣、煙火、楓葉、雪花），顏色用 `--color-sakura-1`、`--color-hanabi-3`、`--color-momiji-2`、`--color-snow`。
  - 全景：照片鋪滿整張卡，名稱壓在下方的暗色漸層上，照片上有跟著光源亮起的蝕刻細線。12%。
  - 夜景：夜晚的照片鋪滿整張卡（`season_images.night`）。只有找得到真的夜景照片的景點才有這種卡，不拿白天的照片調暗充數；深藍卡面 `--color-night`、上半散著星點 `--color-night-star`（傾斜時閃）。
  - 墨繪：照片變水墨（grayscale＋高對比），和紙色卡面、墨色框與錯位陰影、墨色文字。
  - 切手：郵票：白色卡面、四邊齒孔（mask 挖圓）、照片窗外一圈地區色、右下墨色消印（雙圈＋波浪線）。
  - 銀箔：卡框整張銀色（`--color-silver-1..3`），蝕刻細線、銀色亮片。
  - 金箔：卡框整張金色（`--color-gold-1..3`），蝕刻細線。
  - 特別全景：世界遺產、國寶（`rarity` 為 rainbow、gold）才有。全景＋整張虹色箔片與亮片。
  - 抽的權重：季節 5、全景・夜景・墨繪・切手 3、銀箔・金箔 1.2、特別全景 0.8（稀有的晚一點出來，但抽到最後一定都會有）。
- 稀有度（rank）：基本 0、季節 1、全景・夜景・墨繪・切手 2、銀箔・金箔 3、特別全景 4。收集冊的格子顯示封面：放大檢視收集到兩種以上時有「設為收集冊的封面」，選的存在 `users/{uid}/cards/{景點 id}` 的 `c`；沒選就是基本卡，整頁看起來一致。下方「n / 10 種」（有夜景照片的景點多夜景、稀有景點多特別全景，最多 12 種）；篩選加「全景・金箔」（有 rank ≥ 2 的卡；沒選封面的這時顯示最稀有的那張）。
- 卡面最下面一條右側的小膠囊寫樣式名稱（基本卡不寫）。全景、特別全景的卡不顯示上方縣名列，左上留名稱區。
- 放大檢視：大卡下方一排樣式膠囊（`aria-pressed`），點了換成那個樣式；右邊「n / 總數」。
- 新卡入手、開卡包：顯示這次拿到最稀有的樣式；抽到特別全景時背後放虹光、金箔放金光。開卡包依樣式稀有度排，最稀有的最後翻。
- 照片：基本卡用景點的照片；其他樣式用抽到的那個季節的照片（`season_images`，`pipeline/season_photos.py`），沒有就用第二張照片、其他季節的照片，最後才是基本卡的照片。卡片背面的出處跟著換。
  - 選圖：候選要拍得到景點（Commons 結構化資料「描繪」標的是這個景點，或檔名有景點名稱）；畫、版畫、館藏掃描、老照片不收；特寫、室內、看板、人潮扣分；Commons 優質・精選圖片加分；分數不夠就不放。景點名稱裡的季節字樣（SPring-8、春日山）不算。
- 放大檢視「抽一張」（右邊寫剩幾張券）：用一張抽獎券，從這個景點還沒有的樣式抽一種，新卡入手的動畫亮相；都有了按鈕變「已收齊」。新拿到還沒看過的樣式，膠囊右上角有 NEW，看過就拿掉。

### 7.19b 抽獎券與抽獎（景點卡、旅人扭蛋共用）
目標：不用重複去同一個地方，也不能靠取消再勾去過、新增刪除行程刷卡包。
- 抽獎券（`stores/wallet.ts`）全部由「現在去過的地方」算出來：每個去過的景點 1 張、每個去過的縣 3 張、每個去過的地方（8 個）5 張、景點每累積 10 個 5 張、成就（地方、旅行、時節）每個 5 張（§7.25）。取消去過張數就少回去，再勾回來也只是補回原本的，刷不出多的；張數有上限，就是去過的地方。用掉的張數（`used`）存在 `users/{uid}/meta/wallet`。
- 第一次去過的免費抽：每個景點只送一次（記在 `wallet.free`）。在景點按「去過」時（新卡入手的亮相），或行程結束打開卡包時，哪個先就在那裡用掉；之後再開卡包顯示這趟的季節卡。
- 抽景點卡：
  - 放大檢視「抽一張」：1 張券，抽那個景點還沒有的樣式。
  - 收集冊上方一條：抽獎券張數（點了展開來源明細：景點、縣、地方、每 10 個景點、成就、用掉）、「樣式 已有 / 全部」、「十連抽」：10 張券，從去過、還沒收齊的景點裡抽 10 種還沒有的樣式（依每個景點還缺幾種加權，同一批不重複）；剩不到 10 種時按鈕寫「抽 n 張」，全部收齊寫「已收齊」。樣式數旁「規則」（`CardRules.vue`，和旅人的規則共用外框 `RulesDialog.vue` 與抽獎券明細 `TicketTable.vue`）：使用者自己點才打開，條列卡片怎麼拿、樣式、抽卡、抽獎券明細、收集冊的記號。
  - 十連抽的畫面（`TenPull.vue`）：十張卡背面朝上一次排成 5×2，發完牌由左上依序自動翻開，銀箔以上翻開前抖一下、翻開後背後放光；每張翻開都標 NEW；「全部翻開」一次翻完，點還沒翻的先翻那張，翻開的點一下放大；卡寬依視窗寬高計算，整個畫面放得下、不出捲軸；翻完有「再十連抽」。
- 旅人扭蛋（§7.24）：1 張券，只抽還沒有的服裝；扭蛋範圍是不限縣的＋去過的縣的，抽完按鈕變「去過的縣都抽齊了」，去新的縣就會加進新的。
- NEW（`stores/fresh.ts`、`NewTag.vue`）：新拿到、還沒看過的卡片樣式、服裝與成就（§7.25）。紅底白字小牌「NEW」（照 §6a 不加驚嘆號）。卡片：收集冊格子左上、放大檢視的樣式膠囊；看那一種就拿掉。服裝：衣櫃貼紙左上；點了（穿上）就拿掉。只存在這台裝置。
- 測試期（`UNLIMITED_DRAWS`）：券不夠也能抽（張數照算、照扣）。正式上線前改成 false，並清空 `users/*/cards`、`users/*/meta/wallet`。
- 之後可以加：在景點附近（GPS）按去過多給券（現地打卡），讓真的去過的比只是標記的多一點。

### 7.23 下拉選單
`Dropdown.vue` 取代原生 `<select>`（原生的樣子跟著作業系統，與介面不搭）。觸發鈕 `rounded-control border-line bg-paper`，右側小箭頭；面板 Teleport 到 body（`composables/floating.ts`，下方放不下翻到上方），`rounded-card shadow-float`，每項 `min-h-tap`，選中的前面打勾、粗體，鍵盤移到的 `bg-surface`。`role="listbox"`／`option`，↑↓ 移動、Enter／Space 選、Esc 關。`size="sm"`（h-8）用在清單列。品牌這類可以自由輸入的欄位不用下拉，輸入框下面列建議（膠囊，點了帶入），取代原生 datalist。

### 7.24 旅人（紙娃娃）
`/log/avatar`，紀錄頁的第三張入口卡。第二版（2026-10）改成剪紙的紙人形：主角是一張「剪下來的紙」，其他介面安靜。
- 畫風（`PaperDoll.vue`，240×320 的 SVG）：平塗、不描黑邊，只用同色的淡邊（`--color-doll-line` 20%）、一層陰影（16%）與少量亮面；整隻套 `DollDefs.vue` 的 `#doll-cut`（外面一圈白邊＋往下的紙影），夥伴是另一張紙。比例約 2.5 頭身，圓臉、齊瀏海，眼睛是小黑點、笑眼或瞇眼，腮紅。輕輕搖（減少動態時不動），夥伴偶爾跳一下。
- 共用定義 `DollDefs.vue`（登入後才由 `App.vue` 非同步掛上；用到這些定義的畫面都只在登入時出現）：`#doll-cut`、`#doll-cut-sm`（小圖用）、`#doll-ghost`（還沒有的只剩 `--color-line` 剪影）、花紋 pattern（水玉、麻の葉、網紋、經木、甜筒格紋）。顏色都用 token。
- 外觀：髮型 13（妹妹頭、短髮、平頭、刺刺頭、旁分、捲髮、長髮、波浪長髮、丸子頭、雙丸子、馬尾、雙馬尾、麻花辮）、眼睛 8（圓眼、豆豆眼、睫毛、鳳眼、笑眼、瞇眼、睡眼、眨眼）、膚色 6（`--color-doll-skin-1..6`，選項由淺到深排）、髮色 9（`--color-doll-hair-1..9`：黑、深棕、棕、金、白、灰、紅、粉紅、藍）。髮型與眼睛的選項是目前樣子的頭像（`PaperDoll` 的 `crop`），只換那一項。
- 服裝 157 件（`data/outfits.ts` 不限縣的 16 件、`data/outfitsPref.ts` 各縣 3 件共 141 件）分五個位置：衣服、頭上、臉上、手上（右手握著）、夥伴（腳邊）。每件是一段 SVG，顏色只用 `--color-item-*` 與金色 token（共用小工具 `data/dollArt.ts`）；小圖用 `icon` 的 viewBox 裁出來。各縣的多半用模板：碗（拉麵、烏龍麵、蕎麥麵、丼）、串、盤、杯、水果、天守閣帽（石垣、壁、三層屋頂、金鯱）、頭帶、髮簪、斜戴在頭側的祭典面具、法被、浴衣・和服。
  - 各縣 3 件，取自那個縣實際的特產、工藝、祭典（`data/specialties`、`data/festivals` 與代表名物），例：北海道哈密瓜帽・函館鹽味拉麵・木雕熊、秋田生剝鬼面・秋田犬・烤米棒、山形花笠・櫻桃・天童將棋駒、京都抹茶・伏見稻荷狐面・舞妓花簪、德島阿波舞編笠・酢橘・阿波舞浴衣、沖繩風獅爺・沖繩麵・甘露衫。第一件是代表單品（`gift`）：第一次去那個縣就送（標 NEW）；另外兩件去過那個縣之後加進扭蛋。
  - 不限縣的 16 件用抽的：T 恤、浴衣、法被、作務衣、棒球帽、斗笠、貝雷帽、圓眼鏡、太陽眼鏡、相機、和傘、御朱印帳、團扇、招財貓、達摩。
- 頁面：左邊角色＋「抽服裝」，右邊衣櫃（桌機）；手機上下排。（第二版的「舞台換縣、站名標」拿掉了。）
  - 桌機整頁不捲動：頁面高度等於視窗，左欄的展示窗填滿高度，右邊衣櫃的台紙在窗內自己捲。手機照常整頁捲。
  - 角色：`region-tint` 底＋青海波（25%）＋紙紋，下方 17% 是地板。
  - 3D 展示窗（`DollSpin.vue`）：旅人是紙做的立牌，左右拖拉旋轉（滑鼠上下拖拉稍微俯仰），放開帶慣性慢慢停；轉過去看得到紙的背面（`#doll-back`：紙色、透一點反過來的印刷）與切邊的厚度（前後之間疊 4 層 `#doll-edge`），地上的影子轉到側面時變窄。停下來就完全不動（3D 的層角度一直變時瀏覽器用低解析度畫，放大看會糊，所以不做待機擺動）；雙擊轉回正面；鍵盤 ←→ 轉 30 度、Home 回正面。展示窗裡的紙不畫落影（`#doll-cut-ns`），影子畫在地上。減少動態時沒有慣性。
  - 衣櫃：索引標籤「外觀、衣服、頭上、臉上、手上、夥伴」接在點點方格的貼紙台紙上；右上「只看有的」。有的排前面，不限縣的在前、各縣依都道府縣代碼順。單品是貼紙（`#doll-cut-sm`），穿著的右上蓋朱色小印「穿」，新拿到的左上 NEW；還沒有的是剪影，各縣的單品下面掛縣名小牌。剪影裡扭蛋抽得到（不限縣的、去過的縣的）的右上有一顆小扭蛋；沒有的要先去那個縣。標題旁「服裝 n / 157」。
  - 標題旁「規則」（`AvatarRules.vue`）：使用者自己點才打開的說明書，不是 onboarding。條列服裝怎麼拿、抽獎券怎麼算（附自己目前的明細表）、衣櫃的記號（小扭蛋、縣名小牌、穿、NEW）、展示窗怎麼轉。Esc、點外面、「關閉」收起。
  - 「抽服裝」：深色長條，左邊扭蛋小圖、右邊剩下的抽獎券。扭蛋抽得到的都有了時寫「去過的縣都抽齊了」，右邊寫「沒去過的縣 n 件」（全部都有了才寫「都抽齊了」）。
- 抽獎：用抽獎券（§7.19b，與景點卡共用），扭蛋的範圍是不限縣的＋去過的縣的另外兩件，只抽還沒有的（不會重複），權重 常見 6、少見 3、稀有 1。
  - 動畫（`DollGacha.vue`）：扭蛋機（玻璃罩裡的彩色扭蛋、`region-strong` 機身、「一巡り」名牌）轉把手 0.7 秒 → 扭蛋從出口彈到中央（殼：常見地區色、少見紅、稀有金；上半透明）→ 殼上下分開，單品貼紙跳出來，名稱旁 NEW，背後放射狀的光（稀有度決定顏色）。動畫中點一下或 Enter、Space 直接打開。「穿上」「再抽一次」「關閉」。
- 紀錄頁入口卡：左邊固定 92×108 的小窗（`region-tint`＋紙紋）放半身像（不含夥伴），右邊「旅人」與服裝數。
- 存檔：`users/{uid}/meta/avatar`（`stores/avatar.ts`）：parts、equipped、owned；規則還沒發布或離線時先存在這台裝置，之後合併（owned 取聯集、used 取大的）。
- 不做付費；之後可以把旅人放進分享圖與年代主題（服裝跟著年代）。
- 網站上的旅人：
  - 帳號頭像（桌機 hover 0.2 秒）：下方跳出旅人小卡片（全身、服裝數、抽獎券），點了到旅人頁。帳號選單最上方是旅人的半身小窗（連到旅人頁），選單裡有「散步的旅人」開關。
  - 散步的旅人（`DollWalker.vue`）：登入後在畫面下緣（手機在分頁列上方）走來走去，64px 寬。每 3.5–8 秒隨機：走一段（一跳一跳，往左走時左右翻）、跳一下、轉一圈（紙翻面）、鞠躬、說一句話。說的話來自自己的資料：早安、下一趟出發倒數、目前地圖的縣（去過了／想去／去那裡可以拿到的代表單品）、剩幾張抽獎券、有沒穿的新衣服、收集冊有新的卡、有新的成就、只差一兩縣的地方（「東北還差秋田、山形」）、去過幾個縣。點它會說一句。桌機的探索頁（首頁、地區地圖）只在左邊清單的右側走。圖層在頁面內容與地圖浮動面板之上，在景點卡片（手機 sheet）、選單與 header 之下（`z-[15]`）；捲動頁底部留 `pb-24`，最後一列可以捲過旅人。說的話只在點了旅人之後交給讀屏器（`aria-live` 的隱藏文字），自己說話時不讀。旅人頁、列印時不出現；減少動態時站著不動。開關存在這台裝置。

### 7.25 成就（`/log/achievements`）
紀錄頁的第四個入口。外觀是一本紀念章帳（スタンプ帳）：第一頁「初訪」是 47 格縣的紀念章，後面 7 組是成就的章。條件只取真實的名單（日本100名城・続日本100名城、Wikidata 的文化指定、8 個地方）與自己的紀錄（去過的日期、已結束的旅行）。程式命名用 `achv`（`badge` 已經指主題 marker，§6.2）。
- 目錄（`data/achievements.ts`，40 個）：地方 7（北海道只有一縣，由初訪章涵蓋）、旅行 8（旅行 1／5／10 趟、一趟 7 天、一趟 5 縣、共編的旅行、再訪、同一縣 3 次）、時節 4（四季、十二個月、3／10 個年份）、足跡 6（都道府縣 10／30／47、足跡 10／100／300 處，含擴充包的點）、文化指定 5（世界遺產、世界遺產 10 處、國寶、特別史跡 5 處、特別名勝 5 處）、名城 5（日本100名城 10／50／100 城、続日本100名城 10／50 城）、擴充包 5（寶可夢人孔蓋 1／10、寶可夢中心・寶可夢商店、老舖・茶屋 10 家、角色商店 5 家）。初訪 47 格另外計數，不算在 n / N 裡。
- 判斷（`services/achievements.ts`，純函式）：成就是現在紀錄的函數，不另外存；取消去過、刪掉旅行就跟著拿掉，標回去就回來。文化指定與名城要 `bundles/achievements.json`（`build-bundles` 產生的小索引，約 3 KB gz；一個景點有幾種指定就列在幾種底下），登入後閒下來就載入（還沒去過任何地方也先載，NEW 的基準要在第一個「去過」之前建好）；還沒到的格子是 `skeleton` 圓，載入失敗時那段寫「沒有載入」＋「重新載入」。
- 達成日：旅行時的日期，不是 app 發現的那天。每個單位（景點、縣、名城）的第一次去過用上下界表示（沒有日期的造訪：可能更早、不知道），第 k 個單位的上下界相等才寫日期；季節、月份、年份走一遍去過的日期；旅行類用行程的結束日。算不出來的不寫日期，頁面上方一行「沒有日期的地方 n 處」＋「補日期」（`/log?fill=1`，打開紀錄頁的批次補日期並捲到「去過」）。再訪、同一縣 3 次：兩個日期相隔 30 天以上才算另一次（同一趟連續兩天排了同一個點不算）。
- 章（`AchvSeal.vue`，120×120 SVG）：組別用形狀分，顏色不是唯一的辨識方式。

  | 組 | 形狀 | 印泥 |
  |---|---|---|
  | 地方 | 雙圈，內圈鋪該地方的和風紋樣（`wa-*`，§3.6，`bg-visited` 20%） | `--color-visited` |
  | 旅行 | 圓角長方形雙框（角形駅スタンプ） | `--color-visited` |
  | 時節 | 橢圓（小判） | `--color-visited` |
  | 足跡 | 雙圈，內圈點線 | `--color-visited` |
  | 文化指定 | 正方形角印雙框 | `--color-visited` |
  | 名城 | 八角雙框 | `--color-t-castle` |
  | 擴充包 | 消印：雙圈＋右側三道波浪線 | `--color-t-pokemon`／`-shinise`／`-chara` |

  - 印面：上緣字（圓形沿弧線、其他直線；地方是羅馬拼音、名城 `NIHON 100 MEIJO`／`ZOKU 100 MEIJO`、擴充包 `POKEMON`／`SHINISE`／`CHARA SHOP`、其他 `HITOMEGURI`，`--font-latin`）、主字（數字 `--font-latin`，文字 `--font-display-zh`）、橫線、副字、日期 `YYYY.MM.DD`。
  - 達成：用印泥色蓋上，墨邊是 `DollDefs.vue` 共用的 `#stamp-ink`（`PrefStamp` 也改用它），依 id 固定傾斜 −8°～8°。
  - 未達成：`--color-line` 虛線框（`stroke-dasharray: 4 3`），字是 `--color-sub`，不套濾鏡、不旋轉、沒有紋樣。
  - 年代主題不加專用 CSS：印泥跟著 `--color-visited`（江戶朱、明治臙脂…）、初訪章跟著 `--region-strong`，字型跟著 `--font-display-zh`、`--font-latin`。
- 頁面（`AchievementsView.vue`）：容器同收集冊（`max-w-5xl`）。
  - 標頭：`bg-region`＋紙紋；「‹ 紀錄」、「成就 n / N」（`RollingNumber`）、進度條（`bg-paper/55` 底、`bg-on-region` 填色）、事實列「初訪 x / 47　旅行 n 趟　yyyy 年起」（0 或不知道的不寫）、「規則」。右欄（md 以上）是最近達成的章 140px，沒有時是虛線圓。
  - 手機在標頭下方放段落目錄（`SectionNav` bar，§7.2a），段落標題 `scroll-mt-14` 不被蓋住。
  - 段落：初訪、地方、旅行、時節、足跡、文化指定、名城、擴充包（各帶 `x / m`）。台紙 `rounded-card border-line bg-paper` 紙紋＋點點方格（點點畫在 `::before`，不蓋掉紙紋）。初訪依地方分行（小標 `text-caption tracking-section text-sub`），已去的是 `PrefStamp`，未去的是虛線圓＋日文縣名（`text-sub`）。成就格 3／4／6 欄，格子是按鈕（最小 44px）：章、名稱（`text-label` 兩行，數字和單位之間是不斷行空格、`break-keep`，折成「九州・沖繩／8 縣」「続日本100名城／10 城」）、日期或進度（`x / n`，地方差 3 縣以內寫「還沒去：秋田、山形」）。同一組已達成的在前。格子的 `aria-label` 寫名稱、日期或進度（有「還沒去：…」時寫那句），有 NEW 時接「，新」。手機的初訪章只有約 52px，NEW 放在上緣正中（壓在外圈上，不蓋住羅馬拼音），桌機在左上。
  - 關掉的擴充包，還沒達成的不列（已達成的照列）；整組都沒有就不列那段。
  - 詳細（`AchvDetail.vue`，外框 `RulesDialog`）：章 132px、條件、日期（未達成是進度）、抽獎券「5 張」（給券的才有）、有關的地方／旅行／縣最多 12 筆（依日期，連到地圖或行程頁；超過寫「還有 n 處」；打開時才算，平常的判斷不建這份清單）。打開就算看過；`RulesDialog` 是原生 `<dialog>`（收集冊、旅人的規則也是），Tab 只在框裡繞、後面的頁面 inert；關閉後焦點回到那一格。
  - 規則（`AchvRules.vue`）：條列文字在 `data/achvRules.ts` 的 `ACHV_RULES`（測試檢查文案；和目錄分開，開站不必載入），抽獎券那段接 `TicketTable`。
- NEW：每台裝置記得看過哪些（localStorage `hitomeguri:achv-known:<uid>`），和現在達成的比對。某一類（core：只靠 marks、trips；data：還要 achievements.json）第一次可以比對時，把目前達成的靜靜記成基準，所以新裝置、第一次部署都不會冒出一大片 NEW。「可以比對」要等 marks、trips 和伺服器對過一次（`synced`，不是只讀到離線快取）。data 晚到時，基準只算這次登入 core 可以比對那時已經去過的地方：之後才去的（例：新帳號第一個去過就是東寺）達成的世界遺產、國寶照樣標 NEW。取消再勾回來不再 NEW。NEW key 是 `a:<id>`（初訪 `a:pref-<縣>`）；打開詳細拿掉那一個，離開成就頁拿掉全部。
- 紀錄頁入口：三張卡下面一整列（`md:col-span-3`，高 96px），左邊「成就」與 n / N，中間最近達成的章 56px 疊在一起（新的在上，桌機 6 個、手機 3 個；沒有時三個虛線圓），有 NEW 時左上 `NewTag`。
- 解鎖時刻：
  - 新卡入手（§7.19）：落定時拿這次新達成的成就（往前多看 2 秒，比對和亮相是同一次 snapshot 觸發、先後不一定），rank 最高的（地方 > 足跡 > 名城 > 文化指定 > 旅行 > 時節 > 擴充包）蓋在卡片右上（120px；比 390px 窄的手機往卡片裡收，縣的初訪章在左下也一樣，斜放的章不超出畫面），其他的只標 NEW；卡片多停 0.7 秒。讀屏加「成就　{名稱}」。沒有日期的快捷去過不再補今天的日期。
  - 卡包翻完（`AchvRow.vue`）：卡片一覽下方「這趟的成就」：達成日在這趟期間（開始日到結束日）的初訪章與成就章 56px＋名稱，依序出現。
  - 行程頁（已結束）：按鈕列下方同一列 40px 不動，右邊「成就 ›」。
  - 其他路徑（清單快捷鈕、午夜行程結束、批次補日期、別台裝置）不播動畫，只靠 NEW、入口的 `NewTag`、散步的旅人說「有新的成就」或「東北還差秋田、山形」（只差 1–2 縣的地方）。
- 抽獎券：地方、旅行、時節的成就每個 5 張（最多 95 張，§7.19b）；足跡、文化指定、名城、擴充包只記錄（錢包已依縣、依每 10 個景點給過）。
- 不做：服裝獎勵（v1）、卡片樣式數與經縣值的成就（可以刷、自己選的級數）、連續年份、精選與分數、全國分母（x / 213）、続日本100名城全城（資料只有 97 座）。

### 7.20 離線
- PWA（`vite.config.ts` 的 `pwa()`、vite-plugin-pwa）：app 本身預先快取；資料 bundle（網址帶 `?v=` 版本，cache-first）、`_index.json`（network-first）、地圖圖磚、字型、Commons 照片在用到時存下來。收藏、去過、行程由 Firestore 的本機快取（`persistentLocalCache`）處理，離線時的修改連線後送出。
- 行程頁「離線用」（`OfflineButton.vue`、`services/offline.ts`）：抓停留點各縣的資料、照片、停留點附近的地圖圖磚（縮放 10–15，半徑約 1.5 km）與縣全圖（縮放 6–9）；按鈕底色是進度條，完成後改成「已存離線」（存在這台裝置的 localStorage，只是提示）。
- 沒有網路時頂部 wordmark 右側 `bg-ink text-paper` 小標「離線」。有新版本時底部一行「有新版本」＋「重新整理」（`AppUpdate.vue`），按了才換，不在操作中途重新整理。

### 7.21 經縣值（`/log/keiken`）
- 每個都道府縣選 0–5 級：住過 5、過夜 4、玩過 3、踏上 2、路過 1、未踏 0（日本的「経県値」玩法），總分最高 235。沒選的縣，有去過的景點就算「玩過」（地圖上虛線框、列上的按鈕虛線框）。
- 海報區（全國色）：標題、總分（`RollingNumber`，`text-display`）／235、各級數的色票與縣數、「存成圖片」。下方日本地圖（`japanOutline`，最寬 560px）依級數塗 `--color-keiken-1..5`（越深越久，未踏是 `--region-line`）；點縣在點的位置打開級數選單。再下方依地方列出 47 縣，每縣一排 6 個按鈕（未踏→住過）。
- 存在 `users/{uid}/meta/keiken`（`firestore.rules` 已加，要貼到 Firebase Console 發布）；寫不進去時先存在這台裝置。入口在紀錄頁收集冊旁。

### 7.22 分享圖（旅行回顧、經縣值）
- `ShareImage.vue`：深色遮罩上預覽 canvas，手機「分享」（Web Share API 帶 PNG）、「下載」。`services/shareImage.ts` 畫 1080×1350（IG 直式）。
- 只畫自己的地圖（縣界）與文字，不放照片（Commons 照片要逐張標作者與授權）。頁尾左邊縣界出處、右邊 HITOMEGURI。
- 旅行回顧：上方主縣（停留點最多的縣）的 `base` 色帶＋行程名、日期、天數與縣；中間停留點範圍的縣界（行程經過的縣用各自的 `accent`）、每天一條虛線路線（那天主縣的 `strong`）與編號，右上日本全圖；下方每天一行 DAY 標記、日期、停留點（最多 4 天）。入口在行程頁的按鈕列。

---

## 8. 地圖樣式（MapLibre）
- 底圖：OpenFreeMap Positron 為基底，樣式 JSON 放在 `web/src/map/style.json`，以下顏色對應 token：
  - 陸地：`--region-map`（切換縣時以 `setPaintProperty` 更新，過場 200ms）
  - 綠地、山：`--color-map-green`
  - 水：`--color-map-water`
  - 鐵道：`--region-line`，1.5～2px，不加顏色區分路線（行程路線才用色）
  - 地名標籤：`--region-sub`，日文，`localIdeographFontFamily` 設為 `"Noto Sans JP", sans-serif`
- 立體地形（`map/terrain.ts`）：地圖右下縮放鈕上方「立體」：放進 MapLibre 右下角的控制列（`IControl`＋Teleport，由上而下是立體、縮放、attribution，位置跟著 attribution 展開走，不會疊住縮放鈕），外框交給 `maplibregl-ctrl-group`，開啟時 `bg-region-strong text-white`。觸控裝置（`pointer: coarse`）上控制鈕與 attribution 開關放大到 44px（`size-tap`）。国土地理院の標高タイル（DEM10B PNG，`gsidem://` protocol 換成 terrarium 編碼，海上與無資料當 0 m）當地形（誇張 1.4 倍）＋陰影圖層（陰影 `--region-ink`、亮面 `--region-paper`，畫在縣界之上、鐵路之下），不改鏡頭（傾斜照舊用右鍵拖曳、手機兩指上下拖）；正上方看時靠陰影看出起伏，傾斜後山有高度。全日本都有資料（国土地理院 DEM10B），山區放大最明顯。偏好存在這台裝置；紀錄頁的小地圖不顯示。出處「標高：国土地理院」。
- 行程路線（行程頁）：當天主縣的 `--region-strong`，4px，端點圓頭；轉乘段用虛線。路線改變（開頁、換天、排序）時從起點畫到終點（0.8～2.4s，前後慢中間快），筆尖是 `--region-strong` 圓點加 `paper` 外框。
- 市區棋盤道路等細節交給底圖，不自行繪製。

---

## 9. 動態
動態可以有彈跳、縮放、3D、粒子與漸層，時長依效果決定（不限 250ms）。原則：
- 有理由才動：回應自己的操作（蓋章、收卡、星星）、說明位置關係（換頁、面板、選中標示）、表現季節與地區（飄落、地圖塗色）。不做只為了吸引注意、一直重複的動畫。
- 不擋操作：動畫進行中照常可以點；長的過場（新卡入手）點一下就跳過。
- 常駐的動畫（季節飄落）離開畫面或分頁切到背景時暫停。
- 曲線用 `theme.css` 的具名 token（Tailwind 會產生 `ease-*` utility；WAAPI 用 `services/motion.ts` 的 `ease('out-soft')` 讀出字面值）：
  - `--ease-out-soft`：一般的轉場、面板、發牌、卡片升起。
  - `--ease-stamp`（0.34, 1.56, 0.64, 1）：實體的蓋章、彈出、回彈（去過的印章、縣的紀念章、成就章、星星、收集冊地圖的縣、扭蛋的獎品、旅人的對話泡泡、紀錄分頁跳一下）。
  - `--ease-flip`（0.3, 1.3, 0.5, 1）：翻牌、扭蛋落下、立牌回正。
  - 回彈只給上面這些有實體隱喻的東西；一般的面板、選單不回彈。重力落下、退場（翻牌的前半、卡包掉落、扭蛋機退場）保留 ease-in，單一用途的曲線（扭蛋把手、墨暈、旅人跳躍）寫在元件裡。開場畫面早於 app 的 CSS，`index.html` 寫字面值並註明對應的 token。
- 只動 `transform` 與 `opacity`，不對 `width`、`left` 做動畫（進度條用 `scaleX`、開關圓鈕用 `translate`）。
- 跟手的物理（收集卡傾斜、旅人立牌的慣性）依經過的時間算，60Hz 與 120Hz 的螢幕手感一樣；放開時的速度取最近 100ms 的拖拉。
- 地圖飛行（flyTo）≤ 1.2s。
- 對話框：遮罩淡入 0.2s（`animate-scrim-in`），面板淡入上移 8px（0.22s，`animate-modal-in`）。
- 尊重 `prefers-reduced-motion`：以下全部關掉，只留淡入淡出。`theme.css` base 的做法：
  - 延遲一律拿掉，依序出現的項目不會一個一個等（收集冊的縣地圖進頁時就塗好）。
  - 其他動畫與 transition 縮到 0、不重複（光芒旋轉、骨架掃光停住）。
  - 用 keyframes 進場的面板與對話框標 `data-reduce="fade"`，改成 0.2s 淡入（規則對話框、帳號選單與旅人小卡、卡片檢視、回顧圖、下拉、日期選擇、搜尋結果、擴充包選單、加入行程／清單、停留點選單、經縣值選單、更新提示、景點卡片）。這個屬性也會讓元素自己的 transition 照常播，只加在 keyframes 進場的元素上。
  - canvas、WAAPI 的效果各自判斷：新卡入手照樣出現（卡片與光只淡入、淡出，不轉、不飛、不震，停留時間不變，讀屏照樣唸出拿到哪一張）。

目前的動態：
- 開場畫面：47 縣圓點依進度亮起、結束時擴散開洞（§7.0）。
- 出發倒數的翻牌（`SplitFlap.vue`）：行程卡片與行程頁「還有 22 天」的數字像車站發車標（パタパタ）一格一格翻到目標（深底 `--region-ink`、字 `--region-paper`，每張 70ms，數字依 0→9 順序翻）。
- 縣的紀念章（`PrefStamp.vue`）：在一個縣第一次按「去過」時，新卡入手的卡片左下蓋上像車站紀念章的圓章（雙圈、上緣羅馬拼音沿圓弧、縣名、「初訪」與日期，印泥色是該縣 strong 壓深，邊緣用雜訊做出斑駁），從上方重重蓋下、回彈；這時卡片多停 0.7 秒。
- 景點照片的 Ken Burns：景點卡片上方的照片 14 秒慢慢拉近、平移（換景點重新開始，只播一次）。
- 換縣的墨暈：點了縣名、地區標籤、「全國」換縣時，新的地區色從點的位置像墨水暈開（0.8s；View Transition 的新畫面用 feTurbulence 擾動過的圓當遮罩放大；這時其他具名過場都關掉）。拖曳地圖跨縣、搜尋選取不做。
- 換頁過場（View Transitions API，`services/viewTransition.ts`）：整頁淡入淡出 0.22s；地圖頁的地區標籤 ↔ 深度探索頁的標頭（色塊、縣名、假名、羅馬拼音、紋樣圓）0.45s 從一個長成另一個。同一頁只換網址參數不做；頂部、底部分頁列不淡化。過場中整頁的點擊都會落在過場的截圖上，所以過場中一按下就結束過場，點擊交給指標底下真正的元素（不會有「按了沒反應」）。
- 滑動指示（`composables/indicator.ts`）：頂部分頁的底線、手機底部分頁的上緣線、段落目錄（左側直線含展開的子段落、手機的底色膠囊）滑到新的位置，0.3s。
- 景點卡片：換景點時內容淡入上滑 10px（0.26s）；手機從下方升上來（0.32s），關閉時往下收（0.2s，Vue `<Transition name="sheet">`，開到一半又關會直接反轉）。升上來的途中內容不另外淡入（載入中換成景點也不播），之後換景點才播。
- 去過的蓋章：自己按下時勾勾像印章從上方壓下去、微微回彈，並擴出一圈 `visited` 色墨暈（0.42s；換景點、同步來的變化不播）。
- 收藏的星星：自己按下時轉一下彈出（0.45s）。
- 選單、日期選擇、搜尋結果打開時淡入並移動 4px（0.16s）：往下開的從上方長出（`animate-pop-in`）、往上開的從下方長出（`animate-pop-up`），`transform-origin` 對準觸發鈕那一角。Teleport 的面板（`composables/floating.ts` 的 `useFloating`）打開後第一次定位就決定方向，捲動時不換。浮動面板一律按 Esc 關閉、焦點回到觸發鈕，點外面也關閉（不 Teleport 的用 `useDismiss`；面板裡 Teleport 出去的下拉、日期選擇標 `data-floating`，點在裡面不算外面）。
- 行程的停留點：排序、換天時滑到新的位置（TransitionGroup，0.25s）；離開不做動畫。
- 數字滾動（`RollingNumber.vue`）：件數改變時每一位數像里程表滑到新的數字（0.5s）。
- 載入中的佔位（`skeleton` utility、`SkeletonRows.vue`）：佔位色上一道淡光掃過，取代「載入中」文字。
- 收集卡的傾斜、翻面、發牌、新卡入手、收集冊地圖蓋上去的縣（§7.19）。
- 成就章（§7.25）：新卡入手時這次達成的成就章蓋在卡片右上（和縣的紀念章對稱，從上方蓋下、停在右傾 8°，0.5s；有縣的紀念章時晚 0.35 秒蓋），卡片多停 0.7 秒。成就頁：這次進頁面時有 NEW 的章蓋一次（`animate-stamp-press`＋`stamp-ring`，每個錯開 120ms）；這台裝置第一次打開時，達成的章依北到南、組別順序蓋上（每個錯開 30ms，只對前 40 個）。卡包翻完的「這趟的成就」依序升上來。
- 季節飄落（`SeasonDrift.vue`、`services/season.ts`）：深度探索頁與收集冊的海報區飄櫻花瓣、紅葉、銀杏、雪、螢火蟲，8 月放煙火（canvas；煙火從下方升起、炸開成一圈拖著尾巴的火花，`--color-hanabi-1..4`）。季節先看氣象廳本季觀測（這個縣正在開花、轉紅、轉黃的期間限定），沒有時依月份（3–4 月櫻花、6–7 月螢火蟲、10–11 月紅葉、12–2 月雪；北海道、沖繩另外算）。葉片會翻轉、左右飄，游標經過時被吹開。顏色是 theme.css 的 `--color-sakura-*`、`--color-momiji-*`、`--color-ichou-*`、`--color-snow`、`--color-hotaru`、`--color-hanabi-*`。網址加 `?season=sakura`（`hanabi` 等）可以預覽。
- 行程路線從起點畫到終點（§8）。

---

## 10. 無障礙
- 所有互動元素用原生 `<button>`、`<a>`、`<input>`；圖示按鈕必有 `aria-label`。
- Focus ring：2px `--region-strong`＋2px offset（`theme.css` 全域設定），不可移除。
- 擴充包開關、tab、toggle 要有 `aria-pressed` 或 `aria-selected`。
- 顏色不是唯一辨識：主題靠符號形狀、自訂地點靠虛線與「自訂」標籤、去過靠印章。
- 觸控裝置（`pointer: coarse`）的輸入框至少 16px（`theme.css` 把 caption／label／body-sm／body 字級的欄位蓋成 1rem），iOS 聚焦時才不會放大整頁；viewport 不加 `maximum-scale`。單一欄位的表單加 `enterkeyhint`（新增清單、行程名稱 `done`，建立行程 `go`，搜尋 `search`）。
- 按鈕、`role=button`、分頁、`summary` 長按不選字、不跳系統選單（`theme.css` base 的 `user-select: none`、`-webkit-touch-callout: none`）；label 與內容文字照常可以選。
- 浮動或內層的捲動區（景點卡片、擴充包卡片、下拉、搜尋結果、規則對話框、加入行程／清單的選單）加 `overscroll-contain`，捲到底不帶動後面的頁面或地圖。
- 蓋住整個畫面的對話框（規則、成就的詳細、卡片檢視、回顧圖、十連抽、開卡包、扭蛋、新卡入手、截圖）用原生 `<dialog>` 的 `showModal()`（`composables/modal.ts`）：背後 inert、Tab 只在框裡繞、Esc 走 `cancel`、關閉前先 `close()` 讓焦點回到打開它的按鈕。對話框打開時 Teleport 到 body 的下拉、日期選擇會被 inert，要用的話掛在 `<dialog>` 裡面。

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

## 13. 年代主題
帳號選單的「年代」時間軸：江戶（1603–1868）、明治（1868–1912）、大正（1912–1926）、昭和（1926–1989）、平成（1989–2019）、令和（2019–，預設）。拖曳把手或點年代名稱就換主題，存在這台裝置（localStorage `hitomeguri:theme`）；網址加 `?theme=showa` 也會切換並記住。實作：`web/src/services/theme.ts`（`ERAS`）、`components/ThemeTimeline.vue`；`<html data-theme="…">`（令和不加），`index.html` 開頭在繪製前先設好。版面、資料、互動都不變，只換 token 與少數元件的樣子。昭和的視覺 mockup：https://claude.ai/artifact/ML2F8FTvJa9LDsKY263tXw

| 年代 | 方向 | 紙／墨 | 帶色、標牌 | 去過印章 | 字體（內文／日文／數字／大標 日・中） | 照片 | 形狀 |
|---|---|---|---|---|---|---|---|
| 江戶 | 浮世繪、和紙、藍 | `#EFE6D3`／`#1E1A17` | 藍 `#2B4B7A`、紅 `#B5352B` | 朱 `#B5352B` | 霞鶩文楷 TC／Klee One／霞鶩文楷／Yuji Syuku・霞鶩文楷 | 褪色、高對比＋和紙纖維 | 方角、細墨框、沒有陰影；行程卡是通行手形（木札） |
| 明治 | 文明開化、活版印刷 | `#F1EBDD`／`#1F2430` | 濃紺 `#1F2A44`、金 `#B08D3C` | 臙脂 `#7A1F2B` | Noto Serif TC／Shippori Mincho／IM Fell English SC／Shippori Mincho B1・Noto Serif TC | 蛋白相片的褐色＋四角暗影 | 雙線框（墨－紙－墨） |
| 大正 | 大正浪漫、矢絣 | `#F4EDE6`／`#2B1E24` | 海老茶 `#6E2C2C`、紫 `#5B3A6E`（帶色是矢絣紋） | 紫 `#6B2D5C` | Noto Serif TC／Zen Old Mincho／Cormorant SC／Kaisei Decol・Chiron Sung HK | 手工上色的淡彩 | 圓角大、柔和的陰影 |
| 昭和 | 國鐵、硬券、明信片 | `#F2E8D2`／`#2A2019` | 朱 `#C2402A`、青竹 `#1F6B5C`、山吹 `#E2A62B` | 紫 `#5B3F8C` | 粉圓／Zen Maru Gothic／DotGothic16／Dela Gothic One・Chiron GoRound TC | 褐色調＋印刷網點 | 墨框＋實心錯位陰影（2px） |
| 平成 | 早期網路、亮面 | `#F7F7FB`／`#1F2233` | 青 `#00A0E9`、洋紅 `#E4007F`、黃 `#FFE600`（漸層帶） | 洋紅 `#E4007F` | Chiron GoRound TC／M PLUS Rounded 1c／VT323／Mochiy Pop One・Chiron GoRound TC | 彩度加強＋亮面反光 | 大圓角、柔和陰影；行程卡是 IC 卡 |

- 地區色：由 `pipeline/region_css.py` 的 `ERA_THEMES` 換算，跟令和一起輸出在 `regions.css`（`:root[data-theme="…"]`、`[data-theme="…"] [data-pref]`）。中性色固定（上表的紙、墨），紙類再滲 4–6% 的地區色；強調色依年代換算：江戶、明治、大正、昭和在 OKLab 往古紙色混，平成放大彩度。開場畫面與分享圖讀不到 CSS 變數，用同時產生的 `web/src/styles/theme-colors.json`。
- token（theme.css 的 `:root[data-theme]`）：`--font-*`、`--font-display`（日文大標）、`--font-display-zh`（中文大標，日文字型缺繁體字，分開才不會一句混兩種字）、`--display-weight`／`--display-zh-weight`、`--radius-*`、`--shadow-*`、`--color-visited`、`--color-white`、`--color-map-water`、`--color-era-1/2/sign/card/ticket`、`--era-rule`（頂部下緣帶色，畫在 header 裡面不改高度）、`--era-photo-filter`／`--era-photo-overlay`（照片的濾鏡與質感）、`--era-card-shadow`。
- 元件（`web/src/styles/eras.css` 與 SpotCard 的 `:root[data-theme]` 規則）：
  - 大標（`text-display`／`text-h1`／`text-h2`／`text-h3`）用年代的展示字型；`lang="ja"` 用日文的，其他用中文的。
  - Tailwind 的 shadow utility 把值寫死，`.shadow-*` 直接改用 token；地圖上的照片圓點只留一圈細框。
  - 地區標籤 → 站名標（`RegionTag.vue`）：上面漢字、中間大字假名、下面羅馬拼音；底下 `bg-region-strong` 色帶兩端是前後一個縣（都道府縣代碼順，點了換過去）。
  - 照片（`img[data-photo]`）套年代濾鏡；景點卡片上方的大照片（`.photo-frame`）與收集卡再疊質感。
  - 收集卡：照片留紙邊、名稱用日文大標字型、印章加內圈；框與陰影依年代。
  - 行程卡（`.trip-card`）：明治、大正、昭和是硬券（斜格底紋、剪票缺口），江戶是木札，平成是 IC 卡。
- 開場畫面：`vite.config.ts` 由 `theme-colors.json` 產生各年代的底色與 47 縣圓點的顏色。分享圖：字型與地區色跟著目前的年代。
