import { ref } from 'vue'

/**
 * 觸控裝置上正在輸入文字（螢幕鍵盤開著）：底部分頁列先收起，不蓋住輸入框（DESIGN.md §5.2）。
 * 聚焦到可以打字的欄位時為 true；離開後稍等一下再放回，換到下一個欄位時分頁列不會閃一下。
 * 輸入框在鍵盤把畫面縮小之後捲進可見範圍（viewport 設 interactive-widget=resizes-content，index.html）。
 */
export const typing = ref(false)

const NON_TEXT = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])

function isTextField(el: EventTarget | null): el is HTMLElement {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) return !NON_TEXT.has(el.type) && !el.readOnly && !el.disabled
  return el instanceof HTMLElement && el.isContentEditable
}

if (typeof window !== 'undefined') {
  const coarse = window.matchMedia('(pointer: coarse)')
  let leaveTimer = 0
  let revealTimer = 0
  document.addEventListener('focusin', (e) => {
    if (!coarse.matches || !isTextField(e.target)) return
    const el = e.target
    clearTimeout(leaveTimer)
    typing.value = true
    // 鍵盤升起、分頁列收起之後畫面高度才定下來
    clearTimeout(revealTimer)
    revealTimer = window.setTimeout(() => {
      if (document.activeElement === el) el.scrollIntoView({ block: 'nearest' })
    }, 300)
  })
  document.addEventListener('focusout', (e) => {
    if (!typing.value) return
    if (isTextField(e.relatedTarget)) return
    clearTimeout(leaveTimer)
    leaveTimer = window.setTimeout(() => {
      if (!isTextField(document.activeElement)) typing.value = false
    }, 120)
  })

  // Android 用返回鍵收起鍵盤時欄位不會失焦：畫面高度縮過又長回來，就當成鍵盤收起了；再點一次欄位時收回分頁列。
  const vv = window.visualViewport
  if (vv) {
    let tall = vv.height
    let shrunk = false
    vv.addEventListener('resize', () => {
      if (!typing.value) {
        tall = Math.max(tall, vv.height)
        return
      }
      if (vv.height < tall - 120) shrunk = true
      else if (shrunk) {
        shrunk = false
        typing.value = false
      }
    })
    window.addEventListener('orientationchange', () => {
      tall = 0
      shrunk = false
    })
    document.addEventListener('pointerdown', (e) => {
      if (coarse.matches && !typing.value && e.target === document.activeElement && isTextField(e.target)) typing.value = true
    })
  }
}
