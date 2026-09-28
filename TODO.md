# TODO

## 需要你做的事

1. 在 repo 的 Settings → Secrets and variables → Actions 新增 `ANTHROPIC_API_KEY`。
2. 到 Actions 手動跑 `enrich`，task 選 enrich，先用 limit 20 驗證文風，沒問題再設 limit 0 跑全部。這會補上繁中簡介和缺漏的假名，目前約六成景點沒有假名。
3. 同一個 workflow 的 task 改選 verify-flights，驗證 7 條直飛航線。依 PLAN 的規則，未驗證的航線不會顯示，所以地區海報區目前沒有航線。

## 還沒做到的部分

- 老香鋪與香道主題：OSM 資料不足，要靠 Claude 網頁搜尋，等 API key 設定後處理。
- 各寺社御朱印授與與限定款的細節，同樣要等 API key。
- 地區特色的官方來源（農林水產省 GI、地域團體商標、郷土料理）還沒接上。這個環境連不到那些網站，無法確認網址與格式，所以目前以攻略種子對齊 Wikidata 的結果為準。
- 有 8 個攻略景點對不上資料來源，列在 docs/PROGRESS.md，需要你人工確認，其中包括大須商店街、灘五郷、伊根の舟屋。
- 主題小店（OSM 來源）沒有照片；大點約一成沒有 Commons 照片。
