// 共編的修改紀錄（trips/{id}/log/{auto}）：成員改了行程時記一筆「誰、做了什麼」，
// 行程頁列出上次看過之後旅伴改了什麼，開著頁面時旅伴一改就跳提示。只在有兩個以上成員的行程記。

export type LogKind = 'add' | 'move' | 'remove' | 'order' | 'rename' | 'dates' | 'days' | 'stay' | 'addMany'

/** 寫入的內容（by、at 由寫入時補） */
export interface LogEntry {
  kind: LogKind
  /** 地點名、新的行程名稱、住的車站 */
  name?: string
  /** 天的索引（-1 待排） */
  day?: number
  /** 天數、一次加入的地點數 */
  n?: number
}

export interface LogItem extends LogEntry {
  id: string
  by: string
  /** 毫秒 */
  at: number
}

export const LOG_KINDS: LogKind[] = ['add', 'move', 'remove', 'order', 'rename', 'dates', 'days', 'stay', 'addMany']
export const LOG_NAME_MAX = 80

/** 中文字和 DAY 之間留空格：「加到 DAY 2」「加到待排」「DAY 2 的順序」 */
const isDay = (d: number | undefined): d is number => d !== undefined && d >= 0
const toDay = (d: number | undefined) => (isDay(d) ? ` DAY ${d + 1}` : '待排')
const ofDay = (d: number | undefined) => (isDay(d) ? ` DAY ${d + 1} ` : '待排')

/** 一筆紀錄的說明（不含是誰） */
export function logText(e: LogEntry): string {
  const name = e.name ?? ''
  switch (e.kind) {
    case 'add':
      return `把 ${name} 加到${toDay(e.day)}`
    case 'move':
      return `把 ${name} 移到${toDay(e.day)}`
    case 'remove':
      return `把 ${name} 從行程移除`
    case 'order':
      return `調整了${ofDay(e.day)}的順序`
    case 'rename':
      return name ? `把行程名稱改成「${name}」` : '清掉了行程名稱'
    case 'dates':
      return '改了日期'
    case 'days':
      return `把天數改成 ${e.n ?? 0} 天`
    case 'stay':
      return name ? `把${ofDay(e.day)}住的車站改成 ${name}` : `清掉了${ofDay(e.day)}住的車站`
    case 'addMany':
      return `加了 ${e.n ?? 0} 個地方`
  }
}

/** 寫進 Firestore 的欄位：沒有值的不寫，名稱截到上限 */
export function logFields(e: LogEntry): Record<string, string | number> {
  const out: Record<string, string | number> = { kind: e.kind }
  if (e.name !== undefined) out.name = e.name.slice(0, LOG_NAME_MAX)
  if (e.day !== undefined) out.day = e.day
  if (e.n !== undefined) out.n = e.n
  return out
}

/** Firestore 讀回來的一筆；欄位不對就略過 */
export function parseLog(id: string, x: Record<string, unknown>): LogItem | null {
  const kind = x.kind as LogKind
  if (!LOG_KINDS.includes(kind) || typeof x.by !== 'string') return null
  const at = (x.at as { toMillis?: () => number } | null)?.toMillis?.() ?? 0
  const out: LogItem = { id, kind, by: x.by, at }
  if (typeof x.name === 'string') out.name = x.name
  if (typeof x.day === 'number') out.day = x.day
  if (typeof x.n === 'number') out.n = x.n
  return out
}

/**
 * 同一個人連續的同一種修改合併成一行（拖了好幾次順序、連加幾個地點）：
 * 「調整了 DAY 2 的順序」只留最新一筆；其他的照原樣。輸入新的在前。
 */
export function collapseLog(items: LogItem[]): LogItem[] {
  const out: LogItem[] = []
  for (const it of items) {
    const prev = out[out.length - 1]
    if (prev && prev.by === it.by && it.kind === 'order' && prev.kind === 'order' && prev.day === it.day) continue
    out.push(it)
  }
  return out
}

const SEEN_KEY = (tripId: string) => `trip-log-seen:${tripId}`

/** 這台裝置上次看過這個行程的修改紀錄的時間；沒有記錄時為 null */
export function readSeen(tripId: string): number | null {
  try {
    const v = Number(localStorage.getItem(SEEN_KEY(tripId)))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

export function writeSeen(tripId: string, at: number) {
  try {
    localStorage.setItem(SEEN_KEY(tripId), String(at))
  } catch {
    // 私密瀏覽等：下次照樣從現在算起
  }
}
