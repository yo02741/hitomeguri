/**
 * 一進 /play 就要的 tile kit：基本（P0）、各縣共用的室內、近畿、沖繩（import 這一檔就註冊）。
 * 關東（kanto.ts）、北海道（hokkaido.ts）在另一檔（game-kits-*.js），第一次到那一縣才讀（play/world.ts 的 loadKitModule）；
 * 測試與預覽 import './kits'（index.ts）就全部都有。
 */
import '../../tiles/basic'
import './common'
import './kinki'
import './okinawa'
