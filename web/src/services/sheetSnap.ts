/**
 * 手機景點卡片（bottom sheet）的三段高度（DESIGN.md §7.13、決定事項 C3）：
 * 收合（名稱帶＋去過）／半開 55vh／全開。拖把手或名稱帶，放開時吸附到最近的一段；
 * 甩得夠快時往甩的方向換一段；從收合再往下拉（或往下甩）就關閉。
 */
export type Snap = 'peek' | 'half' | 'full'

export const SNAPS: readonly Snap[] = ['peek', 'half', 'full']

export type SnapHeights = Record<Snap, number>

/** 甩的速度門檻（px/ms）：超過就往甩的方向換一段，不看放開的位置 */
export const FLICK = 0.5
/** 比收合再低這麼多（px）放開就關閉 */
export const CLOSE_BELOW = 48

/** 依地圖區高度、海報條高度、名稱帶高度算出三段的 px（半開不超過海報條以下的地圖區減 2.5rem） */
export function snapHeights(area: number, poster: number, head: number, viewport: number): SnapHeights {
  const full = Math.max(0, Math.round(area))
  const half = Math.max(0, Math.min(Math.round(viewport * 0.55), full - poster - 40))
  const peek = Math.min(Math.round(head || 120), half)
  return { peek, half, full }
}

/**
 * 放開時的段：height 是放開時的高度，velocity 是高度變化的速度（px/ms，往上長為正）。
 * 回傳 null 表示關閉。
 */
export function snapAfterDrag(h: SnapHeights, height: number, velocity: number): Snap | null {
  if (velocity >= FLICK) return SNAPS.find((s) => h[s] > height + 8) ?? 'full'
  if (velocity <= -FLICK) {
    const lower = [...SNAPS].reverse().find((s) => h[s] < height - 8)
    return lower ?? null
  }
  if (height < h.peek - CLOSE_BELOW) return null
  let best: Snap = 'peek'
  for (const s of SNAPS) if (Math.abs(h[s] - height) < Math.abs(h[best] - height)) best = s
  return best
}

/** 放開前停了超過這麼久（ms）就不算甩 */
export const FLICK_STALE = 80

/**
 * 放開時的速度（px/ms，往上長為正）：取最近 100ms 內的取樣；
 * 最後一次移動離放開超過 FLICK_STALE（拖到一半停住才放）就是 0，照放開的位置吸附。
 */
export function releaseVelocity(samples: readonly { t: number; h: number }[], now: number): number {
  const last = samples[samples.length - 1]
  if (!last || now - last.t > FLICK_STALE) return 0
  const recent = samples.filter((s) => last.t - s.t <= 100)
  const first = recent[0]!
  return last.t > first.t ? (last.h - first.h) / (last.t - first.t) : 0
}

/** 鍵盤、點把手：往上或往下一段（到頭就停）；dir 0 依序輪替（收合 → 半開 → 全開 → 收合） */
export function stepSnap(s: Snap, dir: -1 | 0 | 1): Snap {
  const i = SNAPS.indexOf(s)
  if (dir === 0) return SNAPS[(i + 1) % SNAPS.length]!
  return SNAPS[Math.min(SNAPS.length - 1, Math.max(0, i + dir))]!
}
