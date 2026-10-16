import type { Outfit } from '../outfits'
import { BG as CHUBU } from './chubu'
import { BG as CHUGOKU } from './chugoku'
import { BG as HOKKAIDO_TOHOKU } from './hokkaidoTohoku'
import { BG as KANTO } from './kanto'
import { BG as KANTO_NORTH } from './kantoNorth'
import { BG as KINKI } from './kinki'
import { BG as KINKI_WEST } from './kinkiWest'
import { BG as KYUSHU } from './kyushu'
import { BG as KYUSHU_SOUTH } from './kyushuSouth'
import { BG as SHIKOKU } from './shikoku'
import { BG as TOHOKU_SOUTH } from './tohokuSouth'
import { BG as TOKAI } from './tokai'

/** 地區背景：47 縣各 3 張（kit.ts），依地方的順序 */
export const BG_OUTFITS: Outfit[] = [
  ...HOKKAIDO_TOHOKU,
  ...TOHOKU_SOUTH,
  ...KANTO_NORTH,
  ...KANTO,
  ...CHUBU,
  ...TOKAI,
  ...KINKI,
  ...KINKI_WEST,
  ...CHUGOKU,
  ...SHIKOKU,
  ...KYUSHU,
  ...KYUSHU_SOUTH,
]
