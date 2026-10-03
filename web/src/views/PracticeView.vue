<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'

import BackLink from '../components/BackLink.vue'
import SpeakButton from '../components/SpeakButton.vue'
import { usePrep } from '../composables/prep'
import type { Card } from '../services/prep'
import { speakJa } from '../services/tts'
import { ensureSignedIn, firestore } from '../services/userdb'
import { useUserStore } from '../stores/user'

// 練習（UX-FLOW.md D3）：Leitner box。卡片 1–5 箱，「記得」往上一箱、「再練一次」回第 1 箱；
// 每輪從低箱開始出 20 張。進度存 users/{uid}/trips/{tripId}/progress/{卡片 id}。
const props = defineProps<{ id: string }>()
const userStore = useUserStore()
const { trip, prefs, deck, loading } = usePrep(() => props.id)

const ROUND = 20
const boxes = ref<Record<string, number>>({})
const progressLoaded = ref(false)

watch(
  () => [userStore.user?.uid, props.id] as const,
  async ([uid, tripId]) => {
    progressLoaded.value = false
    boxes.value = {}
    if (!uid) return
    const { fs, db } = await firestore()
    const snap = await fs.getDocs(fs.collection(db, 'users', uid, 'trips', tripId, 'progress'))
    const next: Record<string, number> = {}
    snap.forEach((d) => (next[d.id] = Number(d.data().box) || 1))
    boxes.value = next
    progressLoaded.value = true
  },
  { immediate: true },
)

const box = (c: Card) => boxes.value[c.id] ?? 1
const counts = computed(() => {
  const out = [0, 0, 0, 0, 0]
  for (const c of deck.value) out[box(c) - 1]! += 1
  return out
})
const mastered = computed(() => counts.value[4] ?? 0)

// 一輪：低箱優先、同箱必備優先，箱內打散
const queue = shallowRef<Card[]>([])
const index = ref(0)
const flipped = ref(false)
const listenMode = ref(false)
function shuffle<T>(a: T[]): T[] {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}
function newRound() {
  const sorted = shuffle(deck.value).sort((a, b) => box(a) - box(b) || a.priority - b.priority)
  queue.value = sorted.slice(0, ROUND)
  index.value = 0
  flipped.value = false
  if (listenMode.value && queue.value[0]) speakJa(queue.value[0].speak)
}
watch(
  () => deck.value.length > 0 && progressLoaded.value,
  (ready) => {
    if (ready && !queue.value.length) newRound()
  },
  { immediate: true },
)

const card = computed(() => queue.value[index.value])
const done = computed(() => queue.value.length > 0 && index.value >= queue.value.length)

async function answer(remembered: boolean) {
  const c = card.value
  if (!c) return
  const next = remembered ? Math.min(box(c) + 1, 5) : 1
  boxes.value = { ...boxes.value, [c.id]: next }
  index.value += 1
  flipped.value = false
  if (listenMode.value && card.value) speakJa(card.value.speak)
  const uid = await ensureSignedIn(userStore)
  if (!uid) return
  try {
    const { fs, db } = await firestore()
    await fs.setDoc(fs.doc(db, 'users', uid, 'trips', props.id, 'progress', c.id), { box: next, updated_at: fs.serverTimestamp() })
  } catch (e) {
    console.error(e)
  }
}

function onKey(e: KeyboardEvent) {
  if (!card.value) return
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    flipped.value = !flipped.value
  } else if (flipped.value && e.key === 'ArrowRight') void answer(true)
  else if (flipped.value && e.key === 'ArrowLeft') void answer(false)
}
</script>

<template>
  <div v-if="trip" :data-pref="prefs[0]" class="flex min-h-full flex-col bg-surface" tabindex="-1" @keydown="onKey">
    <div class="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-6 py-6">
      <div class="flex items-center gap-3">
        <BackLink :to="`/trips/${trip.id}/prep`">旅前準備</BackLink>
        <label class="ml-auto flex cursor-pointer items-center gap-2 text-label text-ink pointer-coarse:min-h-tap">
          <input v-model="listenMode" type="checkbox" class="size-4 accent-(--region-strong)" />
          聽音
        </label>
      </div>

      <!-- 各箱的卡片數 -->
      <div class="flex flex-col gap-1.5">
        <div class="flex h-2 overflow-hidden rounded-full bg-placeholder" aria-hidden="true">
          <span
            v-for="(n, i) in counts"
            :key="i"
            class="h-full bg-region-strong"
            :style="{ flexGrow: n, opacity: 0.25 + i * 0.1875 }"
          ></span>
        </div>
        <span class="text-caption text-sub">熟練 <span class="font-latin">{{ mastered }}</span> ／ <span class="font-latin">{{ deck.length }}</span></span>
      </div>

      <div v-if="loading || !progressLoaded" class="skeleton h-[280px] rounded-card" aria-busy="true"><span class="sr-only">載入中</span></div>

      <template v-else-if="card">
        <div class="flex items-center justify-between text-caption text-sub">
          <span class="font-latin">{{ index + 1 }} / {{ queue.length }}</span>
          <span>第 <span class="font-latin">{{ box(card) }}</span> 箱</span>
        </div>
        <button
          type="button"
          class="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-card border border-line bg-paper px-6 py-8 text-center shadow-float"
          :aria-label="flipped ? '翻回正面' : '翻面'"
          @click="flipped = !flipped"
        >
          <template v-if="!flipped">
            <svg v-if="listenMode" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-sub" aria-hidden="true">
              <path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
            <span v-else lang="ja" class="text-h2 font-black tracking-name">{{ card.ja }}</span>
          </template>
          <template v-else>
            <span v-if="card.kana" lang="ja" class="text-body tracking-kana text-sub">{{ card.kana }}</span>
            <span lang="ja" class="text-h2 font-black tracking-name">{{ card.ja }}</span>
            <span v-if="card.romaji" class="font-latin text-body-sm text-sub">{{ card.romaji }}</span>
            <span v-if="card.zh" class="text-body text-ink">{{ card.zh }}</span>
            <span v-if="card.note" class="text-body-sm text-ink-2">{{ card.note }}</span>
          </template>
        </button>
        <div class="flex items-center justify-center">
          <SpeakButton :text="card.speak" :label="card.ja" />
        </div>
        <div v-if="flipped" class="grid grid-cols-2 gap-3">
          <button type="button" class="h-12 rounded-control border border-line bg-paper text-body-sm text-ink hover:bg-surface active:translate-y-px" @click="answer(false)">
            再練一次
          </button>
          <button type="button" class="h-12 rounded-control bg-region-strong text-body-sm font-bold text-white active:translate-y-px" @click="answer(true)">
            記得
          </button>
        </div>
        <button v-else type="button" class="h-12 rounded-control border border-line bg-paper text-body-sm text-ink hover:bg-surface active:not-disabled:translate-y-px" @click="flipped = true">
          看答案
        </button>
      </template>

      <div v-else-if="done" class="flex flex-col items-center gap-4 rounded-card border border-line bg-paper px-6 py-10 text-center">
        <span class="text-title font-bold">這一輪練完了</span>
        <button type="button" class="h-11 rounded-control bg-region-strong px-5 text-body-sm font-bold text-white active:translate-y-px" @click="newRound">
          再一輪
        </button>
      </div>
      <p v-else class="text-body-sm text-sub">行程裡還沒有景點</p>
    </div>
  </div>
  <section v-else class="mx-auto w-full max-w-xl px-6 py-9">
    <p v-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
  </section>
</template>
