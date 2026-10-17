import { rng, seedOf } from '../../services/pixelwalk/rng'
import { QUEST_LINES, type QuestLines } from '../content/flavour'
import { LOST_THINGS } from '../content/items'
import { addDays, type CalendarDate } from '../engine/clock'
import type { Game } from '../engine/game'

import { type DataIndex, dayKey, parseDayKey, spotName } from './data'
import { itemCard, itemKey, shiniseWhat, TAKEAWAY } from './inventory'
import { DONE_MAX, type Quest, type QuestType, systemsOf } from './state'

/**
 * 委託（規格 §8.5、§8.7）：路人的請託，模板生成、每天換（種子＝遊戲日期＋委託的人）。
 * - deliver：把真的地區特色或老舖的東西送到同一縣的另一鎮（到了跟那一鎮的路人說話就交出去）。
 * - photo：幫忙拍某個地標（地名是資料；有時候要夜景），拍好了回來給他看。
 * - lost：找回掉的東西（一般的小東西），掉在這一鎮某個地標的告示牌附近。
 * 說法虛構（content/flavour/quests.ts），東西與地名是資料。做完給旅費；不碰網站的去過、抽獎券、成就。
 * 做不完也不會卡住：接下之後 QUEST_DAYS 天（遊戲日曆）沒做完就自己取消，也可以回去跟委託的人說「不做了」。
 */
export const ACTIVE_MAX = 3
/** 接下之後幾天內要做完（遊戲規則；手帳寫期限） */
export const QUEST_DAYS = 3
export const REWARD: Record<QuestType, number> = { deliver: 800, photo: 600, lost: 400 }
const NIGHT_BONUS = 200

/** 委託可以用的東西：帶得走的地區特色、老舖的和菓子與茶 */
export function deliverables(pref: string, data: DataIndex): string[] {
  const p = data.pref(pref)
  const sp = (p?.specialties ?? []).filter((s) => TAKEAWAY.has(s.category)).map((s) => itemKey({ kind: 'specialty', id: s.id }))
  const sh = (p?.shinise ?? [])
    .map((s) => {
      const w = shiniseWhat(s)
      return w && w !== 'incense' ? itemKey({ kind: 'shinise', id: `${s.id}#${w}` }) : null
    })
    .filter((x): x is string => !!x)
  return [...sp, ...sh]
}

export interface QuestEnv {
  data: DataIndex
  /** 鎮裡放了告示牌與拍攝點的景點（world 的 questSpotsOf；沒給就用分數前 8 個） */
  townSpots?(town: string): readonly string[]
}

/** 期限（接下的日期＋QUEST_DAYS 天；那一天的晚上還算） */
export function questUntil(q: Pick<Quest, 'd'>): CalendarDate | null {
  const d = parseDayKey(q.d)
  return d ? addDays(d, QUEST_DAYS) : null
}

/** 拿掉一個進行中的委託（不做了、過了期限、做不完）：送的東西也收回去 */
export function drop(game: Game, id: string): Quest | null {
  const book = systemsOf(game).quests
  const i = book.active.findIndex((x) => x.id === id)
  if (i < 0) return null
  const [q] = book.active.splice(i, 1)
  if (game.state.items[questKey(q!)]) {
    delete game.state.items[questKey(q!)]
    game.changed('items')
  }
  game.changed('flags')
  return q!
}

/**
 * 整理進行中的委託：過了期限的（還沒做好的）取消；地點不在地圖上的（生成規則改了、舊存檔）也取消。
 * 回傳拿掉的。
 */
export function pruneQuests(game: Game, env: QuestEnv, today: CalendarDate = game.clock.date): Quest[] {
  const book = systemsOf(game).quests
  const out: Quest[] = []
  const t = dayKey(today)
  for (const q of [...book.active]) {
    const until = questUntil(q)
    const late = !!until && !q.ready && dayKey(until) < t
    let gone = false
    if (env.townSpots && q.spot) {
      const town = env.data.town(q.from)
      const towns = q.type === 'lost' ? [q.from] : env.data.allTowns().filter((x) => x.pref === town?.pref).map((x) => x.id)
      gone = !towns.some((x) => env.townSpots!(x).includes(q.spot!))
    }
    if (late || gone) {
      const d = drop(game, q.id)
      if (d) out.push(d)
    }
  }
  return out
}

const spotsIn = (env: QuestEnv, town: string) => [...(env.townSpots?.(town) ?? env.data.town(town)?.spots ?? env.data.spotsOfTown(town).slice(0, 8).map((s) => s.id))]

/** 這個人今天的委託（同一個人同一天每次一樣；做不出來回 null） */
export function questFor(giver: string, town: string, date: CalendarDate, env: QuestEnv): Quest | null {
  const { data } = env
  const t = data.town(town)
  if (!t) return null
  const d = dayKey(date)
  const r = rng(seedOf('quest', d, town, giver))
  const id = `${d}:${town}:${giver}`
  const others = data
    .allTowns()
    .filter((x) => x.pref === t.pref && x.id !== town)
    .map((x) => x.id)
  const items = deliverables(t.pref, data)
  const here = spotsIn(env, town)
  const prefSpots = [town, ...others].flatMap((x) => spotsIn(env, x))
  const types: QuestType[] = []
  if (others.length && items.length) types.push('deliver', 'deliver')
  if (prefSpots.length) types.push('photo', 'photo')
  if (here.length) types.push('lost')
  if (!types.length) return null
  const type = r.pick(types)
  if (type === 'deliver') return { id, type, from: town, giver, to: r.pick(others), item: r.pick(items), reward: REWARD.deliver, d }
  if (type === 'photo') {
    const night = r.chance(0.3)
    return { id, type, from: town, giver, spot: r.pick(prefSpots), when: night ? 'night' : undefined, reward: REWARD.photo + (night ? NIGHT_BONUS : 0), d }
  }
  return { id, type, from: town, giver, spot: r.pick(here), thing: r.pick(LOST_THINGS).id, reward: REWARD.lost, d }
}

export function linesOf(q: Quest): QuestLines {
  return q.type === 'photo' ? (q.when === 'night' ? QUEST_LINES.photoNight : QUEST_LINES.photo) : QUEST_LINES[q.type]
}

/** 委託的參數：{item}、{town}、{spot}、{thing} */
export function questParams(q: Quest, data: DataIndex): Record<string, string> {
  const p: Record<string, string> = {}
  if (q.item) p.item = itemCard(q.item, data)?.name.ja ?? ''
  if (q.to) p.town = data.town(q.to)?.name.ja ?? ''
  const s = data.spot(q.spot)
  if (s) p.spot = spotName(s).ja
  if (q.thing) p.thing = LOST_THINGS.find((x) => x.id === q.thing)?.zh ?? ''
  return p
}

export function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '')
}

/** 手帳「委託」的一行字 */
export function questText(q: Quest, data: DataIndex): string {
  return fill(linesOf(q).ask, questParams(q, data))
}

export const questKey = (q: Quest) => `quest:${q.id}`

/** 接下委託：deliver 的東西放進行李 */
export function accept(game: Game, q: Quest): boolean {
  const book = systemsOf(game).quests
  if (book.active.length >= ACTIVE_MAX || book.active.some((x) => x.id === q.id) || book.done.includes(q.id)) return false
  book.active.push({ ...q, d: dayKey(game.clock.date) })
  if (q.type === 'deliver') {
    game.state.items[questKey(q)] = 1
    game.changed('items')
  }
  game.changed('flags')
  return true
}

/** 做完：拿掉、記下、給旅費 */
export function complete(game: Game, id: string): Quest | null {
  const book = systemsOf(game).quests
  const i = book.active.findIndex((x) => x.id === id)
  if (i < 0) return null
  const [q] = book.active.splice(i, 1)
  book.done.push(q!.id)
  book.done = book.done.slice(-DONE_MAX)
  if (game.state.items[questKey(q!)]) {
    delete game.state.items[questKey(q!)]
    game.changed('items')
  }
  game.state.money += q!.reward
  game.changed('money')
  return q!
}

export const activeOf = (game: Game, giver: string, town: string) => systemsOf(game).quests.active.find((q) => q.giver === giver && q.from === town) ?? null
export const isDone = (game: Game, id: string) => systemsOf(game).quests.done.includes(id)

/** 讀了一個告示牌：符合的 lost 委託找到東西 */
export function noteSign(game: Game, spotId: string | undefined): Quest | null {
  if (!spotId) return null
  const q = systemsOf(game).quests.active.find((x) => x.type === 'lost' && x.spot === spotId && !x.ready)
  if (!q) return null
  q.ready = true
  game.changed('flags')
  return q
}

/** 在 town 跟路人說話：有要送到這一鎮的東西就交出去 */
export const deliveryFor = (game: Game, town: string) => systemsOf(game).quests.active.find((q) => q.type === 'deliver' && q.to === town) ?? null

/** 委託的東西的名字（手帳用） */
export function questItemName(q: Quest, data: DataIndex): string | null {
  if (q.item) return itemCard(q.item, data)?.name.ja ?? null
  if (q.thing) return LOST_THINGS.find((x) => x.id === q.thing)?.zh ?? null
  return null
}

