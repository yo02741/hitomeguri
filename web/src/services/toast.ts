import { shallowRef } from 'vue'

/**
 * 底部一行的提示（AppUpdate.vue 顯示，DESIGN.md §7.26）：可以復原的移除（取消收藏、取消去過、從清單移除、
 * 從行程移除）做完就出現「已取消收藏」＋「復原」，約 6 秒後收起。一次只有一則，新的取代舊的
 * （舊的就不能再復原，和按了「去過」再點一次一樣，資料本身沒有遺失）。
 * 游標停在上面或焦點在「復原」時不倒數，離開後重新算。
 */
export interface Toast {
  id: number
  text: string
  undo?: () => unknown
}

export const TOAST_MS = 6000

export const toast = shallowRef<Toast | null>(null)
let seq = 0
let timer: number | undefined

function arm() {
  window.clearTimeout(timer)
  const id = toast.value?.id
  timer = window.setTimeout(() => {
    if (toast.value?.id === id) toast.value = null
  }, TOAST_MS)
}

export function showToast(text: string, undo?: () => unknown) {
  toast.value = { id: ++seq, text, undo }
  arm()
}

export function dismissToast() {
  window.clearTimeout(timer)
  toast.value = null
}

/** 停住倒數（hover、focus） */
export function holdToast() {
  window.clearTimeout(timer)
}

/** 重新倒數 */
export function releaseToast() {
  if (toast.value) arm()
}

/** 按「復原」：先收起，再做復原 */
export function undoToast() {
  const t = toast.value
  dismissToast()
  void t?.undo?.()
}
