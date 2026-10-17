import { factFromRef } from '../content/facts'
import type { Game } from '../engine/game'
import {
  type AlbumSpotPage,
  type BagEntry,
  type HeardEntry,
  type HeardPageData,
  type MapPageData,
  type MapPref,
  type PhotoEntry,
  provideNotebook,
  type QuestEntry,
  type StampEntry,
} from '../ui/notebook'

import { type DataIndex, parseDayKey, prefName, townCodeOfMap } from './data'
import type { GameSystems } from './install'
import { questItemCard } from './inventory'
import { questText, questUntil } from './quests'
import { roomCount } from './room'
import { PHOTO_SLOTS, SLOT_LABEL, systemsOf } from './state'
import { stampBook } from './stamps'
import { firstSentence, sourceOf } from './summary'
import { thumbUrl } from './photoStore'

/**
 * 旅人手帳的頁（ui/notebook.ts 的 provideNotebook）：地圖（兩縣的鎮、去過的、現在在哪）、印帳、相簿、
 * 行李（東西、旅費、吃過的）、聽來的（每一句事實與出處）、委託、房間。打開手帳、Game 發 change 時重算。
 */
export function installNotebook(sys: GameSystems): () => void {
  const mine = (g: Game) => g === sys.game
  const offs = [
    provideNotebook('map', (g, base) => (mine(g) ? mapPage(sys, base) : base)),
    provideNotebook('stamps', (g, base) => (mine(g) ? { books: stampsPage(sys) } : base)),
    provideNotebook('album', (g, base) => (mine(g) ? albumPage(sys) : base)),
    provideNotebook('bag', (g, base) => (mine(g) ? bagPage(sys) : base)),
    provideNotebook('heard', (g, base) => (mine(g) ? heardPage(sys) : base)),
    provideNotebook('quests', (g, base) => (mine(g) ? { quests: questsPage(sys) } : base)),
    provideNotebook('room', (g, base) => {
      if (!mine(g)) return base
      const n = roomCount(g)
      const inn = systemsOf(g).inn
      return { name: inn ? { ja: inn } : null, placed: n.placed, slots: n.slots }
    }),
  ]
  return () => offs.forEach((off) => off())
}

/** 縣的順序：世界索引的 7 縣（北到南）；沒有索引時是資料給的順序（京都、沖繩） */
const prefOrder = (sys: GameSystems) => sys.data.gamePrefs()

function mapPage(sys: GameSystems, base: MapPageData): MapPageData {
  const s = systemsOf(sys.game)
  const here = townCodeOfMap(sys.game.map?.id) ?? s.lastTown ?? null
  const towns = sys.data.allTowns()
  const prefs: MapPref[] = []
  for (const pref of [...new Set([...prefOrder(sys), ...towns.map((t) => t.pref)])]) {
    // 還沒去過（還沒讀）的縣：世界索引的鎮
    const list = sys.data.townsOf(pref)
    if (!list.length) continue
    // 北到南（緯度大的在前）
    const lat = (id: string) => sys.data.centerOf(sys.data.town(id)!)?.lat ?? 0
    list.sort((a, b) => lat(b.id) - lat(a.id))
    prefs.push({ pref, title: prefName(pref), towns: list.map((t) => ({ id: t.id, name: { ...t.name }, visited: s.visited.includes(t.id), here: t.id === here })) })
  }
  return { ...base, towns: prefs.flatMap((p) => p.towns), prefs }
}

function stampsPage(sys: GameSystems) {
  return stampBook(sys.game, sys.data, prefOrder(sys), sys.deps.stampTotal).map((b) => ({
    pref: b.pref,
    title: b.title,
    total: b.total,
    stamps: b.stamps.map(
      (v): StampEntry => ({ id: v.id, kind: v.kind, name: v.name, face: v.face, date: v.date, source: v.source, art: v.art, where: v.where }),
    ),
  }))
}

function albumPage(sys: GameSystems) {
  const s = systemsOf(sys.game)
  const entry = (id: string): PhotoEntry | null => {
    const m = s.photos[id]
    if (!m) return null
    const date = parseDayKey(m.d)
    if (!date) return null
    return { id, spot: { ...m.name }, date, time: m.t, season: m.s, score: m.score, thumb: thumbUrl(id), slot: m.slot, together: m.tg, w: m.w, h: m.h }
  }
  const pages: AlbumSpotPage[] = []
  for (const [key, row] of Object.entries(s.album)) {
    const slots = PHOTO_SLOTS.map((slot) => ({ slot, label: SLOT_LABEL[slot], photo: row[slot] ? entry(row[slot]!) : null }))
    const first = slots.find((x) => x.photo)?.photo
    if (!first) continue
    pages.push({ key, name: { ...first.spot }, slots })
  }
  // 最近拍的那一頁在前
  const latest = (p: AlbumSpotPage) => Math.max(...p.slots.map((x) => (x.photo ? Date.UTC(x.photo.date.y, x.photo.date.m - 1, x.photo.date.d) : 0)))
  pages.sort((a, b) => latest(b) - latest(a) || (a.key < b.key ? -1 : 1))
  const photos = sys.game.state.album.map(entry).filter((p): p is PhotoEntry => !!p)
  return { photos, pages }
}

function bagPage(sys: GameSystems) {
  const g = sys.game
  const items: BagEntry[] = []
  for (const [key, n] of Object.entries(g.state.items)) {
    const card = questItemCard(key, sys.data, g)
    if (!card) continue
    items.push({ id: key, name: card.name, count: n, kind: card.kind, source: card.source, card })
  }
  const eaten: BagEntry[] = []
  for (const [id, m] of Object.entries(systemsOf(g).eaten)) {
    const card = sys.card(`specialty:${id}`)
    if (!card) continue
    eaten.push({ id, name: card.name, count: m.n, kind: card.kind, source: card.source, card, date: parseDayKey(m.d) ?? undefined })
  }
  eaten.sort((a, b) => (a.date && b.date ? Date.UTC(b.date.y, b.date.m - 1, b.date.d) - Date.UTC(a.date.y, a.date.m - 1, a.date.d) : 0))
  return { money: g.state.money, items, eaten }
}

function heardPage(sys: GameSystems): HeardPageData {
  const out: HeardEntry[] = []
  const s = systemsOf(sys.game)
  // 那一縣的資料還沒讀進來（P3 的延遲載入：重新整理之後去過的縣在背景讀）：那幾句先不列，頁面寫「讀取中」
  let pending = false
  const later = (where: ReturnType<DataIndex['townOfMap']>) => {
    if (where?.pref && !sys.data.pref(where.pref)) pending = true
  }
  for (const [i, h] of s.heard.entries()) {
    const where = sys.data.townOfMap(h.m)
    const date = parseDayKey(h.d) ?? undefined
    const whereLabel = where ? { ...where.name } : undefined
    if (h.k === 'fact' && h.ref) {
      const f = factFromRef(h.id, h.ref, h.p ?? {}, sys.data, where, h.s)
      if (f) out.push({ id: `${f.key}:${i}`, text: f.text, source: f.source, where: whereLabel, date })
      else later(where)
      continue
    }
    // 告示牌：景點或祭典的簡介第一句
    const [kind, id] = h.id.split(':') as [string, string]
    const sum = kind === 'spot' ? sys.data.spot(id)?.summary : kind === 'festival' ? sys.data.festival(id)?.summary : undefined
    const src = sourceOf(sum?.source_url)
    if (!sum || !src) {
      later(where)
      continue
    }
    const zh = sum.lang !== 'zh' && sum.text_zh
    out.push({ id: `${h.id}:${i}`, text: firstSentence(zh || sum.text, zh ? 'zh' : sum.lang), source: src, where: whereLabel, date })
  }
  return { facts: out.reverse(), ...(pending ? { pending: true } : {}) }
}

function questsPage(sys: GameSystems): QuestEntry[] {
  return systemsOf(sys.game).quests.active.map((q) => ({
    id: q.id,
    text: questText(q, sys.data),
    from: sys.data.town(q.from) ? { ...sys.data.town(q.from)!.name } : null,
    reward: q.reward,
    ready: !!q.ready,
    date: parseDayKey(q.d) ?? undefined,
    until: q.ready ? undefined : (questUntil(q) ?? undefined),
  }))
}
