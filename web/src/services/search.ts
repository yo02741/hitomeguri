// 景點搜尋（PLAN.md §6）：在瀏覽器裡比對全國索引（bundles/search.json）。
// 日文名、假名、繁中名、羅馬拼音都可以搜；片假名與平假名、全形與半形、大小寫、長音符號都視為相同。

import { regions } from '../data/regions'
import type { SearchRow } from './bundles'

export function normalize(s: string): string {
  return (
    s
      .normalize('NFKC')
      .toLowerCase()
      // 片假名 → 平假名
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      // 羅馬拼音的長音符號（ō → o）
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .normalize('NFC')
      .replace(/[\s・･·\-‐ー'’.]/g, '')
  )
}

export interface SearchHit {
  kind: 'pref' | 'spot'
  id: string
  pref: string
  name: string
  kana?: string
  zh?: string
}

interface Indexed {
  row: SearchRow
  keys: string[]
}

let indexed: Indexed[] = []

export function setIndex(rows: SearchRow[]) {
  indexed = rows.map((row) => ({ row, keys: [row[2], row[3], row[4], row[5]].filter(Boolean).map(normalize) }))
}

const prefKeys = regions.map((r) => ({
  r,
  keys: [r.name.ja, r.name.kana, r.name.zh_tw, r.name.romaji].filter(Boolean).map(normalize),
}))

/** 比對等級：完全相同 0、開頭相同 1、包含 2；不符合回傳 null */
function rank(keys: string[], q: string): number | null {
  let best: number | null = null
  for (const k of keys) {
    const r = k === q ? 0 : k.startsWith(q) ? 1 : k.includes(q) ? 2 : null
    if (r !== null && (best === null || r < best)) best = r
  }
  return best
}

export function search(query: string, limit = 12): SearchHit[] {
  const q = normalize(query)
  if (!q) return []
  const prefs: SearchHit[] = prefKeys
    .filter(({ keys }) => rank(keys, q) !== null && rank(keys, q)! <= 1)
    .map(({ r }) => ({ kind: 'pref', id: r.prefecture, pref: r.prefecture, name: r.name.ja, kana: r.name.kana }))
  const spots: { hit: SearchHit; rank: number; score: number }[] = []
  for (const { row, keys } of indexed) {
    const r = rank(keys, q)
    if (r === null) continue
    const [id, pref, name, kana, zh, , score] = row
    spots.push({ hit: { kind: 'spot', id, pref, name, kana: kana || undefined, zh: zh || undefined }, rank: r, score })
  }
  spots.sort((a, b) => a.rank - b.rank || b.score - a.score)
  return [...prefs.slice(0, 2), ...spots.slice(0, limit - Math.min(prefs.length, 2)).map((s) => s.hit)]
}
