import { ref, watch } from 'vue'

/**
 * 去過的蓋章動畫（DESIGN.md §9）：只在自己按下「去過」、狀態真的變成去過時播放一次；
 * 換景點、其他裝置同步過來的變化不播。arm() 在按下時呼叫，key 變了就換新元素讓動畫重播。
 */
export function useStampPress(on: () => boolean, id: () => string) {
  const pressing = ref(false)
  const key = ref(0)
  let armed: string | null = null
  let timer = 0
  function arm() {
    armed = on() ? null : id()
  }
  watch(on, (v) => {
    if (!v || armed !== id()) return
    armed = null
    key.value++
    pressing.value = true
    clearTimeout(timer)
    timer = window.setTimeout(() => (pressing.value = false), 800)
  })
  return { pressing, key, arm }
}
