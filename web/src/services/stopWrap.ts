// 分享圖（旅行回顧，services/shareImage.ts）每天的地點換行；不碰 DOM，測試直接跑

/** 地點用「 → 」接起來，超過 max 寬時換行（新的一行以「→ 」開頭）；單一地點太長時照字切 */
export function wrapStops(names: string[], max: number, width: (t: string) => number): string[] {
  const lines: string[] = []
  let cur = ''
  const push = (t: string) => {
    // 一行放不下的長名稱：照字切
    let rest = t
    while (width(rest) > max && rest.length > 1) {
      let n = rest.length - 1
      while (n > 1 && width(rest.slice(0, n)) > max) n--
      lines.push(rest.slice(0, n))
      rest = rest.slice(n)
    }
    return rest
  }
  names.forEach((name, i) => {
    const piece = i === 0 ? name : ` → ${name}`
    if (cur && width(cur + piece) > max) {
      lines.push(cur)
      cur = push(`→ ${name}`)
    } else {
      cur = push(cur + piece)
    }
  })
  if (cur) lines.push(cur)
  return lines
}
