import { onBeforeUnmount, onMounted, ref } from 'vue'

/** 目前有沒有網路（瀏覽器的 online / offline 事件） */
export function useOnline() {
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
  const set = () => (online.value = navigator.onLine)
  onMounted(() => {
    window.addEventListener('online', set)
    window.addEventListener('offline', set)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', set)
    window.removeEventListener('offline', set)
  })
  return online
}
