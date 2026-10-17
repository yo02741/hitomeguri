// 番外篇遊戲的測試資料：本機 build 過的 web/public/bundles/game/{縣}.json（pipeline/game_bundle.py 抽好的、
// 遊戲執行時讀的同一份）排成好讀的縮排存進來。CI 沒有 bundles（gitignore、不跑 build-bundles），所以 vitest 只讀這裡
// commit 進去的 JSON。
// 重做：（repo 根目錄）.venv/bin/python -m pipeline.cli build-bundles，然後 node web/src/game/fixtures/build-fixtures.mjs
// 內容（以前在這支腳本算，2026-10-17 搬到 pipeline）：分數前 12 個市区町村＋有名城蓋章地點的市区町村，每區分數前 16 個景點
// ＋機場；簡介只留前 160 字；市区町村的外框與相鄰（touches）；祭典、老舖的 m（位置落在哪一個市区町村，point-in-polygon）；
// 縣內的路網（京都另外加到関西国際空港的路徑）；角色主題的店不放。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundles = join(here, '../../../public/bundles')

for (const pref of ['kyoto', 'okinawa']) {
  const raw = JSON.parse(readFileSync(join(bundles, 'game', `${pref}.json`), 'utf8'))
  writeFileSync(join(here, `${pref}.json`), JSON.stringify(raw, null, 1) + '\n')
}
console.log('寫好 fixtures/kyoto.json、fixtures/okinawa.json')
