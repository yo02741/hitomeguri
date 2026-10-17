/**
 * 關東、北海道的 tile kit（P3）：在另一檔（game-kits-*.js），兩個 kit 同一檔、一起註冊。
 * play/world.ts 的 loadKitModule 只 import 這一檔（不分 kit）：讀過一次（不管先到東京還是北海道）兩個都有，
 * 重試的網址也只有一個（瀏覽器記住失敗的 import 是照網址記的）。
 * 北海道的鎮也用得到關東的零件（自動販賣機、郵筒），hokkaido.ts 自己 import kanto.ts。
 */
import './kanto'
import './hokkaido'

