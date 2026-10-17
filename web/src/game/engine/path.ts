import { type Dir, DIRS } from './types'

/**
 * A*（走格子）：點畫面上的格子時旅人自己走過去。neighbor 回傳從 (x, y) 往 d 走會落在哪
 * （一般一格；台階跳過去是兩格；走不了回 null）。目標可以是好幾格（走到 NPC 旁邊任何一格都行）。
 * 回傳每一步的方向；走不到回 null；已經在目標上回 []。
 */
export interface Cell {
  x: number
  y: number
}

export function findPath(
  start: Cell,
  goals: Cell[],
  neighbor: (x: number, y: number, d: Dir) => Cell | null,
  opts: { w: number; h: number; maxNodes?: number },
): Dir[] | null {
  if (!goals.length) return null
  const { w, h } = opts
  const key = (x: number, y: number) => y * w + x
  const goalSet = new Set(goals.filter((g) => g.x >= 0 && g.y >= 0 && g.x < w && g.y < h).map((g) => key(g.x, g.y)))
  if (goalSet.has(key(start.x, start.y))) return []
  if (!goalSet.size) return null
  const hEst = (x: number, y: number) => {
    let best = Infinity
    for (const g of goals) best = Math.min(best, Math.abs(g.x - x) + Math.abs(g.y - y))
    return best
  }
  const n = w * h
  const gScore = new Float64Array(n).fill(Infinity)
  const came = new Int32Array(n).fill(-1)
  const cameDir = new Int8Array(n).fill(-1)
  const closed = new Uint8Array(n)
  const heap = new MinHeap()
  const s = key(start.x, start.y)
  gScore[s] = 0
  heap.push(s, hEst(start.x, start.y))
  const max = opts.maxNodes ?? 6000
  let seen = 0
  while (heap.size) {
    const cur = heap.pop()
    if (closed[cur]) continue
    closed[cur] = 1
    if (goalSet.has(cur)) return rebuild(cur, came, cameDir)
    if (++seen > max) return null
    const cx = cur % w
    const cy = (cur - cx) / w
    for (let di = 0; di < DIRS.length; di++) {
      const nb = neighbor(cx, cy, DIRS[di]!)
      if (!nb || nb.x < 0 || nb.y < 0 || nb.x >= w || nb.y >= h) continue
      const k = key(nb.x, nb.y)
      if (closed[k]) continue
      const cost = gScore[cur]! + Math.abs(nb.x - cx) + Math.abs(nb.y - cy)
      if (cost < gScore[k]!) {
        gScore[k] = cost
        came[k] = cur
        cameDir[k] = di
        // 同分時偏好直走（少轉彎）：轉彎加一點點
        const turn = cameDir[cur] !== -1 && cameDir[cur] !== di ? 0.001 : 0
        heap.push(k, cost + turn + hEst(nb.x, nb.y))
      }
    }
  }
  return null
}

function rebuild(end: number, came: Int32Array, cameDir: Int8Array): Dir[] {
  const out: Dir[] = []
  let k = end
  while (came[k]! !== -1) {
    out.push(DIRS[cameDir[k]!]!)
    k = came[k]!
  }
  return out.reverse()
}

/** 二元堆積（小的先出） */
class MinHeap {
  private readonly keys: number[] = []
  private readonly pri: number[] = []
  get size() {
    return this.keys.length
  }
  push(k: number, p: number) {
    const ks = this.keys
    const ps = this.pri
    let i = ks.length
    ks.push(k)
    ps.push(p)
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (ps[parent]! <= p) break
      ks[i] = ks[parent]!
      ps[i] = ps[parent]!
      i = parent
    }
    ks[i] = k
    ps[i] = p
  }
  pop(): number {
    const ks = this.keys
    const ps = this.pri
    const top = ks[0]!
    const k = ks.pop()!
    const p = ps.pop()!
    if (ks.length) {
      let i = 0
      const n = ks.length
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        let mp = p
        if (l < n && ps[l]! < mp) {
          m = l
          mp = ps[l]!
        }
        if (r < n && ps[r]! < mp) {
          m = r
          mp = ps[r]!
        }
        if (m === i) break
        ks[i] = ks[m]!
        ps[i] = ps[m]!
        i = m
      }
      ks[i] = k
      ps[i] = p
    }
    return top
  }
}
