import { PRICE } from '../content/items'
import { QUEST_LINES, QUEST_MISC, type FlavourWho } from '../content/flavour'
import type { ScriptApi } from '../engine/script'
import type { MapEntity, Script, ScriptFn } from '../engine/types'

import { dayKey, nameOf, type PlaceName, spotName } from './data'
import type { GameSystems } from './install'
import { accept, ACTIVE_MAX, activeOf, complete, deliveryFor, drop, fill, isDone, linesOf, noteSign, questFor, questParams, REWARD } from './quests'
import { slotIndex } from './room'
import { sit, stockOf } from './shop'
import { hasStamp, pressStamp, stampView } from './stamps'
import { systemsOf } from './state'
import { summaryLine } from './summary'
import { dataOf, type InnData, type NpcData, type ShopData, type SignData, type SlotData, type StampData, type TravelData } from './types'

/**
 * 地圖上的東西被查看（A）時跑的腳本（規格 §8.4–§8.7、§11）。
 * 介面的字照 §6a：短、像車站標示；虛構的台詞從 content/flavour 拿，事實從 content/facts 的樣板（附出處）。
 */

/** 一句閒聊（沒有就不說） */
function* chat(api: ScriptApi, sys: GameSystems, who: FlavourWho, key: string, label?: string): Script {
  const t = sys.flavour(who, key)
  if (t) yield* api.say(t, { who: label })
}

/** 地名：日文（念法）＋下一行中文 */
export function titleText(n: PlaceName): string {
  const kana = n.kana && n.kana !== n.ja ? `（${n.kana}）` : ''
  return `${n.ja}${kana}${n.zh && n.zh !== n.ja ? `\n${n.zh}` : ''}`
}

const SHOP_WHO: Record<ShopData['shopKind'], FlavourWho> = { station: 'station', shinise: 'shinise', shokudo: 'shokudo', teahouse: 'shinise' }

// ---------- 告示牌 ----------
export function sign(sys: GameSystems, e: MapEntity): ScriptFn | null {
  const d = dataOf<SignData>(e)
  const spot = sys.data.spot(d.spotId)
  const fest = sys.data.festival(d.festivalId)
  const shop = sys.data.shop(d.shiniseId)
  if (!spot && !fest && !shop && !d.title?.ja) return null
  return function* (api) {
    const g = sys.game
    g.state.seen.add(e.id)
    const title: PlaceName = d.title?.ja ? { ...d.title } : spot ? spotName(spot) : fest ? nameOf(fest.name) : { ja: shop!.n, kana: shop!.h }
    yield* api.say(titleText(title))
    // 老舖：有創業年（附出處）才說
    if (shop) {
      const f = sys.fact('shinise.founded', { kind: 'shinise', id: shop.id })
      if (f) {
        yield* api.say(f.text, { source: f.source })
        sys.hear({ k: 'fact', id: 'shinise.founded', ref: { kind: 'shinise', id: shop.id } })
      }
    }
    if (fest) {
      const f = sys.fact('festival.month', { kind: 'festival', id: fest.id })
      if (f) {
        yield* api.say(f.text, { source: f.source })
        sys.hear({ k: 'fact', id: 'festival.month', ref: { kind: 'festival', id: fest.id } })
      }
    }
    const sum = summaryLine(d.summary ?? spot?.summary ?? fest?.summary)
    if (sum) {
      yield* api.say(sum.text, { source: sum.source })
      if (spot) sys.hear({ k: 'sign', id: `spot:${spot.id}` })
      else if (fest) sys.hear({ k: 'sign', id: `festival:${fest.id}` })
    }
    // 委託「找回掉的東西」：掉在這個告示牌附近
    const q = noteSign(g, spot?.id ?? d.spotId)
    if (q) {
      yield* api.sfx('item')
      yield* api.say(fill(QUEST_MISC.found, questParams(q, sys.data)))
    }
  }
}

// ---------- 路人 ----------
export function npc(sys: GameSystems, e: MapEntity): ScriptFn | null {
  const d = dataOf<NpcData>(e)
  switch (d.role) {
    case 'fact':
      return factNpc(sys, e, d)
    case 'passer':
      return passer(sys, e)
    case 'quest':
      return questNpc(sys, e)
    case 'clerk':
      return clerk(sys, e, d)
    case 'festival':
      return festivalNpc(sys, e, d)
    case 'inn':
      return (api) => innFlow(sys, api, innOf(sys, e), sys.whoOf(e))
    default:
      return null
  }
}

function factNpc(sys: GameSystems, e: MapEntity, d: Partial<NpcData>): ScriptFn {
  return function* (api) {
    const who = sys.whoOf(e)
    if (d.fact?.template && d.fact.ref) {
      const f = sys.fact(d.fact.template, d.fact.ref, d.fact.params ?? {}, d.fact.source)
      if (f) {
        yield* api.say(f.text, { who, source: f.source })
        sys.hear({ k: 'fact', id: d.fact.template, ref: d.fact.ref, p: d.fact.params, s: d.fact.source })
        return
      }
    }
    // 沒有出處的事不說：改成閒聊
    yield* chat(api, sys, 'passer', e.id, who)
  }
}

function passer(sys: GameSystems, e: MapEntity): ScriptFn {
  return function* (api) {
    const who = sys.whoOf(e)
    const g = sys.game
    const town = sys.townHere()?.id
    const q = town ? deliveryFor(g, town) : null
    if (q) {
      const p = questParams(q, sys.data)
      yield* api.say(QUEST_MISC.receive, { who })
      const i = yield* api.ask(`把${p.item}交給他嗎？`, ['交給他', '不要'], { cancel: 1 })
      if (i !== 0) return
      yield* api.say(fill(QUEST_LINES.deliver.done, p), { who })
      yield* reward(sys, api, q.id, who)
      return
    }
    yield* chat(api, sys, 'passer', e.id, who)
  }
}

/** 領旅費：一句、收下、存檔 */
function* reward(sys: GameSystems, api: ScriptApi, id: string, who: string): Script {
  yield* api.say(QUEST_MISC.reward, { who })
  const q = complete(sys.game, id)
  if (!q) return
  // 委託的照片：沒放進相簿、沒別的地方用就收掉
  if (q.type === 'photo' && typeof q.ready === 'string') sys.releasePhoto(q.ready)
  yield* api.sfx('item')
  yield* api.say(`拿到 ${q.reward.toLocaleString('ja-JP')} 文。`)
  sys.game.save()
  sys.refresh()
}

function questNpc(sys: GameSystems, e: MapEntity): ScriptFn {
  return function* (api) {
    const who = sys.whoOf(e)
    const g = sys.game
    const town = sys.townHere()?.id
    if (!town) return yield* chat(api, sys, 'passer', e.id, who)
    const act = activeOf(g, e.id, town)
    if (act) {
      const p = questParams(act, sys.data)
      const L = linesOf(act)
      if (act.type !== 'deliver' && act.ready) {
        yield* api.say(fill(L.done, p), { who })
        yield* reward(sys, api, act.id, who)
        return
      }
      // 還沒做完：繼續，或不做了（名額空出來）
      const keep = act.type === 'photo' ? QUEST_MISC.keepPhoto : act.type === 'deliver' ? QUEST_MISC.keepDeliver : QUEST_MISC.keep
      const i = yield* api.ask(fill(L.remind, p), [keep, QUEST_MISC.quit], { who, cancel: 0 })
      if (i === 1) {
        drop(g, act.id)
        yield* api.say(QUEST_MISC.quitDone, { who })
        g.save()
        sys.refresh()
      }
      return
    }
    const q = questFor(e.id, town, g.clock.date, { data: sys.data, townSpots: sys.deps.townSpots })
    if (!q) return yield* chat(api, sys, 'passer', e.id, who)
    if (isDone(g, q.id)) return yield* api.say(QUEST_MISC.rest, { who })
    if (systemsOf(g).quests.active.length >= ACTIVE_MAX) return yield* api.say(QUEST_MISC.busy, { who })
    const p = questParams(q, sys.data)
    const L = linesOf(q)
    const i = yield* api.ask(fill(L.ask, p), [QUEST_MISC.yes, QUEST_MISC.no], { who, cancel: 1 })
    if (i !== 0) return yield* api.say(QUEST_MISC.decline, { who })
    accept(g, q)
    yield* api.say(fill(L.accept, p), { who })
    if (q.type === 'deliver') {
      yield* api.sfx('item')
      yield* api.say(`收下了${p.item}。`)
    }
    g.save()
    sys.refresh()
  }
}

/** 委託指令 photoRequest：請玩家拍某個地標 */
export function requestPhoto(sys: GameSystems, giver: string, spotId: string, night: boolean): boolean {
  const g = sys.game
  const town = sys.townHere()?.id
  if (!town || !sys.data.spot(spotId)) return false
  const d = dayKey(g.clock.date)
  return accept(g, { id: `${d}:${town}:${giver}`, type: 'photo', from: town, giver, spot: spotId, when: night ? 'night' : undefined, reward: REWARD.photo, d })
}

function clerk(sys: GameSystems, e: MapEntity, d: Partial<NpcData>): ScriptFn {
  return function* (api) {
    const map = sys.game.map
    const shopE = map?.entities.find((x) => x.kind === 'shop' && (d.shop ? x.id === d.shop : true))
    const who = sys.whoOf(e)
    if (!shopE) return yield* chat(api, sys, 'station', e.id, who)
    const sd = dataOf<ShopData>(shopE)
    yield* chat(api, sys, SHOP_WHO[sd.shopKind ?? 'station'], e.id, who)
    yield* shopFlow(sys, api, shopE)
  }
}

function festivalNpc(sys: GameSystems, e: MapEntity, d: Partial<NpcData>): ScriptFn {
  return function* (api) {
    const who = sys.whoOf(e)
    const ref = d.fact?.ref ?? (d.festivalId ? { kind: 'festival', id: d.festivalId } : null)
    const template = d.fact?.template ?? 'festival.month'
    const f = ref ? sys.fact(template, ref, d.fact?.params ?? {}, d.fact?.source) : null
    if (f && ref) {
      yield* api.say(f.text, { who, source: f.source })
      sys.hear({ k: 'fact', id: template, ref })
    }
    yield* chat(api, sys, 'festival', e.id, who)
  }
}

// ---------- 店 ----------
export function shop(sys: GameSystems, e: MapEntity): ScriptFn | null {
  if (!dataOf<ShopData>(e).shopKind) return null
  return (api) => shopFlow(sys, api, e)
}

function* shopFlow(sys: GameSystems, api: ScriptApi, e: MapEntity): Script {
  const g = sys.game
  const sd = dataOf<ShopData>(e) as ShopData
  const pref = sys.townHere()?.pref ?? sys.data.prefs[0]?.pref ?? 'kyoto'
  const stock = stockOf({ ...sd, id: e.id }, pref, g.clock.date, sys.data)
  // 老舖有創業年（附出處）：記進「聽來的」
  const sh = sys.data.shop(sd.shiniseId)
  if (sh?.f && sys.fact('shinise.founded', { kind: 'shinise', id: sh.id })) sys.hear({ k: 'fact', id: 'shinise.founded', ref: { kind: 'shinise', id: sh.id } })
  if (!stock.entries.length && !stock.sit) return
  const r = yield* sys.waitPanel({ kind: 'shop', id: e.id, stock, pref, mode: sd.shopKind === 'shokudo' ? 'eat' : 'buy' })
  if (r === 'sit') yield* sitFlow(sys, api, e.id, stock.sit ?? PRICE.sit)
}

/** 茶屋：坐下來喝一杯（時間往前、一句閒聊） */
function* sitFlow(sys: GameSystems, api: ScriptApi, key: string, price: number): Script {
  const g = sys.game
  if (g.state.money < price) {
    yield* api.sfx('error')
    yield* api.say('旅費不夠。')
    return
  }
  yield* api.fade('out')
  sit(g, price)
  yield* api.wait(0.5)
  yield* api.fade('in')
  yield* chat(api, sys, 'teahouse', key)
  g.save()
}

// ---------- 印 ----------
export function stamp(sys: GameSystems, e: MapEntity): ScriptFn | null {
  if (!dataOf<StampData>(e).stampId) return null
  return function* (api) {
    yield* stampFlow(sys, api, e)
  }
}

const STAMP_WORD: Record<StampData['stampKind'], string> = { station: '站章', sanpai: '參拜印', castle: '章' }

export function* stampFlow(sys: GameSystems, api: ScriptApi, e: MapEntity): Script<boolean> {
  const g = sys.game
  const d = dataOf<StampData>(e) as StampData
  if (!d.stampId || !d.stampKind) return false
  const view = stampView(d, sys.data)
  // 名城：蓋章地點（資料的 st）是事實，附出處
  if (d.stampKind === 'castle') {
    const id = d.castleId ?? sys.data.castleOfSpot(d.spotId ?? '')?.id
    const f = id ? sys.fact('castle.stamp', { kind: 'castle', id }) : null
    if (f && id) {
      yield* api.say(f.text, { source: f.source })
      sys.hear({ k: 'fact', id: 'castle.stamp', ref: { kind: 'castle', id } })
    }
  }
  const label = d.stampKind === 'station' ? `${view.name.ja}站` : view.name.ja
  if (hasStamp(g, d.stampId)) {
    yield* api.say(`${label}的${STAMP_WORD[d.stampKind]}，已經蓋過了。`)
    return false
  }
  const i = yield* api.ask(`${label}的${STAMP_WORD[d.stampKind]}。要蓋嗎？`, ['蓋', '不蓋'], { cancel: 1 })
  if (i !== 0) return false
  pressStamp(g, d, sys.townHere()?.id)
  g.save()
  sys.sfx('stamp')
  sys.jingle('stamp')
  yield* sys.waitPanel({ kind: 'stamp', view: { ...view, date: { ...g.clock.date } } })
  return true
}

// ---------- 目的地 ----------
export function travel(sys: GameSystems, e: MapEntity): ScriptFn | null {
  const d = dataOf<TravelData>(e) as TravelData
  if (!d.dests?.length) return null
  return function* (api) {
    const r = yield* sys.waitPanel({ kind: 'travel', data: d })
    if (!r || typeof r !== 'object') return
    if (sys.deps.travel) sys.deps.travel(sys.game, r)
    else {
      yield* api.sfx('error')
      yield* api.say('這一班還沒有開。')
    }
  }
}

// ---------- 旅館、房間 ----------
function innOf(sys: GameSystems, e: MapEntity): InnData {
  const own = dataOf<InnData>(e)
  if (own.name) return { innKind: own.innKind ?? 'ryokan', name: own.name }
  const other = sys.game.map?.entities.find((x) => x.kind === 'inn')
  const d = other ? dataOf<InnData>(other) : {}
  return { innKind: d.innKind ?? (sys.region() === 'okinawa' ? 'minshuku' : 'ryokan'), name: d.name ?? sys.game.map?.name.ja ?? '' }
}

export function inn(sys: GameSystems, e: MapEntity): ScriptFn | null {
  return (api) => innFlow(sys, api, innOf(sys, e), sys.region() === 'okinawa' ? '民宿的人' : '旅館的人')
}

const KEY = 'game:room-key'

function* innFlow(sys: GameSystems, api: ScriptApi, d: InnData, who: string): Script {
  const g = sys.game
  if (!g.state.items[KEY]) {
    yield* api.say('這是房間的鑰匙。', { who })
    yield* api.give(KEY, 1)
    yield* api.sfx('item')
    yield* api.say('拿到了房間鑰匙。')
  }
  if (d.name) systemsOf(g).inn = d.name
  yield* chat(api, sys, 'inn', `${d.name}:inn`, who)
  const i = yield* api.ask('要做什麼？', ['住一晚', '進房間', '不用了'], { who, cancel: 2 })
  if (i === 0) yield* sleepFlow(sys, api)
  else if (i === 1 && !sys.enterRoom()) yield* api.say('房間還在整理。', { who })
}

/** 睡一晚：淡出、隔天早上 7 點、存檔、淡入 */
export function* sleepFlow(sys: GameSystems, api: ScriptApi): Script {
  const g = sys.game
  yield* api.fade('out')
  g.clock.nextMorning(7)
  yield* api.wait(0.8)
  g.save()
  yield* api.fade('in')
  yield* chat(api, sys, 'inn', 'morning')
}

export function desk(sys: GameSystems): ScriptFn {
  return function* () {
    yield* sys.waitPanel({ kind: 'book' })
  }
}

export function room(sys: GameSystems, e: MapEntity, area: 'shelf' | 'frame'): ScriptFn {
  return function* () {
    const i = slotIndex(dataOf<SlotData>(e), area)
    yield* sys.waitPanel({ kind: 'room', focus: i === null ? null : { area, i } })
    sys.refreshRoom()
    sys.game.save()
  }
}

/** 出房間：回到進來的地方 */
export function leaveRoom(sys: GameSystems): ScriptFn | null {
  const p = sys.exitPlace()
  if (!p) return null
  return function* (api) {
    yield* api.sfx('door')
    yield* api.fade('out')
    yield* api.warp(p.map, p.x, p.y, p.dir)
    yield* api.fade('in')
  }
}
