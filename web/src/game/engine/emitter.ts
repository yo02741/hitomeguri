/**
 * 小小的事件：on 回傳取消訂閱的函式。一個聽的人丟錯不影響其他人（開發時印出來）。
 */
export class Emitter<E extends object> {
  private readonly subs = new Map<keyof E, Set<(e: never) => void>>()

  on<K extends keyof E>(name: K, fn: (e: E[K]) => void): () => void {
    let set = this.subs.get(name)
    if (!set) {
      set = new Set()
      this.subs.set(name, set)
    }
    set.add(fn as (e: never) => void)
    return () => set.delete(fn as (e: never) => void)
  }

  /** 有沒有人在聽（say、ask 沒人聽的時候直接往下，測試與無頭模式用） */
  has(name: keyof E): boolean {
    return (this.subs.get(name)?.size ?? 0) > 0
  }

  emit<K extends keyof E>(name: K, e: E[K]) {
    const set = this.subs.get(name)
    if (!set) return
    for (const fn of [...set]) {
      try {
        ;(fn as (e: E[K]) => void)(e)
      } catch (err) {
        if (import.meta.env?.DEV) console.warn(`game：${String(name)} 的處理丟錯`, err)
      }
    }
  }
}
