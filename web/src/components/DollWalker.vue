<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { giftOf } from '../data/outfits'
import { AREA_ZH, regionOf } from '../data/regions'
import { daysUntil, tripStatus } from '../services/trip'
import { useAchievementsStore } from '../stores/achievements'
import { useAvatarStore } from '../stores/avatar'
import { useFreshStore } from '../stores/fresh'
import { useTripsStore } from '../stores/trips'
import { useWalletStore } from '../stores/wallet'
import PaperDoll from './PaperDoll.vue'

// 散步的旅人（DESIGN.md §7.24）：登入後在畫面下緣走來走去，偶爾跳一下、轉一圈、鞠躬，或說一句話。
// 說的話都來自自己的資料：下一趟出發倒數、目前地圖的縣、抽獎券、還沒看過的新衣服與新卡、新的成就、差一兩縣的地方。
// 點它會說一句話。帳號選單可以關（存在這台裝置）；旅人頁、列印時不出現；減少動態時站著不動。
// App.vue 只在登入且開著時非同步掛上：沒登入的人不下載紙娃娃與服裝，也沒有計時器與換頁的監聽。
const avatar = useAvatarStore()
const wallet = useWalletStore()
const achv = useAchievementsStore()
const fresh = useFreshStore()
const trips = useTripsStore()
const route = useRoute()

const visible = computed(() => route.name !== 'avatar')
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const SIZE = 64
const x = ref(16)
const facing = ref<1 | -1>(1)
type Act = 'idle' | 'walk' | 'jump' | 'spin' | 'bow'
const act = ref<Act>('idle')
const walkMs = ref(0)
const say = ref<string | null>(null)
const actKey = ref(0)
// 讀屏器只在點了旅人之後讀出它說的話；自己說話時不打斷
const heard = ref('')

let timer = 0
let sayTimer = 0
// 視窗寬度記在變數裡、resize 時更新：換頁的 watcher 裡讀 window.innerWidth 會在 Vue 更新途中強制排版
let vw = typeof window !== 'undefined' ? window.innerWidth : 0
// 桌機的探索頁（首頁、地區地圖）：左邊是浮動的清單（300px），旅人只在清單右邊走
const PANEL_ROUTES = ['home', 'explore', 'map']
const minX = () => (PANEL_ROUTES.includes(String(route.name)) && vw >= 1024 ? 340 : 16)
const maxX = () => Math.max(minX(), vw - SIZE - 16)

function lines(): string[] {
  const out: string[] = []
  const h = new Date().getHours()
  if (h >= 5 && h < 10) out.push('早安')
  else if (h >= 23 || h < 4) out.push('該睡了')
  const pref = typeof route.params.pref === 'string' ? route.params.pref : undefined
  const region = pref ? regionOf(pref) : undefined
  if (pref && region) {
    out.push(avatar.visitedPrefs.has(pref) ? `${region.name.ja}，去過了` : `想去${region.name.ja}`)
    const g = giftOf(pref)
    if (g && !avatar.has(g.id)) out.push(`去${region.name.ja}可以拿到${g.name}`)
  }
  const next = trips.sorted
    .filter((t) => tripStatus(t, trips.today) === 'planning')
    .map((t) => [t, daysUntil(t, trips.today)] as const)
    .filter((p): p is [(typeof p)[0], number] => p[1] !== null)
    .sort((a, b) => a[1] - b[1])[0]
  if (next) out.push(next[1] === 0 ? `今天出發去「${next[0].name}」` : `「${next[0].name}」再 ${next[1]} 天出發`)
  if (wallet.left > 0) out.push(`抽獎券還有 ${wallet.left} 張`)
  const keys = [...fresh.keys]
  // 只算現在還有的衣服：成就服裝在成就失去後收回，留下的 NEW 在衣櫃裡看不到也清不掉
  if (keys.some((k) => k.startsWith('o:') && avatar.has(k.slice(2)))) out.push('有新衣服還沒穿')
  if (keys.some((k) => k.startsWith('c:'))) out.push('收集冊有新的卡')
  if (achv.hasNew) out.push('有新的成就')
  const near = achv.nearestArea
  if (near) out.push(`${AREA_ZH[near.area]}還差${near.missing.map((r) => r.name.zh_tw).join('、')}`)
  if (avatar.visitedPrefs.size) out.push(`去過 ${avatar.visitedPrefs.size} 個縣了`)
  if (!out.length) out.push('下一趟去哪裡')
  return out
}

function speak(text?: string) {
  const list = lines()
  say.value = text ?? list[Math.floor(Math.random() * list.length)]!
  clearTimeout(sayTimer)
  sayTimer = window.setTimeout(() => (say.value = null), 4200)
}
function doAct(a: Exclude<Act, 'walk' | 'idle'>) {
  act.value = a
  actKey.value++
  window.setTimeout(() => {
    if (act.value === a) act.value = 'idle'
  }, 900)
}
function walk() {
  const to = Math.min(maxX(), Math.max(minX(), x.value + (Math.random() < 0.5 ? -1 : 1) * (80 + Math.random() * 260)))
  const dx = to - x.value
  if (Math.abs(dx) < 20) return
  facing.value = dx < 0 ? -1 : 1
  walkMs.value = (Math.abs(dx) / 42) * 1000
  act.value = 'walk'
  x.value = to
  window.setTimeout(() => {
    if (act.value === 'walk') act.value = 'idle'
  }, walkMs.value)
}
function tick() {
  if (visible.value && !reduced && !document.hidden) {
    const r = Math.random()
    if (r < 0.45) walk()
    else if (r < 0.55) doAct('jump')
    else if (r < 0.63) doAct('spin')
    else if (r < 0.7) doAct('bow')
    else if (r < 0.82) speak()
  }
  timer = window.setTimeout(tick, (act.value === 'walk' ? walkMs.value : 0) + 3500 + Math.random() * 4500)
}
function onClick() {
  speak()
  heard.value = say.value ?? ''
  if (!reduced) doAct('jump')
}
function clamp() {
  const v = Math.min(maxX(), Math.max(minX(), x.value))
  if (v !== x.value) {
    walkMs.value = 0
    act.value = 'idle'
    x.value = v
  }
}
function onResize() {
  vw = window.innerWidth
  clamp()
}
onMounted(() => {
  x.value = minX() + Math.random() * Math.min(240, maxX() - minX())
  timer = window.setTimeout(tick, 2500)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  clearTimeout(sayTimer)
  window.removeEventListener('resize', onResize)
})
// 換頁時回到可以走的範圍；到了某個縣的地圖偶爾說一句
watch(() => route.name, clamp)
watch(
  () => route.params.pref,
  (p) => {
    if (p && visible.value && Math.random() < 0.6) window.setTimeout(() => speak(), 900)
  },
)
const bubbleRight = computed(() => x.value > maxX() - 150)
</script>

<template>
  <div
    v-if="visible"
    class="walker pointer-events-none fixed left-0 z-[15] print:hidden"
    :style="{ transform: `translateX(${x}px)`, transitionDuration: `${act === 'walk' ? walkMs : 0}ms` }"
  >
    <p
      v-if="say"
      :key="say"
      class="bubble absolute bottom-full mb-1.5 w-max max-w-[200px] rounded-card bg-paper px-3 py-2 text-caption font-bold text-ink shadow-float"
      :class="bubbleRight ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'"
      aria-hidden="true"
    >
      {{ say }}
    </p>
    <p class="sr-only" aria-live="polite">{{ heard }}</p>
    <button type="button" class="pointer-events-auto block" :aria-label="say ? `旅人：${say}` : '旅人'" @click="onClick">
      <span :key="actKey" class="body block" :class="`act-${act}`" :style="{ '--face': facing }">
        <PaperDoll :parts="avatar.parts" :equipped="avatar.worn" class="block h-auto w-16" />
      </span>
    </button>
  </div>
</template>

<style scoped>
/* 手機在分頁列上方，桌機貼著下緣 */
.walker {
  bottom: calc(3.5rem + env(safe-area-inset-bottom) + 4px);
  transition-property: transform;
  transition-timing-function: linear;
}
@media (min-width: 1024px) {
  .walker {
    bottom: 8px;
  }
}
.body {
  transform: scaleX(var(--face));
  transform-origin: 50% 100%;
}
/* 走路：紙娃娃一跳一跳 */
.act-walk {
  animation: hop 0.36s ease-in-out infinite;
}
@keyframes hop {
  0%,
  100% {
    transform: scaleX(var(--face)) translateY(0) rotate(-3deg);
  }
  50% {
    transform: scaleX(var(--face)) translateY(-5px) rotate(3deg);
  }
}
.act-jump {
  animation: jump 0.6s cubic-bezier(0.3, 0.7, 0.4, 1);
}
@keyframes jump {
  40% {
    transform: scaleX(var(--face)) translateY(-18px);
  }
  70% {
    transform: scaleX(var(--face)) translateY(0) scaleY(0.94);
  }
}
/* 轉一圈：紙翻面 */
.act-spin {
  animation: spin 0.8s ease-in-out;
}
@keyframes spin {
  to {
    transform: scaleX(var(--face)) rotateY(360deg);
  }
}
/* 鞠躬 */
.act-bow {
  animation: bow 0.9s ease-in-out;
}
@keyframes bow {
  40%,
  60% {
    transform: scaleX(var(--face)) rotate(14deg);
  }
}
.bubble {
  animation: pop 0.25s var(--ease-stamp) both;
}
@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.9);
  }
}
@media (prefers-reduced-motion: reduce) {
  .act-walk,
  .act-jump,
  .act-spin,
  .act-bow,
  .bubble {
    animation: none;
  }
}
</style>
