/**
 * 假名 → 羅馬字（地名牌的小字）：照資料的念法（市区町村的 h、景點的 h）轉成平文式，不另外查。
 * 長音不加符號（おう、うう → O、U），「ん」在母音、y 前寫 N'，促音重複下一個子音。
 * 市区町村的字尾（区、市、町、村）前面加一個連字號：しもぎょうく → SHIMOGYO-KU。
 */
const BASE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to', だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho', ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
}

/** 拗音：き＋ゃ → kya，し＋ゃ → sha */
function youon(prev: string, small: string): string | null {
  const v = small === 'ゃ' ? 'a' : small === 'ゅ' ? 'u' : small === 'ょ' ? 'o' : null
  if (!v) return null
  const r = BASE[prev]
  if (!r || !r.endsWith('i')) return null
  const head = r.slice(0, -1)
  if (head === 'sh' || head === 'ch' || head === 'j') return head + v
  return `${head}y${v}`
}

/** 片假名 → 平假名（長音符號另外處理） */
const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

export function kanaToRomaji(kana: string): string {
  const s = toHira(kana.normalize('NFKC'))
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    const next = s[i + 1]
    if (c === 'っ') {
      // 促音：下一個音的子音重複（ち → tchi）
      const n = next ? (BASE[next] ?? '') : ''
      out += n.startsWith('ch') ? 't' : (n[0] ?? '')
      continue
    }
    if (c === 'ー') {
      continue
    }
    if (next && 'ゃゅょ'.includes(next)) {
      const y = youon(c, next)
      if (y) {
        out += y
        i++
        continue
      }
    }
    const r = BASE[c]
    if (r === undefined) {
      out += c
      continue
    }
    if (c === 'ん' && next && (BASE[next] ?? '').match(/^[aeiouy]/)) out += "n'"
    else out += r
  }
  // 長音：ou、uu、oo → o、u
  return out.replace(/ou/g, 'o').replace(/uu/g, 'u').replace(/oo/g, 'o')
}

const SUFFIX: Array<[RegExp, RegExp]> = [
  [/区$/, /ku$/],
  [/市$/, /shi$/],
  [/町$/, /(cho|machi)$/],
  [/村$/, /(son|mura)$/],
]

/** 地名牌的羅馬字（大寫）：名字的字尾是区市町村時加連字號 */
export function placeRomaji(name: string, kana?: string): string {
  if (!kana) return ''
  let r = kanaToRomaji(kana)
  for (const [kanji, roma] of SUFFIX)
    if (kanji.test(name) && roma.test(r)) {
      r = r.replace(roma, (m) => `-${m}`)
      break
    }
  return r.toUpperCase()
}

/** 一個字是不是平文式羅馬字（長音符號、連字號可以；英文字 Office、Airport、Station 不是） */
const ROMAJI_WORD = /^(?:(?:ky|gy|sh|ch|ny|hy|by|py|my|ry|ts|[kgsztdnhbpmyrwfjv])?[aiueo]|n'?|m(?=[bpm])|([kstpcgdbjfh])(?=\1)|t(?=ch))+$/

export function isRomaji(s: string): boolean {
  const words = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
  // JR（會社名的縮寫）可以
  return words.length > 0 && words.every((w) => w === 'jr' || ROMAJI_WORD.test(w))
}

/**
 * 車站的羅馬字（站名牌、站章）：rail bundle 的 e 是 OSM 的英文名（name:en），只有它本身就是羅馬字時才用
 * （去掉後面的 Station）；不是（Prefectural Office、Naha Airport）就用同名景點的羅馬字（r），都沒有就不寫。
 */
export function stationRomaji(e?: string, alt?: string): string {
  const base = (e ?? '').replace(/\s+(station|sta\.?)$/i, '').trim()
  if (base && isRomaji(base)) return base.toUpperCase()
  const a = (alt ?? '').trim()
  return a && isRomaji(a) ? a.toUpperCase() : ''
}
