import { onBeforeUnmount, ref, watch } from 'vue'

import { DraftField, type DraftFieldOptions, isImeEnter } from '../services/draftField'

/**
 * 原地編輯的文字欄（services/draftField.ts）：回傳 value 與事件，模板用 :value＋事件綁定，不用 v-model。
 * 打字停下來 debounceMs 後先存一次（共編的人看得到），離開欄位、Enter 時再存；組字中不存、不改欄位的值。
 * save 回傳 false 表示不能存（例：離線），草稿回到最新的值。
 */
export function useDraftField(
  source: () => string,
  save: (v: string) => boolean | void,
  opts: DraftFieldOptions & { debounceMs?: number } = {},
) {
  const field = new DraftField(source(), opts)
  const value = ref(field.draft)
  const sync = () => (value.value = field.draft)
  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  watch(source, (v) => {
    if (field.receive(v)) sync()
  })

  function commit(v: string | null) {
    if (v !== null && save(v) === false) {
      field.blur(false)
      sync()
    }
  }
  function schedule() {
    clear()
    timer = setTimeout(() => {
      timer = undefined
      commit(field.flush())
    }, opts.debounceMs ?? 800)
  }

  function onFocus() {
    field.focus()
  }
  function onInput(e: Event) {
    const el = e.target as HTMLInputElement
    field.input(el.value)
    sync()
    // 組字中（注音、假名還沒選字）不排存檔
    if (!field.composing && !(e as InputEvent).isComposing) schedule()
  }
  function onCompositionStart() {
    clear()
    field.compositionStart()
  }
  function onCompositionEnd(e: CompositionEvent) {
    field.compositionEnd((e.target as HTMLInputElement).value)
    sync()
    schedule()
  }
  function onBlur() {
    clear()
    // 先問能不能存（離線時不送出，放棄草稿）
    const v = field.blur(true)
    sync()
    commit(v)
  }
  function onKeydown(e: KeyboardEvent) {
    if (isImeEnter(e)) return
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
    else if (e.key === 'Escape') {
      clear()
      field.revert()
      sync()
      ;(e.target as HTMLInputElement).blur()
    }
  }

  onBeforeUnmount(() => {
    clear()
    // 換頁時還沒存的字照樣存（不等 blur）
    if (field.editing) commit(field.flush())
  })

  return { value, onFocus, onInput, onCompositionStart, onCompositionEnd, onBlur, onKeydown }
}
