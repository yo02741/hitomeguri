import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

/**
 * 原生 <dialog> 的對話框（DESIGN.md §9）：掛上時 showModal()，背後的頁面 inert、Tab 只在框裡繞；
 * 卸下前先 close()，焦點回到打開前的按鈕（v-if 直接拿掉元素時瀏覽器不會歸還焦點）。
 * Esc 走 cancel：擋下瀏覽器自己關，交給 onCancel（例：十連抽先收起放大）。
 * 瀏覽器不讓擋的那次 Esc（連按、中間沒有點擊）會直接關掉，這時 close 事件呼叫 onClosed。
 * 元件的 <dialog> 寫 ref="dlg"，@cancel="cancel"、@close="closed"。
 */
export function useModal(onCancel: () => void, onClosed: () => void = onCancel) {
  const dlg = useTemplateRef<HTMLDialogElement>('dlg')
  let unmounting = false
  onMounted(() => {
    const d = dlg.value
    if (d && !d.open) d.showModal()
  })
  onBeforeUnmount(() => {
    unmounting = true
    if (dlg.value?.open) dlg.value.close()
  })
  return {
    cancel(e: Event) {
      e.preventDefault()
      onCancel()
    },
    closed() {
      if (!unmounting) onClosed()
    },
  }
}
