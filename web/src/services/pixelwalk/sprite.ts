import type { Px } from './palette'

/**
 * 像素 sprite：用字元畫的點陣（一行一列），`map` 把字元對到調色盤的名字；`.` 和空白是透明。
 * 前後的空行、共同的縮排會拿掉，所以可以直接在程式裡縮排著寫：
 *   sprite(`
 *     ..kk..
 *     .kwwk.
 *   `, { k: 'ink', w: 'white' })
 */
export interface Sprite {
  w: number
  h: number
  /** 用到的顏色；idx 是 1 起算的索引（0 是透明） */
  keys: Px[]
  idx: Uint8Array
}

export function sprite(art: string, map: Record<string, Px>): Sprite {
  let rows = art.split('\n')
  while (rows.length && !rows[0]!.trim()) rows.shift()
  while (rows.length && !rows[rows.length - 1]!.trim()) rows.pop()
  const indent = Math.min(...rows.filter((r) => r.trim()).map((r) => r.match(/^ */)![0].length))
  rows = rows.map((r) => r.slice(indent).replace(/\s+$/, ''))
  const w = Math.max(...rows.map((r) => r.length))
  const h = rows.length
  const keys: Px[] = []
  const slot = new Map<string, number>()
  const idx = new Uint8Array(w * h)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!
      if (ch === '.' || ch === ' ') continue
      const key = map[ch]
      if (!key) throw new Error(`pixelwalk sprite：字元「${ch}」沒有對到顏色`)
      let i = slot.get(ch)
      if (i === undefined) {
        keys.push(key)
        i = keys.length
        slot.set(ch, i)
      }
      idx[y * w + x] = i
    }
  })
  return { w, h, keys, idx }
}

/** 同一組對照表的好幾格（動畫） */
export const frames = (arts: string[], map: Record<string, Px>): Sprite[] => arts.map((a) => sprite(a, map))

/** 換掉某些顏色（同一隻貓的三花、黑貓…） */
export function recolor(s: Sprite, swap: Partial<Record<Px, Px>>): Sprite {
  return { ...s, keys: s.keys.map((k) => swap[k] ?? k) }
}
