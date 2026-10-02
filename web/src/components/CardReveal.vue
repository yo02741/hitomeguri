<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { AchvDef } from '../data/achievements'
import { reveal } from '../services/cardReveal'
import { useAchievementsStore } from '../stores/achievements'
import { useMarksStore } from '../stores/marks'
import PrefStamp from './PrefStamp.vue'
import SpotCard from './SpotCard.vue'

// 新卡入手（DESIGN.md §7.19）：卡片從下方轉兩圈飛到畫面中央，落定時背後放光、蓋上去過的印章、
// 一道光掃過卡面；停一下之後縮小飛進「紀錄」分頁（頂部或手機底部，看得到的那個），分頁跳一下。
// 這次去過剛好達成成就時，落定時在卡片右上多蓋一個成就章（rank 最高的那個；其他的只標 NEW，DESIGN.md §7.25）。
// 點任何地方、Esc 直接收進去。
const marks = useMarksStore()
const achv = useAchievementsStore()
// 成就章只在這次去過剛好達成成就時才畫：不放進開站就載入的程式，卡片飛進來時（play）先抓
const loadSeal = () => import('./AchvSeal.vue')
const AchvSeal = defineAsyncComponent(loadSeal)
const r = computed(() => reveal.value)
// 光的顏色：抽到特別全景是虹、金箔是金，其他照稀有度
const burstKind = computed(() => {
  const v = r.value?.variant?.kind
  if (v === 'special') return 'rainbow'
  if (v === 'gold') return 'gold'
  if (v === 'silver') return 'silver'
  if (v && v !== 'base' && v !== 'season') return 'castle'
  return r.value?.rarity ?? 'normal'
})
const visitedOn = computed(() => (r.value ? (marks.markOf(r.value.face.id)?.visited_on ?? null) : null))

const backdrop = ref<HTMLElement | null>(null)
const burst = ref<HTMLElement | null>(null)
const fly = ref<HTMLElement | null>(null)
const spin = ref<HTMLElement | null>(null)
const sweep = ref<HTMLElement | null>(null)
const landed = ref(false)
/** 落定時拿到的成就章；others 是同時拿到的其他個數 */
const seal = ref<AchvDef | null>(null)
const others = ref(0)
const sealAt = computed(() => (seal.value ? (achv.byId.get(seal.value.id)?.at ?? null) : null))
let intro: Animation[] = []
let timers: number[] = []
let leaving = false

const HOLD: Record<string, number> = { rainbow: 2600, gold: 2300, silver: 2300, castle: 2300, normal: 1900 }
// 有縣的紀念章時多停一下；有成就章時再多停一下
const STAMP_HOLD = 700
const SEAL_HOLD = 700

function later(ms: number, fn: () => void) {
  timers.push(window.setTimeout(fn, ms))
}
function clear() {
  timers.forEach(clearTimeout)
  timers = []
}

async function play() {
  clear()
  void loadSeal()
  leaving = false
  landed.value = false
  seal.value = null
  others.value = 0
  await nextTick()
  const s = spin.value
  if (!s || !backdrop.value || !burst.value) return
  intro = [
    backdrop.value.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'both' }),
    s.animate(
      [
        { transform: 'translateY(60vh) scale(0.3) rotateY(-720deg) rotateZ(-14deg)', opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { transform: 'translateY(-4vh) scale(1.06) rotateY(-14deg) rotateZ(1.5deg)', offset: 0.72 },
        { transform: 'translateY(0) scale(1) rotateY(0deg) rotateZ(0deg)', opacity: 1 },
      ],
      { duration: 1150, easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)', fill: 'both' },
    ),
    burst.value.animate([{ opacity: 0, transform: 'scale(0.3)' }, { opacity: 1, transform: 'scale(1)' }], {
      duration: 700,
      delay: 780,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'both',
    }),
  ]
  later(820, land)
  later(820 + (HOLD[burstKind.value] ?? 2000) + (r.value?.firstInPref ? STAMP_HOLD : 0), leave)
}

// 落定：蓋印章、光掃過、手機輕震一下。
// 成就的比對和這次 reveal 是同一次 marks snapshot 觸發的，先後不一定：往前多看 2 秒
function land() {
  landed.value = true
  const cur = r.value
  const got = cur ? achv.takeRecent(cur.at - 2000) : []
  if (got.length) {
    seal.value = got[0]!
    others.value = got.length - 1
    if (!leaving) {
      clear()
      later((HOLD[burstKind.value] ?? 2000) + (cur?.firstInPref ? STAMP_HOLD : 0) + SEAL_HOLD, leave)
    }
  }
  sweep.value?.animate([{ transform: 'translateX(-120%)' }, { transform: 'translateX(120%)' }], {
    duration: 750,
    delay: 150,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    fill: 'both',
  })
  navigator.vibrate?.(12)
}

// 看得到的「紀錄」分頁（桌機在頂部、手機在底部）
function logTab(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>('[data-nav="log"]')) {
    const b = el.getBoundingClientRect()
    if (b.width && b.height) return el
  }
  return null
}

function leave() {
  if (leaving || !fly.value) return
  leaving = true
  clear()
  for (const a of intro) a.finish()
  if (!landed.value) land()
  const card = fly.value.getBoundingClientRect()
  const tab = logTab()
  const dur = 620
  const ease = 'cubic-bezier(0.55, 0, 0.7, 0.2)'
  if (tab) {
    const t = tab.getBoundingClientRect()
    const dx = t.left + t.width / 2 - (card.left + card.width / 2)
    const dy = t.top + t.height / 2 - (card.top + card.height / 2)
    fly.value.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: `translate(${dx * 0.15}px, ${dy * 0.15 - 30}px) scale(0.8) rotate(-4deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.05) rotate(-24deg)`, opacity: 0.4 },
      ],
      { duration: dur, easing: ease, fill: 'both' },
    )
    later(dur - 40, () =>
      tab.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.28) translateY(-2px)' }, { transform: 'scale(1)' }],
        { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
      ),
    )
  } else {
    fly.value.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(0.6)', opacity: 0 }], { duration: dur, easing: ease, fill: 'both' })
  }
  backdrop.value?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: 'ease-in', fill: 'both' })
  burst.value?.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(1.15)' }], { duration: dur * 0.7, fill: 'both' })
  later(dur, () => (reveal.value = null))
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') leave()
}
watch(
  () => r.value?.key,
  (k) => {
    if (k) {
      document.addEventListener('keydown', onKey)
      void play()
    } else {
      document.removeEventListener('keydown', onKey)
    }
  },
)
onBeforeUnmount(() => {
  clear()
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div v-if="r" :key="r.key" class="fixed inset-0 z-[70] overflow-hidden print:hidden" @click="leave">
    <div ref="backdrop" class="absolute inset-0 bg-ink/50"></div>
    <div ref="burst" class="burst" :class="`burst-${burstKind}`" :data-pref="r.face.pref" aria-hidden="true">
      <div class="rays"></div>
      <span v-if="landed" class="ring"></span>
    </div>
    <div class="absolute inset-0 grid place-items-center">
      <div ref="fly" class="relative">
        <div ref="spin" class="relative [transform-style:preserve-3d]">
          <SpotCard :card="r.face" :rarity="r.rarity" :label="r.label" :number="r.number" :visited="landed" :visited-on="visitedOn" size="lg" :variant="r.variant" />
          <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-[16px] mix-blend-overlay" aria-hidden="true">
            <div ref="sweep" class="sweep absolute inset-0"></div>
          </div>
        </div>
        <!-- 這個縣第一次去：縣的紀念章蓋在卡片左下 -->
        <PrefStamp v-if="landed && r.firstInPref" :pref="r.face.pref" :date="visitedOn" class="first-stamp absolute -bottom-5 z-10 w-[148px]" />
        <!-- 這次達成的成就：成就章蓋在卡片右上 -->
        <div v-if="landed && seal" class="seal-slam absolute -top-7 z-10 w-[120px]" :class="r.firstInPref ? 'after-stamp' : ''">
          <AchvSeal :def="seal" status="done" :at="sealAt" class="w-full" />
        </div>
      </div>
    </div>
    <p class="sr-only" role="status">
      {{ r.face.name.ja }}　{{ r.variant?.label ?? '' }}　收進收集冊<template v-if="seal">　成就　{{ seal.name }}<template v-if="others">　等 {{ others + 1 }} 個</template></template>
    </p>
  </div>
</template>

<style scoped>
/* 卡片背後的光：稀有度決定顏色；虹卡是虹色、金卡是金色、名城是地區色、一般是白光 */
.burst {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(130vmax, 1200px);
  aspect-ratio: 1;
  margin: calc(min(130vmax, 1200px) / -2) 0 0 calc(min(130vmax, 1200px) / -2);
  pointer-events: none;
  mask: radial-gradient(circle closest-side, #000 0 22%, transparent 92%);
}
.rays {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: repeating-conic-gradient(var(--ray) 0deg 3deg, transparent 3deg 12deg);
  opacity: 0.7;
  animation: rays-spin 24s linear infinite;
}
.burst-normal {
  --ray: color-mix(in oklab, var(--color-glare) 30%, transparent);
}
.burst-castle {
  --ray: color-mix(in oklab, var(--region-accent) 80%, transparent);
}
.burst-silver {
  --ray: color-mix(in oklab, var(--color-silver-1) 85%, transparent);
}
.burst-gold {
  --ray: color-mix(in oklab, var(--color-gold-2) 85%, transparent);
}
.burst-rainbow .rays {
  background: conic-gradient(
    var(--color-foil-1),
    var(--color-foil-2),
    var(--color-foil-3),
    var(--color-foil-4),
    var(--color-foil-5),
    var(--color-foil-1)
  );
  mask: repeating-conic-gradient(#000 0deg 3deg, transparent 3deg 12deg);
}
.burst-rainbow {
  --ray: var(--color-foil-2);
}
@keyframes rays-spin {
  to {
    transform: rotate(1turn);
  }
}
/* 落定時往外擴的一圈光 */
.ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 22%;
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 50%;
  border: 3px solid var(--ray);
  animation: ring-out 0.8s var(--ease-out-soft) both;
}
@keyframes ring-out {
  from {
    transform: scale(0.4);
    opacity: 1;
  }
  to {
    transform: scale(2.6);
    opacity: 0;
  }
}
/* 縣的紀念章：從上方重重蓋下、微微回彈，墨色帶點透明（像蓋在卡上）。
   卡片 320px 寬；比 390px 窄的手機往卡片裡收，斜放的章不超出畫面 */
.first-stamp {
  left: max(-36px, calc((320px - 100vw) / 2 + 20px));
  opacity: 0.92;
  filter: drop-shadow(0 1px 0 color-mix(in oklab, var(--region-paper) 70%, transparent));
  transform: rotate(-14deg);
  animation: stamp-slam 0.5s 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes stamp-slam {
  from {
    transform: rotate(-26deg) scale(2.4);
    opacity: 0;
  }
  60% {
    transform: rotate(-12deg) scale(0.9);
    opacity: 0.95;
  }
  to {
    transform: rotate(-14deg) scale(1);
    opacity: 0.92;
  }
}
/* 成就章：和縣的紀念章對稱，從上方蓋下、停在右傾；有縣的紀念章時晚一點蓋。窄手機一樣往卡片裡收 */
.seal-slam {
  right: max(-36px, calc((320px - 100vw) / 2 + 12px));
  opacity: 0.94;
  filter: drop-shadow(0 1px 0 color-mix(in oklab, var(--region-paper) 70%, transparent));
  transform: rotate(8deg);
  animation: seal-slam 0.5s 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.seal-slam.after-stamp {
  animation-delay: 0.8s;
}
@keyframes seal-slam {
  from {
    transform: rotate(20deg) scale(2.4);
    opacity: 0;
  }
  60% {
    transform: rotate(6deg) scale(0.9);
    opacity: 0.96;
  }
  to {
    transform: rotate(8deg) scale(1);
    opacity: 0.94;
  }
}
/* 落定時掃過卡面的一道光 */
.sweep {
  transform: translateX(-120%);
  background: linear-gradient(
    105deg,
    transparent 30%,
    color-mix(in oklab, var(--color-glare) 85%, transparent) 50%,
    transparent 70%
  );
}
</style>
