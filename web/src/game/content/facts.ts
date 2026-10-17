import type { SourceRef } from '../engine/types'
import { type DataIndex, prefName } from '../systems/data'
import { firstSentence, sourceOf } from '../systems/summary'
import type { FactRef, FestivalLike, TownLike } from '../systems/types'

/**
 * 事實台詞的樣板（規格 §8.7）：這裡只存樣板＋資料參照，數字、名字、日期都從 bundle 資料填進去；
 * 每一句都要有出處（source_url、維基百科、OSM、氣象廳），沒有出處、缺參數就不說（renderFact 回 null）。
 * 「聽來的」頁列出聽過的每一句與出處（存檔只記樣板 id＋參照，打開時再從資料算一次）。
 */
export const FACT_TEMPLATES = {
  'festival.month': '{name}，每年 {months} 月。',
  'shinise.founded': '這家{name}，創業 {founded}。',
  'castle.stamp': '{series}的章，放在{stamp}。',
  // 季節：平年值是哪一個氣象台的就寫那裡（名護、恩納用的是那覇的，不能說成「這一帶」）
  'sakura.normal': '{station}的櫻花，平年 {date} 滿開。',
  'sakura.kaika': '{station}的櫻花，平年 {date} 開花。',
  'ume.normal': '{station}的梅花，平年 {date} 開花。',
  'kaede.normal': '{station}的楓葉，平年 {date} 轉紅。',
  'ichou.normal': '{station}的銀杏，平年 {date} 轉黃。',
  'ajisai.normal': '{station}的紫陽花，平年 {date} 開花。',
  'rail.km': '到{to}的鐵路約 {km} km。',
  'straight.km': '到{to}的直線距離約 {km} km。',
  'kyodo.dish': '{name}是{pref}的郷土料理。',
  /** 告示牌：簡介的第一句（原文照登） */
  'spot.summary': '{text}',
} as const

export type FactId = keyof typeof FACT_TEMPLATES
export const FACT_IDS = Object.keys(FACT_TEMPLATES) as FactId[]
export const isFactId = (id: string): id is FactId => id in FACT_TEMPLATES

export interface Fact {
  /** 「聽來的」去重複用：樣板＋參照 */
  key: string
  text: string
  source: SourceRef
}

export type FactParams = Record<string, string | number | undefined | null>

/** 樣板裡的參數名 */
export function paramsOf(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!)
}

/**
 * 填樣板。沒有出處（或出處不是網址）、少了任何一個參數，就回 null：寧可不說，也不說沒有出處的事。
 */
export function renderFact(id: string, params: FactParams, source: SourceRef | null | undefined, key = id): Fact | null {
  if (!isFactId(id)) return null
  if (!source || !/^https?:\/\//.test(source.url)) return null
  const t: string = FACT_TEMPLATES[id]
  let missing = false
  const text = t.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k]
    if (v === undefined || v === null || String(v).trim() === '') {
      missing = true
      return ''
    }
    return String(v)
  })
  if (missing) return null
  return { key, text, source }
}

// ---------- 從資料參照找參數與出處 ----------
const JMA = '氣象廳'
const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright'
const SEASON_KEY: Partial<Record<FactId, string>> = {
  'sakura.normal': 'sakura_mankai',
  'sakura.kaika': 'sakura_kaika',
  'ume.normal': 'ume',
  'kaede.normal': 'kaede',
  'ichou.normal': 'ichou',
  'ajisai.normal': 'ajisai',
}

/** '04-04' → '4 月 4 日' */
export function monthDay(s: string | undefined): string | null {
  const m = s ? /^(\d{2})-(\d{2})$/.exec(s) : null
  return m ? `${Number(m[1])} 月 ${Number(m[2])} 日` : null
}

/** 祭典月份的出處：月份是從 Wikidata 還是維基百科來的，就連到那一頁 */
export function festivalMonthSource(f: FestivalLike): SourceRef | null {
  const urls = (f.sources ?? []).map((s) => s.url)
  if (f.months_source === 'wikidata') return sourceOf(urls.find((u) => /wikidata\.org/.test(u)))
  if (f.months_source === 'wikipedia') return sourceOf(urls.find((u) => /wikipedia\.org/.test(u)) ?? f.summary?.source_url)
  return null
}

const joinMonths = (ms: readonly number[]) => [...ms].sort((a, b) => a - b).join('、')

/**
 * 用資料參照說一句事實：ref 是 { kind: 'festival' | 'shinise' | 'castle' | 'specialty' | 'season' | 'spot' | 'rail', id }。
 * params 是 world 另外給的（例：rail.km 的 to、km）；資料裡有的以資料為準。
 */
export function factFromRef(id: string, ref: FactRef, params: FactParams, data: DataIndex, town?: TownLike, given?: SourceRef | null): Fact | null {
  if (!isFactId(id)) return null
  // world 算出來的數字（鐵路 km、直線 km）：world 給的出處優先
  if ((id === 'rail.km' || id === 'straight.km') && given) return renderFact(id, params, given, `${id}:${ref.kind}:${ref.id}`)
  const key = `${id}:${ref.kind}:${ref.id}`
  const p: FactParams = { ...params }
  let source: SourceRef | null = null
  switch (id) {
    case 'festival.month': {
      const f = data.festival(ref.id)
      if (!f?.months?.length) return null
      p.name = f.name.ja
      p.months = joinMonths(f.months)
      source = festivalMonthSource(f)
      break
    }
    case 'shinise.founded': {
      const s = data.shop(ref.id)
      if (!s?.f) return null
      p.name = s.n
      p.founded = s.f
      source = sourceOf(s.w ?? (/wikipedia\.org/.test(s.u) ? s.u : null))
      break
    }
    case 'castle.stamp': {
      const c = data.castle(ref.id)
      if (!c?.st?.length || !c.no) return null
      p.series = c.g === 'zoku' ? '続日本100名城' : '日本100名城'
      p.stamp = c.st.join('、')
      source = sourceOf(c.u)
      break
    }
    case 'kyodo.dish': {
      const s = data.specialty(ref.id)
      if (!s || s.category !== 'kyodo') return null
      p.name = s.name.ja
      p.pref = prefName(data.prefOf(s.id) ?? '').ja
      // 郷土料理的名單是農林水產省「うちの郷土料理」
      source = sourceOf((s.sources ?? []).map((x) => x.url).find((u) => /maff\.go\.jp/.test(u)))
      break
    }
    case 'spot.summary': {
      const s = data.spot(ref.id)
      const sum = s?.summary
      if (!sum) return null
      p.text = firstSentence(sum.text_zh && sum.lang !== 'zh' ? sum.text_zh : sum.text, sum.text_zh && sum.lang !== 'zh' ? 'zh' : sum.lang)
      source = sourceOf(sum.source_url)
      break
    }
    case 'rail.km': {
      // 鐵路 km 是 world 用 rail-graph（OSM）算的
      source = { label: 'OpenStreetMap', url: OSM_COPYRIGHT }
      break
    }
    case 'straight.km':
      // 直線距離是兩點的座標算的：出處由 world 給（factFromRef 的 given）
      source = null
      break
    default: {
      // 季節：ref 是觀測站（kind 'season'，id 是站名）或鎮（kind 'town'）
      const k = SEASON_KEY[id]
      const t = town ?? data.town(ref.id)
      let pref = t?.pref
      let station = ref.kind === 'season' ? null : data.seasonStation(t)
      if (ref.kind === 'season')
        for (const pr of data.prefs) {
          const s = pr.seasons?.stations.find((x) => x.name === ref.id)
          if (s) {
            station = s
            pref = pr.pref
            break
          }
        }
      const date = monthDay(k ? station?.normals[k] : undefined)
      if (!date || !station) return null
      p.date = date
      p.station = station.name
      const url = data.pref(pref)?.seasons?.source.url
      source = url ? { label: JMA, url } : null
    }
  }
  return renderFact(id, p, source, key)
}
