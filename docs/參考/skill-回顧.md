# ひとめぐり 用過的 Claude Code skill 回顧

整理日期：2026-10-11。給之後做前端專案時參考：哪些 skill 真的有幫助、怎麼用比較好、哪些可以不用裝。

統計範圍：本專案的對話紀錄（2026-09-27 起）。Skill 是用 `Skill` 工具或 `/指令` 叫用的次數；多 agent 流程是 `Workflow` 工具。

## 一覽

| Skill | 來源 | 用在哪裡 | 評價 |
|---|---|---|---|
| workflow-authoring（＋Workflow 多 agent） | Claude Code 內建 | 功能點子、成就系統設計與實作、使用流程盤點、設計稽核、手機版稽核與分批修正、待決事項整理、自動驗收、收集卡重新設計（約 15 次） | 很有用，但很耗 token |
| Emil Kowalski skills（emil-design-eng、review-animations、improve-animations、animate…） | GitHub `emilkowalski/skill` | 拆成檢查清單後稽核全站動態，訂出緩動、時長、按下回饋、減少動態的規則；形象網站的捲動淡入與輪播也對照過 | 做「絲滑感」最有用 |
| Impeccable | GitHub `pbakaus/impeccable` | 和 Emil 一起做設計稽核：字體、版面、配色、AI 味的常見特徵 | 有用，跟 Emil 互補 |
| claude-api | Claude Code 內建 | 英文簡介翻成繁中的批次 API（`translate-summaries`）、帶網頁搜尋查直飛航線（`verify-flights`） | 有用，避免猜 API |
| artifact-design／artifact-capabilities | Claude Code 內建 | 驗收清單頁（勾選狀態存在頁面上，跨裝置都看得到） | 有用 |
| frontend-design | `anthropics/skills` | 形象網站 /about 第二版的規劃與自我檢查 | 半好半壞，見下 |
| find-skills | skills.sh | 找設計 skill（10/2）、找 3D skill（10/11） | 雲端環境要特別設定 |
| canvas-design | `anthropics/skills` | 裝了沒用到 | 這個專案用不到 |
| web-design-guidelines | `vercel-labs/agent-skills` | 裝了沒實際叫用 | 和 Emil／Impeccable 重疊 |

## 有幫助的

### workflow-authoring＋Workflow（多 agent 平行）
- 做法：先在主對話把範圍找出來（哪些頁面、哪些元件），再交給 Workflow 平行跑，最後一層「對抗式驗證」把不成立的發現刪掉。
- 改善了什麼：成就系統用「多個方案互評」選出設計再實作；手機版稽核一次掃完所有頁面，產出可以直接分批修的清單；使用流程盤點整理成 user story 與待優化流程的文件。
- 注意：很耗 token，跑得也比較久。適合大範圍稽核、設計發想、需要交叉驗證的研究；一兩個檔案的小修改直接做比較快。

### Emil Kowalski skills ＋ Impeccable
- 做法：先把兩套 skill 讀過、拆成具體的檢查清單，再拿來稽核網站（Workflow：拆解 → 稽核 → 驗證 → 整理成「現在改／要你決定／不做」）。
- 改善了什麼：緩動曲線改成強 ease-out（`--ease-out-soft`），UI 動畫控制在 300ms 內，按下回饋、減少動態時只留淡入淡出，拿掉彈跳感太重的地方。形象網站的捲動淡入（同組依序晚 80ms）、輪播交叉淡入也照這套規則。
- 建議：前端專案第一個裝。Emil 管「動起來的感覺」，Impeccable 管「看起來像不像模板」。

### claude-api
- 用在 Actions 上跑的 LLM 工作：批次翻譯（Message Batches）、帶 web search 查證航線。
- 改善了什麼：model 名稱、參數、批次 API 的用法都照官方文件寫，沒有用猜的；先拿小量資料（20 筆）驗證 prompt 與輸出格式，再跑整批。

### artifact-design／artifact-capabilities
- 用來做驗收清單頁：一個網址、勾選的狀態存在頁面上，換裝置也看得到，跟使用者對進度很方便。

## 要注意的：frontend-design
- 好的地方：「先列設計規格 → 對照需求檢查 → 再寫程式 → 截圖自我檢查」的流程很實用；它列的 AI 感特徵（大數字看板、全大寫小標籤、非流程的 01/02 編號、到處淡入）幫忙把頁面的模板感拿掉。
- 副作用：它很鼓勵「要有個性、敢冒險」，於是做出浮世繪＋直排標語的海報，結果使用者要的是現代、乾淨、滑順的全版輪播；它也不建議捲動淡入，剛好和使用者想要的相反。
- 建議：需求裡先寫清楚方向（例如「現代、乾淨、滑順，參考某某網站」），把它當檢查清單用，不要讓它決定風格。

## 這個專案用不到的
- **canvas-design**：做靜態海報、PNG 藝術圖用的，不是網頁 UI。
- **web-design-guidelines**：內容和 Emil／Impeccable 重疊；可以留著當上線前的無障礙與 UX 最後檢查。

## find-skills 在雲端環境的設定
1. 雲端環境的「網路存取」要把 `skills.sh`、`www.skills.sh`（要看 agenticskills.io 的話也加上）加進允許的網域，保留「同時納入常見套件管理器」。
2. `npx skills find` 用的是 Node 內建的 fetch，不走代理，在沙箱裡只會顯示「找不到」。要加環境變數：
   ```bash
   NODE_USE_ENV_PROXY=1 npx skills find threejs
   ```
   或直接用 API：`curl "https://skills.sh/api/search?q=threejs&limit=10"`。
3. 裝之前看 skills.sh 頁面上的安裝數、GitHub 星數、安全檢查（Gen Agent Trust Hub、Socket、Snyk）。

## 3D 相關（2026-10-11 查的，skills.sh 的數字）

| 用途 | Skill | 安裝數／星數 |
|---|---|---|
| Vue 3 的 three.js（TresJS） | `onmax/nuxt-skills@tresjs` | 1.2K／720 |
| three.js 基礎、載入、動畫、材質、燈光 | `cloudai-x/threejs-skills`（threejs-fundamentals、threejs-loaders、threejs-animation…） | 10–17K／3.5K |
| 載入 GLB、骨架動畫 | `gamedev-skills/awesome-gamedev-agent-skills@threejs-gltf-loading` | 3.6K／1.4K |
| 有骨架的角色＋換裝系統 | `mengto/skills@build-rigged-game-assets` | 971／6.7K |
| Blender → glTF | `freshtechbro/claudedesignskills@blender-web-pipeline` | 3.1K／1.0K |
| 照片轉程式畫的 three.js 模型 | `img2threejs/img2threejs` | 1.9K／17.9K（Socket 檢查是警告） |
| AI 生成 3D 模型（要付費 API key） | `meshy-dev/meshy-3d-agent`、`majidmanzarpour/threejs-game-skills@threejs-3d-generator` | 908／98、3.0K／2.5K |
| React 專用（Vue 專案用不到） | `enzed/r3f-skills`、`vercel-labs/json-render@react-three-fiber` | — |

## 下次做前端專案的建議組合
1. 一開始：frontend-design（只當流程與檢查清單）＋ Emil Kowalski ＋ Impeccable。
2. 大範圍稽核或設計發想：Workflow（先自己找出範圍再平行跑，最後一定要有驗證層）。
3. 要給人看進度或驗收：artifact 頁。
4. 有 LLM 功能：claude-api。
5. 要找新 skill：find-skills（雲端環境照上面設定），先看安裝數、星數、安全檢查再裝。
