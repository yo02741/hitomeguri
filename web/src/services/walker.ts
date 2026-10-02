import { ref, watch } from 'vue'

/** 散步的旅人開關（DESIGN.md §7.24）：存在這台裝置，預設開 */
const KEY = 'hitomeguri:walker'
function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}
export const walkerOn = ref(read())
watch(walkerOn, (on) => {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // 存不了就只在這次
  }
})
