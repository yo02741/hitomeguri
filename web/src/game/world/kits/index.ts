/**
 * 世界生成的 tile kit：近畿（1024–2047）、沖繩（2048–3071）、各縣共用的室內（3072–4095）、
 * 關東（4096–5119）、北海道（5120–6143）。
 * import 這一檔就全部註冊（side-effect），basic（P0）也一起。
 */
import './core'

export { COMMON_TILES } from './common'
export { HOKKAIDO_BLOOM, HOKKAIDO_TILES } from './hokkaido'
export { KANTO_BLOOM, KANTO_TILES } from './kanto'
export { KINKI_BLOOM, KINKI_TILES } from './kinki'
export { OKINAWA_BLOOM, OKINAWA_TILES } from './okinawa'
export { objectBlocks, objectInfo, objectNames, placeObject } from './objects'
