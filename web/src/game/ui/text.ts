/**
 * 對話框的字（規格 §4）：兩行一頁、打字機。這裡都是純函式（量寬由外面給），對話框元件只管畫。
 *
 *   const pages = paginate('池子邊的花，晚上會合起來。', 200, canvasMeasure(16))
 *   const n = typed(秒數, charsPerSecond('normal', reduced), length(pages[0]))
 *   畫 visible(pages[0], n)
 */

/** 文字速度：慢、一般（約每秒 40 字）、快、立即 */
export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant'
export const TEXT_SPEEDS: readonly TextSpeed[] = ['slow', 'normal', 'fast', 'instant']
export const TEXT_SPEED_LABEL: Record<TextSpeed, string> = { slow: '慢', normal: '一般', fast: '快', instant: '立即' }
const CPS: Record<TextSpeed, number> = { slow: 20, normal: 40, fast: 80, instant: Infinity }

/** 一秒出幾個字；減少動態時一律直接出現（Infinity） */
export function charsPerSecond(speed: TextSpeed, reduced = false): number {
  return reduced ? Infinity : CPS[speed]
}

/** 量一段字有多寬（px）。瀏覽器用 canvas 的 measureText，測試與沒有 canvas 時用 unitMeasure */
export type Measure = (s: string) => number

/** 全形字（漢字、假名、全形標點、韓文）：估寬時算兩個半形 */
export function isWide(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0x303e) ||
    (c >= 0x3041 && c <= 0x33ff) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0xa960 && c <= 0xa97f) ||
    (c >= 0xac00 && c <= 0xd7ff) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x20000 && c <= 0x3fffd)
  )
}

/** 估寬：全形一個字 = fontPx，半形 = fontPx / 2 */
export function unitMeasure(fontPx = 2): Measure {
  return (s) => {
    let w = 0
    for (const ch of s) w += isWide(ch) ? fontPx : fontPx / 2
    return w
  }
}

/** 字數（換行不算；表情等兩個 UTF-16 的字算一個） */
export function length(s: string): number {
  let n = 0
  for (const ch of s) if (ch !== '\n') n++
  return n
}

// 禁則：不放在行首的（句讀、收尾的括號、小的假名、長音）、不放在行尾的（開頭的括號）
const NO_START = new Set(Array.from('、。，．,.!?！？…‥・：；:;」』）)】〉》〕］]｝}ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々〜～'))
const NO_END = new Set(Array.from('「『（(【〈《〔［[｛{'))
const WORD = /[0-9A-Za-zÀ-ɏ'’\-]/

/**
 * 一行字切成不能拆開的小塊：全形一個字一塊；連在一起的英數字是一塊（不從單字中間斷）；
 * 不放行首的字黏在前一塊後面、不放行尾的字黏在後一塊前面；空白自己一塊（折行時丟掉行首的空白）。
 */
export function tokens(line: string): string[] {
  const out: string[] = []
  let open = ''
  for (const ch of line) {
    const last = out.length ? out[out.length - 1]! : ''
    if (NO_START.has(ch) && last && !/\s$/.test(last) && !open) {
      out[out.length - 1] = last + ch
      continue
    }
    if (NO_END.has(ch)) {
      open += ch
      continue
    }
    if (WORD.test(ch) && !open && last && WORD.test(Array.from(last).pop()!) && !isWide(Array.from(last).pop()!)) {
      out[out.length - 1] = last + ch
      continue
    }
    out.push(open + ch)
    open = ''
  }
  if (open) out.push(open)
  return out
}

/** 一塊比一整行還寬（很長的英文字）：只好一個字一個字拆 */
function splitWide(tok: string, max: number, measure: Measure): string[] {
  const parts: string[] = []
  let cur = ''
  for (const ch of tok) {
    if (cur && measure(cur + ch) > max) {
      parts.push(cur)
      cur = ''
    }
    cur += ch
  }
  if (cur) parts.push(cur)
  return parts
}

/** 折成好幾行：每行不超過 max 寬；'\n' 一定換行 */
export function wrap(text: string, max: number, measure: Measure): string[] {
  const lines: string[] = []
  for (const para of text.replace(/\r\n?/g, '\n').split('\n')) {
    let cur = ''
    for (const tok of tokens(para)) {
      if (!cur && /^\s+$/.test(tok)) continue
      if (measure(cur + tok) <= max) {
        cur += tok
        continue
      }
      if (cur) lines.push(cur.replace(/\s+$/, ''))
      cur = ''
      if (/^\s+$/.test(tok)) continue
      if (measure(tok) > max) {
        const parts = splitWide(tok, max, measure)
        lines.push(...parts.slice(0, -1))
        cur = parts[parts.length - 1] ?? ''
      } else cur = tok
    }
    lines.push(cur.replace(/\s+$/, ''))
  }
  return lines
}

/** 兩行一頁（每頁的行用 '\n' 接起來）；空字串也是一頁 */
export function paginate(text: string, max: number, measure: Measure, rows = 2): string[] {
  const lines = wrap(text, Math.max(1, max), measure)
  const pages: string[] = []
  for (let i = 0; i < lines.length; i += rows) pages.push(lines.slice(i, i + rows).join('\n'))
  return pages.length ? pages : ['']
}

/** 打字機：經過 t 秒出了幾個字 */
export function typed(t: number, cps: number, total: number): number {
  if (!Number.isFinite(cps) || cps <= 0) return total
  return Math.max(0, Math.min(total, Math.floor(t * cps)))
}

/** 這一頁出到第 n 個字的樣子（換行照留、不算字） */
export function visible(page: string, n: number): string {
  let out = ''
  let k = 0
  for (const ch of page) {
    if (ch === '\n') {
      out += ch
      continue
    }
    if (k >= n) break
    out += ch
    k++
  }
  return out
}

/** 第 n 個字是不是看得見的字（打字聲：空白、換行不響） */
export function audibleAt(page: string, n: number): boolean {
  let k = 0
  for (const ch of page) {
    if (ch === '\n') continue
    if (k === n) return !/\s/.test(ch)
    k++
  }
  return false
}
