import type { SourceRef } from '../engine/types'

import type { SummaryLike } from './types'

/**
 * 簡介的第一句（品項卡、告示牌，規格 §8.5）：有中文用中文（原文是中文，或有 translate-summaries 的翻譯），
 * 沒有就用原文並標語言。句子照資料原文切，不改寫、不補字；fixture 只留前 160 字，切不到句尾就整段加「…」。
 */
export type SummaryLang = 'zh' | 'ja' | 'en'

export interface SummaryLine {
  text: string
  lang: SummaryLang
  /** 中文是從原文翻過來的 */
  translated: boolean
  source: SourceRef
  license?: string
}

/** 英文句點後面不切的縮寫 */
const ABBR = /\b(?:Mt|St|Dr|Mr|Mrs|Ms|No|Vol|e\.g|i\.e|etc|approx|ca|Jr|Sr)\.$/i

/** 第一句：中日文到第一個「。」（括號裡的不算），英文到第一個句點＋空白＋大寫 */
export function firstSentence(text: string, lang: string): string {
  const t = text.trim()
  if (!t) return ''
  if (lang === 'en') {
    const re = /[.?](?=\s+["“‘(]?[A-Z0-9])/g
    let m: RegExpExecArray | null
    while ((m = re.exec(t))) {
      const head = t.slice(0, m.index + 1)
      if (!ABBR.test(head)) return head
    }
    return /[.?]$/.test(t) ? t : `${t}…`
  }
  let depth = 0
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!
    if ('（(「『【〈《'.includes(ch)) depth++
    else if ('）)」』】〉》'.includes(ch)) depth = Math.max(0, depth - 1)
    else if (ch === '。' && depth === 0) return t.slice(0, i + 1)
  }
  return /[。．]$/.test(t) ? t : `${t}…`
}

/** 出處的小字：網域（ja.wikipedia.org → 維基百科） */
export function sourceLabel(url: string): string {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return '出處'
  }
  if (host.endsWith('wikipedia.org')) return '維基百科'
  if (host.endsWith('wikidata.org')) return 'Wikidata'
  if (host.endsWith('openstreetmap.org')) return 'OpenStreetMap'
  if (host.endsWith('maff.go.jp')) return '農林水產省'
  if (host.endsWith('jma.go.jp')) return '氣象廳'
  return host.replace(/^www\./, '')
}

const isUrl = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//.test(u)

export function sourceOf(url: string | undefined | null): SourceRef | null {
  return isUrl(url) ? { label: sourceLabel(url), url } : null
}

/** 簡介 → 第一句；沒有出處網址的不用（規格 §0：事實要有出處） */
export function summaryLine(s: SummaryLike | null | undefined): SummaryLine | null {
  if (!s || !s.text?.trim()) return null
  const source = sourceOf(s.source_url)
  if (!source) return null
  const lang: SummaryLang = s.lang === 'zh' || s.lang === 'en' || s.lang === 'ja' ? s.lang : 'ja'
  if (lang !== 'zh' && s.text_zh?.trim()) return { text: firstSentence(s.text_zh, 'zh'), lang: 'zh', translated: true, source, license: s.license }
  return { text: firstSentence(s.text, lang), lang, translated: false, source, license: s.license }
}

export const LANG_LABEL: Record<SummaryLang, string> = { zh: '中文', ja: '日文', en: '英文' }

/** 出處的授權：維基百科是 CC BY-SA，OSM 是 ODbL；資料有寫的照資料 */
export function licenseOf(url: string | undefined, given?: string): string | undefined {
  if (given) return given
  if (!url) return undefined
  if (/wikipedia\.org/.test(url)) return 'CC BY-SA 4.0'
  if (/openstreetmap\.org/.test(url)) return 'ODbL'
  if (/wikidata\.org/.test(url)) return 'CC0'
  return undefined
}
