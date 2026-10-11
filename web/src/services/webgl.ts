/** 這台裝置能不能畫 WebGL（3D 旅人，DESIGN.md §7.24a）：建一個不放進頁面的 canvas 試一次，結果記住 */
let cached: boolean | null = null
export function canWebGL(): boolean {
  if (cached !== null) return cached
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    cached = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}
