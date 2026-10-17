# ひとめぐり 用過的 Claude Code skill 回顧

整理日期：2026-10-17（2026-10-11 第一版；這次補上番外篇：形象網站的像素散步與像素遊戲 P0–P4）。給之後做前端專案時參考：哪些 skill 真的有幫助、怎麼用比較好、哪些可以不用裝。

統計範圍：本專案的對話紀錄（2026-09-27 起）與 Workflow 自己記下的執行紀錄（agent 數、token、工具呼叫次數、時間）。Skill 是用 `Skill` 工具或 `/指令` 叫用的次數；番外篇的第三方遊戲 skill 是在 Workflow 給 agent 的指示裡寫「先讀 `.claude/skills/<名稱>/SKILL.md`」，不經過 `Skill` 工具，所以沒有叫用次數。番外篇 P4 的 Workflow 在整理這份時還在跑（這份文件就是它的最後一段），數字沒有算進來。

## 一覽

| Skill | 來源 | 用在哪裡 | 評價 |
|---|---|---|---|
| workflow-authoring（＋Workflow 多 agent） | Claude Code 內建 | 功能點子、成就系統設計與實作、使用流程盤點、設計稽核、手機版稽核與分批修正、待決事項整理、自動驗收、收集卡重新設計；番外篇的像素散步審查、遊戲 P0–P4（Workflow 一共叫了 25 次，含重跑與接續；番外篇 10 次） | 很有用，但很耗 token |
| Emil Kowalski skills（emil-design-eng、review-animations、improve-animations、animate…） | GitHub `emilkowalski/skill` | 拆成檢查清單後稽核全站動態，訂出緩動、時長、按下回饋、減少動態的規則；形象網站的捲動淡入與輪播也對照過 | 做「絲滑感」最有用 |
| Impeccable | GitHub `pbakaus/impeccable` | 和 Emil 一起做設計稽核：字體、版面、配色、AI 味的常見特徵 | 有用，跟 Emil 互補 |
| 遊戲用的第三方 skill 8 個（game-engine、game-feel、rpg、dialogue-systems、procedural-gen、game-audio、build-game-audio-feedback、test-playable-web-games） | `gamedev-skills`、`playableintelligence`、`mengto`、`github/awesome-copilot`（見 [遊戲用的 skill.md](<遊戲用的 skill.md>)） | 番外篇：交給各階段的 agent 當參考讀（引擎、聲音、介面、世界生成、系統、QA） | 當檢查清單有用；範例程式幾乎用不到 |
| threejs 系列（threejs-materials 等 8 個） | `cloudai-x/threejs-skills` | 3D 旅人（10/11）；番外篇用同一個 3D 旅人算像素旅人的側面 | 有用 |
| claude-api | Claude Code 內建 | 英文簡介翻成繁中的批次 API（`translate-summaries`）、帶網頁搜尋查直飛航線（`verify-flights`）；番外篇沒有用到 LLM | 有用，避免猜 API |
| artifact-design／artifact-capabilities | Claude Code 內建 | 驗收清單頁（勾選狀態存在頁面上，跨裝置都看得到；番外篇 P0–P2 加了 9 項） | 有用 |
| frontend-design | `anthropics/skills` | 形象網站 /about 第二版的規劃與自我檢查 | 半好半壞，見下 |
| find-skills | skills.sh | 找設計 skill（10/2）、找 3D skill（10/11）、找遊戲 skill（10/16） | 雲端環境要特別設定 |
| canvas-design | `anthropics/skills` | 裝了沒用到 | 這個專案用不到 |
| web-design-guidelines | `vercel-labs/agent-skills` | 裝了沒實際叫用 | 和 Emil／Impeccable 重疊 |

## 有幫助的

### workflow-authoring＋Workflow（多 agent 平行）
- 做法：先在主對話把範圍找出來（哪些頁面、哪些元件），再交給 Workflow 平行跑，最後一層「對抗式驗證」把不成立的發現刪掉。
- 改善了什麼：成就系統用「多個方案互評」選出設計再實作；手機版稽核一次掃完所有頁面，產出可以直接分批修的清單；使用流程盤點整理成 user story 與待優化流程的文件。番外篇整個遊戲都是用 Workflow 分段做的，見下面「番外篇」。
- 注意：很耗 token，跑得也比較久。適合大範圍稽核、設計發想、需要交叉驗證的研究、分得開檔案的大功能；一兩個檔案的小修改直接做比較快。

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
   或直接用 API：`curl "https://skills.sh/api/search?q=threejs&limit=10"`。（10/16 找遊戲 skill 時 `npx -y skills find` 直接查得到；查不到時再照這一點加。）
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

## 番外篇：像素散步與像素遊戲（2026-10-16／17）

時間線：10/16 白天做形象網站的像素散步（`/about`），傍晚找遊戲用的 skill，晚上到 10/17 早上做遊戲 P0–P2（引擎、你的旅人、京都＋沖繩），10/17 白天 P3（奈良、大阪、兵庫、東京、北海道），下午到晚上 P4（使用者試玩後的回饋＋從台灣出發）。用了什麼技術、怎麼做的寫在 [番外篇的技術.md](番外篇的技術.md)。

### 怎麼找到遊戲用的 skill（find-skills）
- 10/16 18:25–18:39，用 `npx -y skills find` 查了 27 個關鍵字：game design、game audio、sound effects、chiptune、web audio、pixel art、sprite、dialogue system、procedural generation、level design、game feel、canvas game、game testing、tilemap、top-down rpg、rpg、grid movement、retro game、8-bit sound…。
- 挑法：安裝數與來源 repo 星數夠；不綁 Unity／Godot；不用付費 API key（ElevenLabs、Layer、Suno 這類不選）；像素美術類數字偏低，網站也已經有自己的一套，不選。
- 不直接裝進 repo，先裝到 scratchpad 的暫存資料夾：
  1. grep 可疑的寫法（`curl`、`wget`、`rm -rf`、`eval(`、`base64`、「ignore previous」、api key、`.env`、`npm install`、`git push`…）；
  2. 每個 SKILL.md 讀過一遍；
  3. 看授權：`gamedev-skills`、`mengto` 兩個來源沒寫授權，重新散布不妥，所以 `.claude/skills/` 放進 `.gitignore`；
  4. 算每個 skill 的指紋寫進 `遊戲用的 skill.md`，下次裝回來時比對，不一樣要重讀。
- 雲端環境要注意：
  - `.claude/skills/` 不進 repo，新的容器裡沒有，要照 `遊戲用的 skill.md` 的 4 行 `npx skills add` 裝回來。
  - `skills add` 會寫 `skills-lock.json`。`skills experimental_install` 可以照它還原（試過可以），但 lock 檔會跟著進 repo，所以刪掉、改用明確的 add 指令＋指紋。
  - 裝完要開新的 session 才會出現在 Skill 清單；Workflow 的 agent 直接讀 SKILL.md 就好，不用等。

### 遊戲用的第三方 skill：各自用在哪裡

| skill | 給哪個 agent 讀 | 實際用在 | 有沒有幫助 | 要注意 |
|---|---|---|---|---|
| game-engine | P0 引擎、P2 世界生成 | 迴圈、tilemap、碰撞、鍵盤／觸控／手把輸入的檢查清單 | 中：補齊了該想到的項目 | 範例偏 Phaser、Three.js、平台遊戲；它建議用 delta time，我們用固定 60 步（GBA 的手感、測試可以一步一步算）；沒有用任何遊戲框架 |
| game-feel | P0 引擎、P0 介面、P2 系統 | 對照它的「回饋分輕重」檢查：撞牆「咚」＋原地踏步、按下觸控鈕下移 2px＋游標聲＋`vibrate(8)`、快門閃 220ms、蓋章 0.5 秒停在 −3°、jingle 時鎮曲壓到 18% | 有用：原則通用 | 範例是 Godot／Unity；畫面震動、hit-stop 是給打擊用的，這個遊戲沒有戰鬥，都沒用；減少動態時這些全部拿掉 |
| rpg | P0 引擎、P2 系統 | 行李、委託、存檔的結構（版本號、壞檔當沒有、生成器版本變了放回車站） | 中 | 一半是數值、裝備、戰鬥；使用者決定沒有戰鬥，跳過 |
| dialogue-systems | P0 引擎、P2 系統 | 決定不用 Ink／Yarn，自己寫小的 generator 腳本（say、ask、flag）；事實樣板與虛構台詞分檔 | 中：主要幫忙做「要不要用現成工具」的決定 | 在地化的掛鉤沒用（只有繁中）；事實要有出處、虛構台詞不能有真實地名，這兩條是專案自己的規則，skill 沒有 |
| procedural-gen | P2 世界生成 | 種子決定性（FNV-1a → mulberry32，種子＝市区町村碼＋生成器版本）、座標雜湊的雜訊讓郊外的路彎、填空的田與樹 | 有用：「同一個種子同一個世界」直接變成快照測試，P3、P4 改共用生成器時京都、沖繩的 18 鎮一格都沒變 | 地牢（房間＋走廊、BSP）、高度圖不適用；鎮的形狀照真實資料投影，不是亂數長出來的 |
| game-audio（MIT） | P0 聲音 | Web Audio 合成、lookahead 排程（skill 是每 25ms 排 100ms，我們排 120ms）、效果音表、混音 | 很有用 | skill 有一段建議裝 `@strudel/web` 做背景音樂；Strudel 是 AGPL-3.0，用了整個網站都要照 AGPL 開放。agent 的指示明寫「不要用 Strudel，也不要讀 strudel-reference」；音樂、音效都只用 Web Audio |
| build-game-audio-feedback | P0 聲音 | 手機要在手勢裡 unlock、BGM 與效果音分開音量與靜音、分頁在背景 suspend、打字聲限速＋可關、同名效果音搶占 | 有用 | 戰鬥分層、空間音效的部分用不到；沒有用喇叭聽過，音量還是要人聽 |
| test-playable-web-games | P0 介面、P2／P3／P4 的 QA | 測試矩陣（桌機 1280×800、iPhone 390×844 直拿、844×390 打橫、減少動態）、用 `window.__game` 直接跳到某個狀態（傳送、改時段、給錢）、舊存檔、console 沒有錯誤、量下載量 | 很有用：每一輪 QA 都照這個矩陣從頭玩一遍 | 沒有真機；觸控、safe-area 只是 Chromium 的模擬 |

整體：8 個都當「該想到什麼」的清單用，沒有直接用到範例程式（範例多半綁特定引擎）。最值得的是 game-audio 的排程寫法、test-playable-web-games 的測試矩陣、procedural-gen 的決定性。

### workflow-authoring＋Workflow：番外篇怎麼用多 agent

| Workflow | 日期 | 做什麼 | agent | token | 工具呼叫 | 時間 |
|---|---|---|---|---|---|---|
| pixelwalk-review | 10/16 | 像素散步：4 個審查（引擎、區 A、區 B、事件＋換區），每個審查配一個懷疑者重驗 | 8 | 242 萬 | 616 | 79 分 |
| pixelwalk-reverify | 10/16 | 36 個修正逐一重跑原本的重現步驟、找回歸 | 4 | 105 萬 | 327 | 52 分 |
| pixelwalk-ideas | 10/16 | 把像素散步變成遊戲的點子：4 個角度發想 → 排名、推薦 | 5 | 75 萬 | 150 | 23 分 |
| game-p0-p1 | 10/16–17 | 引擎＋聲音 → 介面＋旅人轉像素 → 整合 | 5 | 217 萬 | 529 | 142 分 |
| game-p2 | 10/17 | 世界生成＋系統 → 整合 | 3 | 139 萬 | 586 | 185 分 |
| game-review | 10/17 | P2 的 5 個角度審查（正確性、規則與內容、手機、手感、效能），每個發現一個驗證 → 修正 → QA | 71 | 897 萬 | 2,218 | 378 分 |
| game-p3 | 10/17 | 資料＋kit → 整合 → 3 個角度審查（正確性、內容、手感）＋驗證 → 修正 → QA → 文件 | 41 | 770 萬 | 2,295 | 415 分 |
| game-p4 | 10/17 | 提示列等介面＋円與台灣出發 → 整合 → 3 個角度審查＋驗證 → 修正 → QA → 文件 | 還在跑 | — | — | — |

上表是有完成紀錄的（另外有一次 P2 收尾沒有留下完成紀錄，不列）。不含 P4 合計 137 個 agent、約 2,445 萬 token、6,721 次工具呼叫、Workflow 執行時間約 21 小時。像素散步本身是主對話開 7 個背景 agent 平行做的（4 組區、白川鄉＋京都的事件、換區、共用事件），審查後再開 4 個 agent 分組修。

流程（P2 起每一段都一樣）：
1. **規格**：主控寫一份規格檔（使用者的原話、必守規則放第 0 節、兩邊同時做時的資料介面），每個 agent 的指示第一句就是「先完整讀規格」。
2. **平行實作**：照目錄分工（引擎／聲音、介面／旅人、世界／系統、資料／kit、提示列等介面／円與台灣），兩邊之間的介面先寫在規格裡。
3. **整合**：一個 agent 接上 `PlayView`，開瀏覽器從頭玩一遍。
4. **審查＋對抗式驗證**：幾個角度各一個 agent 找問題（要有證據、可以重現），每個發現再由另一個 agent 重現，不成立的刪掉。P2 找到 64 個，刪掉 4 個，留下 60 個（嚴重 1、中 20、低 39；手感 16、手機 12、效能 12、正確性 10、規則 10）；P3 留下 30 個（嚴重 2、中 16、低 12）。像素散步的 36 個修正另外跑一次重驗。
5. **修正**：一個 agent 照嚴重度修，每個回報「修了／沒修＋理由」。
6. **QA**：照測試矩陣從頭玩、量下載量、看舊存檔；P2 的 QA 又抓到並修了 5 個。
7. **文件**：DESIGN.md §14b、`docs/驗收.md`、`docs/PROGRESS.md`；P4 另外加這份回顧、技術整理與 README。
每一段的回報用固定欄位（summary、files、api、checks、openIssues、docNotes），下一段直接拿前一段的 api 與 docNotes 當輸入。

有效的地方：
- 使用者在睡覺時也能往下做：拿不準的照規格自己決定，寫進回報（P2 的 D1–D8），使用者醒來再改。
- 規格檔＋固定欄位的回報，讓十幾個 agent 對同一件事的理解一致；整合的 agent 只要處理接縫。
- 對抗式驗證把「可以考慮」這類不是問題的發現擋掉，修正的 agent 只處理確定的問題。
- 「已經上線的不能變」寫成快照測試，比寫在規格裡可靠。

要注意的：
- **token 很多**：P2 的審查一次 71 個 agent、約 900 萬 token，因為每個發現各開一個驗證 agent；像素散步是一個審查配一個懷疑者（8 個 agent），便宜很多。發現多的時候，驗證可以照角度分批；P3、P4 把審查從 5 個角度減到 3 個。
- **跑很久**：一次 2–7 小時，中間主對話不要改同一批檔案。
- **容器重啟會中斷**：P4 跑到 QA 時中斷。主控先 commit 一個 WIP（`db2eff3`），再用 `resumeFromRunId` 接著跑同一份腳本（腳本存在 session 的 `workflows/scripts/`），QA 重跑一輪。長的 Workflow 每一段結束時最好都是能 commit 的狀態，規格、截圖、e2e 腳本放在 scratchpad 的固定資料夾，中斷後找得回來。
- **agent 之間的檔案分工**：同時跑的 agent 不能改同一個檔。共用的檔（`PlayView.vue`、`systems/install.ts`、`theme.css`）只給整合的 agent 改；做不到時在指示裡寫明「哪些檔另一個 agent 在改，錯誤只出在那些檔時先忽略」。文件那一段也一樣：這份與 DESIGN／驗收／PROGRESS 由兩個 agent 同時寫，各管各的檔。
- **瀏覽器測試**：沙箱裡不開長駐的 dev server，每次在同一個指令裡開暫時的 vite（需要登入時加 Firebase Emulator）＋Playwright，跑完關掉；沙箱擋掉的外部網址（Google Fonts、apis.google.com）造成的 console 訊息要分開看。
- agent 一律不 commit、不 push、不 deploy，由主控統一提交。

### threejs 系列
- 10/11 做 3D 旅人時叫用過 threejs-materials（另外 7 個裝著當參考）。3D 旅人是把 2D 紙娃娃的剪影「充氣」成立體（距離場決定厚度、marching squares 沿輪廓切網格），旅人頁的展示窗用它。
- 番外篇沒有另外叫用，直接沿用 3D 旅人算像素旅人的側面：拿掉夥伴與影子、頂點照 chibi 變形、正交鏡頭轉約 73 度、只開環境光（強度 π，輸出就是貼圖原本的顏色，沒有明暗弄髒調色盤）、`preserveDrawingBuffer` 讀回像素，再走同一套像素化。
- 要注意：遊戲只從 `avatar/three3d.ts` re-export 用到的 8 個類別（整個命名空間 import 會讓那一檔多出用不到的東西）；沒有 WebGL 或失敗時退回參數化的側面範本，遊戲不能因為 3D 起不來；只在閒下來時算（標題、手帳、換地圖）。

### artifact 系列
- 驗收清單頁（同一個網址、勾選狀態存在頁面上）在 P0–P2 上線時加了番外篇 9 項：入口與標題、你的旅人變成像素人、手機操作、京都的告示牌與拍照、買東西與蓋章、京都到沖繩、房間與存檔、`/about` 的散步換成你的旅人、要你決定的事。P3、P4 的驗收說明寫在 [docs/驗收.md](../驗收.md)「番外篇：像素遊戲」。

### claude-api：這次沒有用到
- 番外篇照「不用 LLM 產生網路上沒有的內容」：地名、簡介、念法、創業年、祭典月份、花期、鐵路距離、蓋章地點都從 bundle 來，畫面上附出處；資料沒有就不說、不畫。
- 從台灣出發的航線：`verify-flights`（Claude＋網頁搜尋）查證的 `taiwan_direct.json` 都還沒查證，不能用。P4 改用国土交通省「各空港における国際線就航状況調べ」的官方表（`seed-taiwan-routes`，在 Actions 上跑），不用 LLM、不用 API key；航空公司的中文名取各家的繁中官網（`data/flights/airline_names.json`，每筆有網址）。
- 遊戲執行時沒有 LLM。路人的閒聊、委託的說法是開發時寫在 `content/flavour/` 的虛構台詞（像一般遊戲的劇本），vitest 擋：不能有任何真實地名、店名、祭典名、站名，不能有數字＋年／月／km、驚嘆號、emoji。
- 所以 claude-api 這次沒有叫用；有查證、翻譯這類 LLM 工作時才需要。

## 下次做前端專案的建議組合
1. 一開始：frontend-design（只當流程與檢查清單）＋ Emil Kowalski ＋ Impeccable。
2. 大範圍稽核或設計發想：Workflow（先自己找出範圍再平行跑，最後一定要有驗證層）。
3. 大功能：Workflow 分段跑（規格檔 → 照目錄分工平行實作 → 整合 → 審查＋對抗式驗證 → 修正 → QA → 文件）；每一段結束都能 commit，中斷時用 `resumeFromRunId` 接著跑。驗證 agent 的數量要先估，發現多時照角度分批。
4. 做小遊戲：game-engine、game-feel 當檢查清單；聲音照 game-audio 的 lookahead 排程（不要 Strudel）；地圖生成照 procedural-gen 的「同一個種子同一個世界」，再加快照測試；QA 照 test-playable-web-games 的矩陣。
5. 要給人看進度或驗收：artifact 頁。
6. 有 LLM 功能：claude-api。
7. 要找新 skill：find-skills（雲端環境照上面設定），先看安裝數、星數、安全檢查再裝；沒有授權的不放進 repo，記指紋。
