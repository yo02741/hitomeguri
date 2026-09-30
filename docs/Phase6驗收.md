# Phase 6 驗收：自動化排程＋PR 審核

完成日期：2026-09-30
網站：https://hitomeguri-7d87a.web.app/

Phase 6 原本有兩半：「擴展全國」之前已經做完（47 縣都有景點），這次做的是「自動化」：資料定期自動重採，結果開成 PR 給你審，合併後自動部署。

**要先做的設定（一次就好）**：repo 的 Settings → Actions → General → Workflow permissions，勾選「Allow GitHub Actions to create and approve pull requests」並儲存。沒勾的話，自動採集只會推分支、不會開 PR（Actions 的摘要會提示）。

## 排程

`refresh-data.yml`，每週一 03:23（日本時間）自動跑。依日期決定範圍：

| 範圍 | 什麼時候 | 內容 |
|---|---|---|
| 每週 | 每個週一 | 擴充包（寶可夢人孔蓋、寶可夢中心、城）、祭典 |
| 每月 | 每月第一個週一 | 每週的全部，再加老舖・茶屋、角色商店（OSM 逐縣查詢，各約一小時）、地區特色（全國）、各縣的維基簡介與念法 |
| 每季 | 1、4、7、10 月第一個週一 | 每月的全部，但各縣改成大點整個重採（含簡介與念法） |

- 也可以手動跑：Actions → refresh-data → Run workflow，選範圍；每月、每季可以只填幾個縣。
- 期間限定維持原樣：每天 17:50 直接提交 main（`harvest-timed.yml`），不走 PR。
- 某一項採集失敗（例如 OSM 暫時逾時）不會讓整個排程失敗：那一項沿用 main 的資料，PR 裡列出失敗的項目。

## 自動開的 PR

跑完有變更就推到 `pipeline/refresh-<編號>`，開一個「資料更新（每週）#編號」的 PR。PR 描述有：

1. **資料變更**（`diff-report`）：各檔新增、刪除、修改幾筆；列出新增、刪除的名稱；簡介、念法、中文名、座標各改了幾筆，念法列出「舊 → 新」。
2. **資料檢查**（`validate-data`）：
   - 格式：固定縮排、依 id 排序、id 不重複（diff 才讀得懂）。
   - 結構：依 `pipeline/models.py` 的 schema 檢查景點、地區特色、祭典、期間限定、會話、鐵路；擴充包檢查縣、座標、來源。
   - 來源：每筆都要有來源網址與取得時間。
   - 禁用句型：翻譯的簡介不能有「不僅…更是…」「必訪」、驚嘆號等（PLAN.md §6a）。
   - bundle：data/ 能建出網站用的 bundle。
   - 結果也寫成 PR 上的狀態「資料檢查」（綠勾或紅叉）。
3. 失敗的項目、各項採集的原始報告（折疊）。

你在 GitHub 看完按 **Merge** 就好：
- 合併後 main 有推送，自動部署 Firebase Hosting 與 GitHub Pages。
- PR 合併或關閉後，`pipeline-pr-closed.yml` 自動刪掉分支。
- 上一個自動 PR 還沒合併時，新的 PR 開好後會把舊的關掉（新的一定包含舊的內容，因為都是從 main 重採）。

一般的 CI（每次推 main）也加上了資料檢查。

## 用量

| 項目 | 免費額度 | 現況 |
|---|---|---|
| GitHub Actions | repo 是公開的：標準 runner 不計分鐘數 | 每週約 30–60 分鐘；每季重採各縣約數小時，都不收費 |
| Firebase Hosting | Spark：儲存 10 GB、每天傳輸 360 MB | 網站＋bundle 約 42 MB。第一次開首頁約下載 0.7 MB（壓縮後：程式約 0.6 MB、首頁精選 53 KB），搜尋第一次用時再下載 0.6 MB。估計一天幾百個新訪客以內都在額度內；回訪有瀏覽器快取 |
| Firestore | Spark：每天讀 5 萬、寫 2 萬、刪 2 萬；儲存 1 GiB | 只有個人資料（收藏、去過、清單、行程、截圖）。一次登入約讀「收藏與去過筆數＋清單＋行程＋截圖」筆數，個人和旅伴使用遠低於每天 5 萬 |

- **要注意的是截圖**：一張截圖（原圖＋縮圖）壓縮後最多約 1 MB，Firestore 儲存 1 GiB 大約是一千張。你可以在 Firebase Console → Firestore → 用量 看目前的讀寫與儲存。
- Firestore 的用量要用服務帳戶才查得到，沒有放進自動檢查；需要的話可以另外加一個唯讀的服務帳戶 secret。
- GitHub 的排程：repo 60 天沒有任何提交時，GitHub 會自動停用排程。期間限定每天都會提交，所以不會發生。

## 試跑結果

（試跑後補上）

## 請你驗收

- [ ] 勾選「Allow GitHub Actions to create and approve pull requests」。
- [ ] Actions → refresh-data → Run workflow（weekly）手動跑一次，確認開出 PR、描述有資料變更與資料檢查、PR 上有「資料檢查」狀態。
- [ ] 合併那個 PR，確認網站幾分鐘後更新、分支自動刪除。
- [ ] 之後一週：週一的排程自動開 PR（Phase 6 驗收條件「排程連續跑一週沒有錯誤」）。

## 還沒做到的

- Firestore 用量沒有自動檢查（要服務帳戶）。
- 自動 PR 不會觸發一般 CI（GitHub 對 GITHUB_TOKEN 的限制）；檢查在 refresh-data 裡跑，結果寫成狀態。要正式的 CI 檢查需另外建 GitHub App 或個人 token。
- 手動的 seed-region、seed-pack 還是推分支、不開 PR，照舊由我合併。
