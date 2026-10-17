import { registerLook } from '../engine/looks'
import type { ActorLook } from '../engine/types'

import { personLook, type PersonStyle } from './person'
import { shibaLook } from './shiba'

/**
 * P0 的手畫角色：預設旅人（妹妹頭、藍帽、白 T、相機）、小柴犬、十二種路人、店員。
 * 註冊成 look id：traveler、shiba、folk-a…folk-l（folk.ts 的 FOLK_IDS）、clerk（地圖的 NPC 用 data.look 指）。
 */
export const TRAVELER_STYLE: PersonStyle = {
  skin: 'skin-1',
  hair: 'hair',
  hairStyle: 'bob',
  top: 'white',
  topShade: 'stone-1',
  bottom: 'roof-2',
  legs: 'skin-1',
  shoes: 'wood-3',
  hat: { kind: 'bucket', color: 'cloth-1', shade: 'cloth-2' },
  camera: true,
}

export const FOLK_STYLES: Record<string, PersonStyle> = {
  // 年紀大一點的人：白髮、棕色外套
  'folk-a': { skin: 'skin-2', hair: 'stone-1', hairStyle: 'short', top: 'wood-2', topShade: 'wood-3', bottom: 'roof-2', legs: 'roof-3', shoes: 'ink-2' },
  // 長髮、粉色上衣
  'folk-b': { skin: 'skin-1', hair: 'wood-3', hairStyle: 'long', top: 'sakura-2', topShade: 'shu-2', bottom: 'roof-1', legs: 'skin-1', shoes: 'paper-2' },
  // 小孩：黃帽子、綠衣服
  'folk-c': { skin: 'skin-1', hair: 'hair', hairStyle: 'short', top: 'leaf-2', topShade: 'leaf-3', bottom: 'sea-3', legs: 'skin-1', shoes: 'shu-2', hat: { kind: 'cap', color: 'gold-1', shade: 'gold-2' } },
  // 綁髮髻、紫色上衣
  'folk-d': { skin: 'skin-2', hair: 'ink-2', hairStyle: 'bun', top: 'lavender', topShade: 'cloth-2', bottom: 'stone-3', legs: 'stone-4', shoes: 'wood-3' },
  // 灰髮、深藍外套
  'folk-e': { skin: 'skin-2', hair: 'stone-2', hairStyle: 'short', top: 'roof-2', topShade: 'roof-3', bottom: 'stone-3', legs: 'stone-4', shoes: 'ink-2' },
  // 黑色妹妹頭、朱色上衣
  'folk-f': { skin: 'skin-1', hair: 'ink-2', hairStyle: 'bob', top: 'shu-1', topShade: 'shu-2', bottom: 'stone-4', legs: 'skin-1', shoes: 'ink-2' },
  // 長髮、藍色上衣、米色帽子
  'folk-g': { skin: 'skin-1', hair: 'hair', hairStyle: 'long', top: 'sea-2', topShade: 'sea-3', bottom: 'paper-2', legs: 'skin-1', shoes: 'wood-3', hat: { kind: 'bucket', color: 'paper', shade: 'paper-2' } },
  // 白髮的髮髻、淺藍上衣
  'folk-h': { skin: 'skin-2', hair: 'stone-1', hairStyle: 'bun', top: 'cloth-1', topShade: 'cloth-2', bottom: 'roof-3', legs: 'roof-3', shoes: 'wood-3' },
  // 短髮、黃上衣、紅帽子
  'folk-i': { skin: 'skin-2', hair: 'wood-3', hairStyle: 'short', top: 'gold-1', topShade: 'gold-2', bottom: 'roof-2', legs: 'roof-3', shoes: 'paper-2', hat: { kind: 'cap', color: 'shu-2', shade: 'shu-3' } },
  // 棕色妹妹頭、淺綠上衣
  'folk-j': { skin: 'skin-1', hair: 'wood-2', hairStyle: 'bob', top: 'leaf-1', topShade: 'leaf-2', bottom: 'stone-3', legs: 'skin-1', shoes: 'shu-2' },
  // 黑長髮、白上衣、沙色帽子
  'folk-k': { skin: 'skin-1', hair: 'ink-2', hairStyle: 'long', top: 'white', topShade: 'stone-1', bottom: 'cloth-2', legs: 'skin-1', shoes: 'ink-2', hat: { kind: 'bucket', color: 'sand-1', shade: 'sand-2' } },
  // 短髮、紅葉色外套
  'folk-l': { skin: 'skin-2', hair: 'hair', hairStyle: 'short', top: 'momiji-1', topShade: 'momiji-2', bottom: 'dirt-2', legs: 'dirt-2', shoes: 'ink-2' },
  // 店員：頭巾、白衣、深藍圍裙
  clerk: { skin: 'skin-1', hair: 'hair', hairStyle: 'short', top: 'white', topShade: 'stone-1', bottom: 'roof-2', legs: 'roof-3', shoes: 'ink-2', hat: { kind: 'scarf', color: 'white', shade: 'stone-1' }, apron: 'cloth-2' },
}

let done = false
const made = new Map<string, ActorLook>()

/** 註冊全部（第一次叫的時候才畫） */
export function registerDefaultLooks() {
  if (done) return
  done = true
  const add = (id: string, look: ActorLook) => {
    made.set(id, look)
    registerLook(id, look)
  }
  add('traveler', personLook(TRAVELER_STYLE))
  add('shiba', shibaLook())
  for (const [id, st] of Object.entries(FOLK_STYLES)) add(id, personLook(st))
}

export const defaultLook = (id: string) => {
  registerDefaultLooks()
  return made.get(id)!
}
