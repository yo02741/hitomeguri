/**
 * 北海道的鎮也用近畿的寺社、茶屋、展館、城門（藍圖沒有北海道的版本）：冬天北海道的屋頂是厚雪，
 * 近畿的畫法只有京都那種薄薄的一層。這裡列出要換成「北海道冬天的厚雪版」的近畿物件（＋雪的厚度 px），
 * kits/hokkaido.ts 照這張表註冊 'hokkaido/kinki-…'，gen/roles.ts 的北海道 objSub 照這張表換。
 * 只是資料（不畫圖），兩邊都 import 得到（不會把北海道的 kit 拉進一開始的那一檔）。
 */
export const HOKKAIDO_SNOW_OBJECTS: Readonly<Record<string, number>> = {
  'kinki/haiden': 12,
  'kinki/haiden-l': 12,
  'kinki/juyosho': 8,
  'kinki/chozuya': 5,
  'kinki/torii': 3,
  'kinki/teahouse': 12,
  'kinki/museum': 10,
  'kinki/gate-big': 4,
  'kinki/gate': 5,
  'kinki/castle-gate': 8,
  'kinki/castle-house': 8,
  'kinki/hondo': 12,
  'kinki/hondo-l': 12,
  'kinki/hondo-b': 12,
  'kinki/hondo-l-b': 12,
  'kinki/sanmon': 8,
  'kinki/sanmon-b': 8,
  'kinki/umbrella': 4,
}

/** 近畿的單格 tile 的北海道版（拱廊的屋頂：冬天積雪） */
export const HOKKAIDO_SNOW_TILES: Readonly<Record<string, string>> = { 'kinki/arcade': 'hokkaido/kinki-arcade' }

/** 'kinki/haiden' → 'hokkaido/kinki-haiden' */
export const snowObjectName = (name: string) => `hokkaido/${name.replace('/', '-')}`
