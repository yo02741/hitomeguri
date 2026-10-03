/**
 * 點在空白處時，找附近 max px 內最近的目標（經縣值地圖：觸控時點到海上，選最近的縣；手機版計畫第二階段 19）。
 * 由近到遠一圈一圈找：每 step px 一圈，圈上每隔約 step px 取一點，回傳最內圈第一個找到的。
 * hit(x, y) 回傳那一點的目標（例如 document.elementFromPoint 找到的縣），沒有就是 null。
 */
export function nearestHit<T>(x: number, y: number, hit: (x: number, y: number) => T | null, max = 20, step = 2): T | null {
  for (let r = step; r <= max; r += step) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / step))
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI
      const t = hit(x + r * Math.cos(a), y + r * Math.sin(a))
      if (t != null) return t
    }
  }
  return null
}
