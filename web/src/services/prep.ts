import { categoryGroup } from '../data/categories'
import type { MapSpot, Specialty, Spot } from './bundles'
import { type Trip } from './trip'

// 旅前準備（PLAN.md §9 Phase 7b）：由行程在前端即時組裝，不呼叫 LLM。
// 地名與車站念法來自目錄（Wikidata、OSM）；會話來自 data/phrases；特色詞來自地區特色。

export interface Phrase {
  id: string
  context: { theme?: string; spot_kind?: string; situation: string }
  direction: 'hear' | 'say' | 'read'
  ja: string
  kana: string
  romaji: string
  zh_tw: string
  answer_hint?: { ja: string; kana: string; zh_tw: string }
  note_zh?: string
  priority: 1 | 2 | 3
  reviewed: boolean
}

/** 地名（景點或車站） */
export interface PrepPlace {
  key: string
  kind: 'spot' | 'station'
  ja: string
  kana?: string
  romaji?: string
  en?: string
  zh?: string
  pref: string
  /** 第幾天（0 起）；待排為 undefined */
  day?: number
  /** 車站：離哪個景點最近 */
  near?: string
}

export interface PrepWord {
  key: string
  ja: string
  kana?: string
  romaji?: string
  zh?: string
  pref: string
}

export const SITUATION_LABEL: Record<string, string> = {
  train: '車站・電車',
  konbini_checkout: '超商結帳',
  checkout: '付款',
  restaurant: '餐廳',
  shopping: '購物',
  packaging: '包裝',
  general: '通用',
  ramen_shop_order: '拉麵店',
  tea_shop: '茶屋',
  sake_brewery: '酒藏',
  onsen_entry: '溫泉',
  shrine_visit: '寺社',
  museum_ticket: '博物館・美術館',
  castle_visit: '城',
  park_ticket: '樂園・動物園・水族館',
  outdoors: '公園・庭園',
}

// 景點類型組別（data/categories.ts）→ 會話的 spot_kind
const KIND_OF_GROUP: Record<string, string> = {
  shrine: 'shrine',
  museum: 'museum',
  castle: 'castle',
  fun: 'fun',
  nature: 'nature',
}

/** 這趟涵蓋的會話主題：景點類型、名稱有「温泉」、所在縣的地區特色（拉麵、茶、酒） */
export function tripThemes(spots: MapSpot[], specialties: Specialty[]): Set<string> {
  const out = new Set<string>()
  for (const s of spots) {
    const kind = KIND_OF_GROUP[categoryGroup(s.c)]
    if (kind) out.add(kind)
    if (s.n.includes('温泉')) out.add('onsen')
  }
  for (const sp of specialties) {
    if (sp.category === 'ramen') out.add('ramen')
    if (sp.category === 'tea' || (sp.category === 'drink' && sp.name.ja.includes('茶'))) out.add('tea')
    if (sp.category === 'sake' || (sp.category === 'drink' && sp.name.ja.includes('酒'))) out.add('sake')
  }
  return out
}

export function selectPhrases(all: Phrase[], themes: Set<string>): Phrase[] {
  return all
    .filter((p) => {
      const key = p.context.theme ?? p.context.spot_kind
      return !key || themes.has(key)
    })
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
}

/** 景點與最近車站（每個景點取最近的一站；同名車站只列一次） */
export function tripPlaces(trip: Trip, details: Map<string, Spot>, spots: Map<string, MapSpot>): PrepPlace[] {
  const out: PrepPlace[] = []
  const stations = new Set<string>()
  const add = (stopId: string, name: string, pref: string, day?: number) => {
    const d = details.get(stopId)
    const m = spots.get(stopId)
    out.push({
      key: `spot-${stopId}`,
      kind: 'spot',
      ja: d?.name.ja ?? m?.n ?? name,
      kana: d?.name.kana ?? m?.h,
      romaji: d?.name.romaji ?? m?.r,
      en: d?.name.en,
      zh: d && d.name.zh_tw !== d.name.ja ? d.name.zh_tw : undefined,
      pref,
      day,
    })
    const st = d?.nearest_stations?.[0]
    if (st && !stations.has(st.name.ja)) {
      stations.add(st.name.ja)
      out.push({
        key: `station-${st.name.ja}`,
        kind: 'station',
        ja: st.name.ja,
        kana: st.name.kana,
        romaji: st.name.romaji,
        en: st.name.en,
        pref,
        day,
        near: d?.name.ja ?? name,
      })
    }
  }
  trip.days.forEach((d, i) => d.stops.forEach((s) => add(s.spot_id, s.name, s.pref, i)))
  trip.unscheduled.forEach((s) => add(s.spot_id, s.name, s.pref))
  return out
}

/** 行程所在縣的地區特色詞（有假名的） */
export function tripWords(prefs: string[], specialties: Specialty[]): PrepWord[] {
  return specialties
    .filter((s) => prefs.includes(s.prefecture) && s.name.kana)
    .map((s) => ({
      key: `spec-${s.id}`,
      ja: s.name.ja,
      kana: s.name.kana,
      romaji: s.name.romaji,
      zh: s.name.zh_tw !== s.name.ja ? s.name.zh_tw : undefined,
      pref: s.prefecture,
    }))
}

/** 練習卡片：正面日文，背面假名、羅馬拼音、中文與情境 */
export interface Card {
  id: string
  ja: string
  kana?: string
  romaji?: string
  zh?: string
  note?: string
  /** 念出來的文字（假名優先，念法比較準） */
  speak: string
  priority: number
}

// Firestore 文件 id 不能有「/」
function docId(s: string): string {
  return s.replace(/\//g, '／').slice(0, 120)
}

export function cards(places: PrepPlace[], phrases: Phrase[], words: PrepWord[]): Card[] {
  return [
    ...places.map((p) => ({
      id: docId(p.key),
      ja: p.ja,
      kana: p.kana,
      romaji: p.romaji,
      zh: p.zh ?? (p.kind === 'station' ? `車站（${p.near} 附近）` : undefined),
      speak: p.kana || p.ja,
      priority: 1,
    })),
    ...phrases.map((p) => ({
      id: docId(`phrase-${p.id}`),
      ja: p.ja,
      kana: p.kana,
      romaji: p.romaji,
      zh: p.zh_tw,
      note: p.answer_hint ? `回答：${p.answer_hint.ja}（${p.answer_hint.zh_tw}）` : p.note_zh,
      speak: p.kana.includes('／') ? p.ja : p.kana,
      priority: p.priority,
    })),
    ...words.map((w) => ({ id: docId(w.key), ja: w.ja, kana: w.kana, romaji: w.romaji, zh: w.zh, speak: w.kana || w.ja, priority: 2 })),
  ]
}
