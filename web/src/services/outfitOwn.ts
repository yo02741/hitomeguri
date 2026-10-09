import type { AchvStatus } from './achievements'
import type { Outfit, Slot } from '../data/outfits'

// 旅人的服裝哪些是「由紀錄算出來的」（DESIGN.md §7.24）：各縣的代表單品（去過那個縣）與成就服裝（達成那個成就）。
// 不另外存；取消去過、刪掉旅行讓縣或成就拿掉時跟著拿掉，標回去就回來。純函式，stores/avatar.ts 包成 computed。

export interface OwnInput {
  visitedPrefs: ReadonlySet<string>
  /** 成就現在的狀態；沒有的當 unknown */
  achv: (id: string) => AchvStatus | undefined
}

/** 由紀錄送的服裝（不含抽到的） */
export function derivedOwned(outfits: readonly Outfit[], i: OwnInput): string[] {
  return outfits
    .filter((o) => (o.gift && o.pref ? i.visitedPrefs.has(o.pref) : o.achv ? i.achv(o.achv) === 'done' : false))
    .map((o) => o.id)
}

/** 扭蛋抽得到的：不限縣的，加上去過的縣的其他單品；代表單品與成就服裝不進扭蛋 */
export function gachaPool(outfits: readonly Outfit[], visitedPrefs: ReadonlySet<string>): Outfit[] {
  return outfits.filter((o) => !o.gift && !o.achv && (!o.pref || visitedPrefs.has(o.pref)))
}

/**
 * 實際穿在身上的：穿著的由紀錄送的服裝確定拿掉了（縣沒去過、成就沒達成）就不畫，位置空著（衣服換回預設）。
 * 穿著的紀錄不改：標回去、成就回來時照樣穿上。
 * 還不確定時照畫（ready=false：去過的紀錄還沒和伺服器對過；成就 unknown：achievements.json 還沒到），不會一閃一閃。
 */
export function wornOf(
  equipped: Partial<Record<Slot, string>>,
  byId: ReadonlyMap<string, Outfit>,
  i: OwnInput & { ready: boolean; fallback: Partial<Record<Slot, string>> },
): Partial<Record<Slot, string>> {
  if (!i.ready) return equipped
  const out: Partial<Record<Slot, string>> = {}
  for (const [slot, id] of Object.entries(equipped) as Array<[Slot, string]>) {
    const o = byId.get(id)
    const lost = o ? (o.gift && o.pref ? !i.visitedPrefs.has(o.pref) : o.achv ? i.achv(o.achv) === 'locked' : false) : false
    if (!lost) out[slot] = id
    else if (i.fallback[slot]) out[slot] = i.fallback[slot]
  }
  return out
}
