/**
 * 伴奏、低音的小幫手：和弦進行 → tracker 字串（結果還是一般的 tracker 格式）。
 * plan 一小節一個字，空白分開；`Am|E` 是前半小節 Am、後半小節 E。
 * shapes 給每個和弦一小節（full）與半小節（half）的音型，例 `{ Am: { full: 'A2 - - E3 - - A2 -', half: 'A2 - E3 -' } }`。
 */
export interface Shape {
  full: string
  half: string
}

export function chordTrack(plan: string, shapes: Record<string, Shape>): string {
  const pick = (name: string, part: keyof Shape) => {
    const s = shapes[name]
    if (!s) throw new Error(`和弦「${name}」沒有音型`)
    return s[part]
  }
  return plan
    .split(/\s+/)
    .filter(Boolean)
    .map((bar) => {
      const [a, b] = bar.split('|')
      return b ? `${pick(a!, 'half')} ${pick(b, 'half')}` : pick(a!, 'full')
    })
    .join(' | ')
}

/** 同一段重複幾次（中間放小節線） */
export const repeat = (bars: string, n: number) => Array.from({ length: n }, () => bars).join(' | ')

/** 休止 n 格 */
export const rest = (n: number) => Array.from({ length: n }, () => '.').join(' ')
