import { pixelRomaji, type Silhouette, silhouetteOf, type StampArt } from '../content/icons'
import type { CalendarDate } from '../engine/clock'
import type { Game } from '../engine/game'
import type { SourceRef } from '../engine/types'

import { type DataIndex, dayKey, kitOfPref, parseDayKey, type PlaceName, prefName } from './data'
import { type StampMeta, systemsOf } from './state'
import { sourceOf } from './summary'
import { isP3Pref, stripDisambig } from '../world/gen/classify'
import { stationRomaji } from '../world/romaji'

import type { StampData } from './types'

/**
 * 印帳（規格 §8.6）：一縣一頁的蛇腹帳。三種章：
 * - 站章：遊戲自製的圖案（站名的羅馬字＋那一鎮代表地標的剪影），不是真的站章。
 * - 參拜印：神社、寺院的授与所蓋，遊戲自製（不叫御朱印）。
 * - 名城的章：100 名城、續 100 名城，在資料裡的蓋章地點（st）蓋；印面寫資料有的：「日本100名城 No.53」。
 * 蓋過的章 id 在引擎的 state.stamps，日期在 systems 的 stamps。
 */
export interface StampView {
  id: string
  kind: StampData['stampKind']
  pref: string
  name: PlaceName
  art: StampArt
  /** 印面上的字（只寫資料裡有的） */
  face?: string
  /** 蓋章地點（名城：資料的 st） */
  where?: string
  date?: CalendarDate
  source?: SourceRef
}

/**
 * 實體的 data → 章的樣子。資料（那一縣的 DataIndex）優先；那一縣還沒讀進來、讀不到時用蓋章時記下來的（meta）。
 */
export function stampView(d: StampData, data: DataIndex, meta?: StampMeta): StampView {
  const okinawa = kitOfPref(d.pref) === 'okinawa'
  const spot = data.spot(d.spotId)
  const saved = meta?.a && SILHOUETTES.has(meta.a) ? (meta.a as Silhouette) : undefined
  const sil: Silhouette = spot ? silhouetteOf(spot.c, spot.n, okinawa) : (saved ?? (d.stampKind === 'station' ? 'train' : 'house'))
  if (d.stampKind === 'castle') {
    const c = data.castle(d.castleId) ?? (d.spotId ? data.castleOfSpot(d.spotId) : undefined)
    const series = c?.g === 'zoku' ? '続日本100名城' : '日本100名城'
    const no = c?.no ?? meta?.no
    return {
      id: d.stampId,
      kind: 'castle',
      pref: d.pref,
      name: { ja: c?.n ?? d.name, kana: c?.h, zh: c?.z },
      art: { shape: 'castle', silhouette: okinawa ? 'gusuku' : 'castle', no },
      face: c?.no ? `${series} No.${c.no}` : (meta?.f ?? d.face),
      where: c?.st?.length ? c.st.join('、') : meta?.w,
      source: sourceOf(c?.u ?? meta?.u) ?? undefined,
    }
  }
  if (d.stampKind === 'station') {
    const st = data.station(d.stationId)
    // 羅馬字：世界生成算好的 face（英文名不是羅馬字時用同名景點的，都沒有就不寫）
    const romaji = pixelRomaji(d.face ?? (st || spot ? stationRomaji(st?.e, spot?.r) : (meta?.f ?? '')))
    return {
      id: d.stampId,
      kind: 'station',
      pref: d.pref,
      name: { ja: st?.n ?? d.name, ...(romaji ? { romaji } : {}) },
      art: { shape: 'station', silhouette: sil, romaji },
      face: romaji || undefined,
    }
  }
  // P3 的縣：名字的消歧義括號（「慈光院 (大和郡山市)」）不蓋在印上
  const ja = spot?.n ? (isP3Pref(d.pref) ? stripDisambig(spot.n) : spot.n) : d.name
  return {
    id: d.stampId,
    kind: 'sanpai',
    pref: d.pref,
    name: { ja, kana: spot?.h, zh: spot?.z && spot.z !== spot.n ? spot.z : undefined },
    art: { shape: 'sanpai', silhouette: sil },
    face: ja,
  }
}

const SILHOUETTES = new Set<string>(['torii', 'temple', 'castle', 'gusuku', 'museum', 'park', 'bridge', 'island', 'beach', 'tower', 'gate', 'market', 'airport', 'cape', 'utaki', 'house', 'train'] satisfies Silhouette[])

/**
 * 蓋章：第一次回 true（存檔由呼叫的人做）。章的資料一起記下來；view（蓋的時候看到的樣子）給了的話，
 * 印面的字、名城的 No.、蓋章地點、出處、剪影也記下來（那一縣的資料之後還沒讀進來時印帳照樣畫得出來）。
 */
export function pressStamp(game: Game, d: StampData, town?: string, view?: StampView): boolean {
  if (game.state.stamps.includes(d.stampId)) return false
  game.state.stamps.push(d.stampId)
  const m: StampMeta = {
    d: dayKey(game.clock.date),
    town,
    k: d.stampKind,
    p: d.pref,
    n: d.name,
    sp: d.spotId,
    c: d.castleId,
    st: d.stationId,
  }
  if (view) {
    if (view.face && view.face !== d.name) m.f = view.face
    if (view.art.no) m.no = view.art.no
    if (view.where) m.w = view.where
    if (view.source?.url) m.u = view.source.url
    if (view.kind !== 'castle') m.a = view.art.silhouette
  }
  systemsOf(game).stamps[d.stampId] = m
  game.changed('stamps')
  return true
}

export const hasStamp = (game: Game, id: string) => game.state.stamps.includes(id)

/** 存檔裡記的 → StampData */
export function stampDataOf(id: string, m: StampMeta): StampData {
  return { stampId: id, stampKind: m.k, pref: m.p, name: m.n, spotId: m.sp, castleId: m.c, stationId: m.st }
}

/** 印帳的一頁（一縣） */
export interface StampBookPage {
  pref: string
  title: PlaceName
  stamps: StampView[]
  /** 這一縣蓋得到的章一共幾個（world 知道才寫） */
  total?: number
}

/** 印帳：prefs 的順序（京都、沖繩），每縣照蓋的順序 */
export function stampBook(game: Game, data: DataIndex, prefs: readonly string[], totals?: (pref: string) => number | undefined): StampBookPage[] {
  const meta = systemsOf(game).stamps
  const byPref = new Map<string, StampView[]>()
  for (const id of game.state.stamps) {
    const m = meta[id]
    if (!m) continue
    const v = { ...stampView(stampDataOf(id, m), data, m), date: parseDayKey(m.d) ?? undefined }
    const list = byPref.get(m.p) ?? []
    list.push(v)
    byPref.set(m.p, list)
  }
  const order = [...new Set([...prefs, ...byPref.keys()])]
  return order.map((pref) => ({ pref, title: prefName(pref), stamps: byPref.get(pref) ?? [], total: totals?.(pref) }))
}
