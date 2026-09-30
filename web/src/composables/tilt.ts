import { computed, onBeforeUnmount, reactive } from 'vue'

/**
 * 收集卡的 3D 傾斜（DESIGN.md §7.19）：滑鼠或手機傾斜角度 → CSS 變數，驅動卡片旋轉、反光與箔片位置。
 * - --rx、--ry：卡片繞 X、Y 軸的角度（deg）
 * - --mx、--my：光源在卡面的位置（%）
 * - --hyp：光源離中心的距離（0～1），越斜箔片越亮
 * - --o：效果強度（0＝靜止，1＝正在互動）
 * 用簡單的彈簧（每格往目標靠近一段）讓動作順，不抖。系統設定減少動態時不動。
 */
export function useTilt(max = 14) {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const cur = reactive({ rx: 0, ry: 0, mx: 50, my: 50, o: 0 })
  const target = { rx: 0, ry: 0, mx: 50, my: 50, o: 0 }
  let frame = 0

  function step() {
    frame = 0
    let moving = false
    for (const k of ['rx', 'ry', 'mx', 'my', 'o'] as const) {
      const d = target[k] - cur[k]
      if (Math.abs(d) > 0.01) {
        cur[k] += d * 0.14
        moving = true
      } else cur[k] = target[k]
    }
    if (moving) frame = requestAnimationFrame(step)
  }
  function kick() {
    if (!frame) frame = requestAnimationFrame(step)
  }

  /** 以卡面上的相對位置（0～1）設定目標 */
  function aim(px: number, py: number) {
    const x = Math.min(1, Math.max(0, px))
    const y = Math.min(1, Math.max(0, py))
    target.ry = (x - 0.5) * 2 * max
    target.rx = -(y - 0.5) * 2 * max
    target.mx = x * 100
    target.my = y * 100
    target.o = 1
    kick()
  }

  function onPointerMove(e: PointerEvent) {
    if (reduced || e.pointerType === 'touch') return
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    aim((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
  }
  function reset() {
    target.rx = 0
    target.ry = 0
    target.mx = 50
    target.my = 50
    target.o = 0
    kick()
  }

  // 手機傾斜：beta 前後、gamma 左右；以開始時的角度為基準
  let base: { beta: number; gamma: number } | null = null
  function onOrientation(e: DeviceOrientationEvent) {
    if (e.beta == null || e.gamma == null) return
    base ??= { beta: e.beta, gamma: e.gamma }
    const range = 30
    aim(0.5 + (e.gamma - base.gamma) / (2 * range), 0.5 + (e.beta - base.beta) / (2 * range))
  }
  let listening = false
  /** 開始用手機傾斜驅動；iOS 需要使用者點一下授權。回傳是否成功 */
  async function useGyro(): Promise<boolean> {
    if (reduced || listening || typeof DeviceOrientationEvent === 'undefined') return false
    const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission
    if (req) {
      try {
        if ((await req()) !== 'granted') return false
      } catch {
        return false
      }
    }
    base = null
    window.addEventListener('deviceorientation', onOrientation)
    listening = true
    return true
  }
  function stopGyro() {
    if (!listening) return
    window.removeEventListener('deviceorientation', onOrientation)
    listening = false
    reset()
  }
  onBeforeUnmount(() => {
    stopGyro()
    if (frame) cancelAnimationFrame(frame)
  })

  const style = computed(() => ({
    '--rx': `${cur.rx.toFixed(2)}deg`,
    '--ry': `${cur.ry.toFixed(2)}deg`,
    '--mx': `${cur.mx.toFixed(1)}%`,
    '--my': `${cur.my.toFixed(1)}%`,
    '--hyp': Math.min(1, Math.hypot(cur.mx - 50, cur.my - 50) / 50).toFixed(3),
    '--o': cur.o.toFixed(3),
  }))

  return { style, onPointerMove, reset, useGyro, stopGyro, reduced }
}
