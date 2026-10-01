<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useTilt } from '../composables/tilt'
import { NATIONAL_PATTERN, PATTERN_BY_AREA } from '../data/patterns'
import { regionOf } from '../data/regions'
import { type CardFace, commonsThumb, type Rarity } from '../services/card'
import RegionMotif from './RegionMotif.vue'

// 景點收集卡（DESIGN.md §7.19）：卡面是景點的照片與名稱區塊，框是地區色＋紙紋；
// 稀有卡有箔片（世界遺產＝虹、名城＝地方紋樣、國寶・特別史跡・特別名勝＝金），滑鼠或手機傾斜時卡片轉動、反光移動。
// 尺寸全部用 em：sm 固定 200px 寬、lg 320px 寬；fluid 跟著外層容器寬（外層要有 container-type: inline-size）。
const props = withDefaults(
  defineProps<{
    card: CardFace
    rarity: Rarity
    /** 右上的指定標示（世界遺產、100名城…） */
    label?: string
    number?: string
    visitedOn?: string | null
    visited?: boolean
    size?: 'sm' | 'lg' | 'fluid'
    flipped?: boolean
    /** 放大檢視時由外層傳入（手機傾斜也在外層啟動） */
    tilt?: ReturnType<typeof useTilt>
  }>(),
  { label: '', size: 'sm', number: '', visitedOn: null, visited: false, flipped: false, tilt: undefined },
)

const own = useTilt(props.size === 'lg' ? 16 : 12)
const t = computed(() => props.tilt ?? own)

const region = computed(() => regionOf(props.card.pref))
const pattern = computed(() => (region.value && PATTERN_BY_AREA[region.value.area]) || NATIONAL_PATTERN)
const PATTERN_CLASS: Record<string, string> = {
  seigaiha: 'wa-seigaiha',
  asanoha: 'wa-asanoha',
  kikko: 'wa-kikko',
  ichimatsu: 'wa-ichimatsu',
  uroko: 'wa-uroko',
  shippo: 'wa-shippo',
  yagasuri: 'wa-yagasuri',
  hishi: 'wa-hishi',
}

// 照片：小卡用 500px 縮圖；縮圖取不到時改用原網址，再不行就退回紋樣
const tries = ref(0)
watch(() => props.card.image?.url, () => (tries.value = 0))
const imageSrc = computed(() => {
  const url = props.card.image?.url
  if (!url) return undefined
  const thumb = commonsThumb(url, props.size === 'lg' ? 960 : 500)
  const list = thumb === url ? [url] : [thumb, url]
  return list[tries.value]
})
// 名稱越長字越小，一行放得下
const nameSize = computed(() => {
  const n = props.card.name.ja.length
  return n <= 4 ? 'text-[2em]' : n <= 7 ? 'text-[1.6em]' : n <= 10 ? 'text-[1.25em]' : 'text-[1.02em]'
})
// 箔片的樣式（DESIGN.md §7.19）：世界遺產＝虹＋亮片、國寶＝金＋亮片、
// 特別史跡・特別名勝＝反向閃卡（照片窗外的卡框發亮，照片不加箔片）、名城＝地方紋樣
const foil = computed(() => {
  if (props.rarity === 'rainbow') return 'cosmos'
  if (props.rarity === 'castle') return 'pattern'
  if (props.rarity === 'gold') return props.card.designation === '國寶' ? 'gold' : 'reverse'
  return 'none'
})
const dateText = computed(() => (props.visitedOn ? props.visitedOn.replaceAll('-', '.') : ''))
const sizeClass = { sm: 'text-[10px]', lg: 'text-[16px]', fluid: 'fluid' }
</script>

<template>
  <div
    class="card-scene select-none"
    :class="sizeClass[size]"
    :style="t.style.value"
    @pointermove="tilt ? undefined : own.onPointerMove($event)"
    @pointerleave="tilt ? undefined : own.reset()"
  >
    <div class="card relative aspect-[5/7] w-[20em]" :class="[{ 'is-flipped': flipped }, `rarity-${rarity}`]" :data-pref="card.pref">
      <!-- 正面 -->
      <div class="face paper-grain absolute inset-0 flex flex-col gap-[0.55em] overflow-hidden rounded-[1em] bg-region p-[0.75em] text-on-region">
        <!-- 反向閃卡：卡框發亮（照片窗與文字在上面） -->
        <div v-if="foil === 'reverse'" class="frame-foil pointer-events-none absolute inset-0"></div>
        <div class="relative flex items-center gap-[0.5em] px-[0.2em] text-[0.8em] leading-none font-bold whitespace-nowrap">
          <span lang="ja">{{ region?.name.ja }}</span>
          <span class="truncate font-latin tracking-[0.2em] uppercase opacity-80">{{ region?.name.romaji }}</span>
          <span v-if="label" class="ml-auto shrink-0 rounded-full bg-paper px-[0.6em] py-[0.25em] text-ink">{{ label }}</span>
          <span class="shrink-0 font-latin" :class="label ? '' : 'ml-auto'">{{ number }}</span>
        </div>

        <div class="relative aspect-[4/3] shrink-0 overflow-hidden rounded-[0.6em] bg-region-accent">
          <img
            v-if="imageSrc"
            :src="imageSrc"
            :alt="card.name.ja"
            class="size-full object-cover"
            referrerpolicy="no-referrer"
            :loading="size === 'lg' ? 'eager' : 'lazy'"
            decoding="async"
            draggable="false"
            @error="tries++"
          />
          <template v-else>
            <RegionMotif :pref="card.pref" class="absolute -right-[3em] -bottom-[3em] size-[14em]" />
            <span lang="ja" class="absolute top-[0.2em] left-[0.35em] text-[4.2em] leading-none font-black text-on-region">{{ card.name.ja.slice(0, 1) }}</span>
          </template>
          <!-- 箔片：稀有卡才有，只在照片窗裡（像實體閃卡的圖框）；名城用地方紋樣的形狀 -->
          <div
            v-if="foil !== 'none' && foil !== 'reverse'"
            class="foil pointer-events-none absolute inset-0"
            :class="foil === 'pattern' ? ['wa-pattern', PATTERN_CLASS[pattern.key]] : ''"
          ></div>
          <!-- 亮片：虹卡、金卡；傾斜時一閃一閃 -->
          <div v-if="foil === 'cosmos' || foil === 'gold'" class="sparkle pointer-events-none absolute inset-0" :class="`sparkle-${foil}`"></div>
          <!-- 去過的印章 -->
          <span
            v-if="visited"
            class="stamp absolute right-[0.5em] bottom-[0.5em] grid size-[4.4em] place-items-center rounded-full border-[0.18em] border-visited bg-paper text-center text-visited"
          >
            <span class="flex flex-col items-center leading-tight">
              <span class="text-[0.95em] font-black">去過</span>
              <span v-if="dateText" class="font-latin text-[0.62em] font-semibold">{{ dateText }}</span>
            </span>
          </span>
        </div>

        <div class="relative flex min-h-0 flex-1 flex-col justify-center px-[0.2em]">
          <span v-if="card.name.kana" lang="ja" class="truncate text-[0.72em] tracking-kana opacity-85">{{ card.name.kana }}</span>
          <span lang="ja" class="truncate leading-tight font-black tracking-name" :class="nameSize">{{ card.name.ja }}</span>
          <span v-if="card.name.romaji" class="truncate font-latin text-[0.8em] font-semibold tracking-romaji uppercase">{{ card.name.romaji }}</span>
        </div>

        <div class="relative flex items-center gap-[0.5em] border-t border-on-region/25 px-[0.2em] pt-[0.45em] text-[0.72em] leading-none">
          <span>{{ card.kind }}</span>
          <span class="ml-auto font-bold">ひとめぐり</span>
        </div>

        <div class="glare pointer-events-none absolute inset-0"></div>
      </div>

      <!-- 背面 -->
      <div class="face back paper-grain absolute inset-0 flex flex-col overflow-hidden rounded-[1em] bg-region p-[0.75em] text-ink">
        <div class="relative flex min-h-0 flex-1 flex-col gap-[0.6em] overflow-hidden rounded-[0.6em] bg-paper p-[1em]">
          <RegionMotif :pref="card.pref" class="absolute -top-[4em] -right-[4em] size-[12em]" />
          <span class="relative text-[0.75em] font-bold text-sub">{{ [region?.name.ja, card.kind, card.designation].filter(Boolean).join('・') }}</span>
          <span lang="ja" class="relative text-[1.3em] leading-tight font-black">{{ card.name.ja }}</span>
          <span v-if="card.name.zh" class="relative text-[0.85em]">{{ card.name.zh }}</span>
          <p class="relative line-clamp-[9] text-[0.78em] leading-relaxed text-ink-2">{{ card.summary?.text }}</p>
          <div class="relative mt-auto flex flex-col gap-[0.2em] text-[0.62em] text-sub">
            <span v-if="card.summary">簡介：維基百科・{{ card.summary.license }}</span>
            <span v-if="card.image?.author" class="truncate">照片：{{ card.image.author }}・{{ card.image.license }}</span>
          </div>
        </div>
        <span class="pt-[0.5em] text-center text-[0.72em] font-bold tracking-[0.3em] text-on-region">ひとめぐり</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 卡片的 3D 與光澤（DESIGN.md §7.19）。顏色一律取 theme.css 的 token。 */
.card-scene {
  perspective: 60em;
  touch-action: pan-y;
}
/* 跟著外層容器寬：卡寬 20em＝容器寬 */
.fluid {
  font-size: 5cqi;
}
.card {
  transform-style: preserve-3d;
  transform: rotateX(var(--rx)) rotateY(calc(var(--ry) + var(--flip, 0deg)));
  transition: --flip 0.5s;
  border-radius: 1em;
  box-shadow:
    0 0.4em 1.2em color-mix(in oklab, var(--color-shade) 18%, transparent),
    calc(var(--ry) * -0.08em) calc(var(--rx) * 0.08em + 1em) 2em color-mix(in oklab, var(--color-shade) calc(var(--o) * 14%), transparent);
}
.card.is-flipped {
  --flip: 180deg;
}
@property --flip {
  syntax: '<angle>';
  inherits: true;
  initial-value: 0deg;
}
.face {
  backface-visibility: hidden;
}
.back {
  transform: rotateY(180deg);
}

/* 反光：跟著光源的柔光 */
.glare {
  border-radius: inherit;
  mix-blend-mode: overlay;
  opacity: calc(0.15 + var(--o) * 0.7);
  background: radial-gradient(
    farthest-corner circle at var(--mx) var(--my),
    color-mix(in oklab, var(--color-glare) 70%, transparent) 0%,
    color-mix(in oklab, var(--color-glare) 18%, transparent) 30%,
    color-mix(in oklab, var(--color-shade) 30%, transparent) 95%
  );
}

/* 箔片：color-dodge 疊在卡面上，位置跟光源反向移動；越斜越亮 */
.foil {
  border-radius: inherit;
  mix-blend-mode: color-dodge;
  background-size: 300% 300%;
  background-position: calc(100% - var(--mx)) calc(100% - var(--my));
  /* 平放時幾乎看不到，越斜越亮 */
  opacity: calc(0.06 + var(--o) * (0.2 + var(--hyp) * 0.55));
  filter: brightness(0.6) contrast(1.5) saturate(1.4);
}
.rarity-rainbow .foil,
.rarity-castle .foil {
  background-image: repeating-linear-gradient(
    115deg,
    var(--color-foil-1) 0%,
    var(--color-foil-2) 6%,
    var(--color-foil-3) 12%,
    var(--color-foil-4) 18%,
    var(--color-foil-5) 24%,
    var(--color-foil-1) 30%
  );
}
.rarity-castle .foil {
  mask-size: 2.6em auto;
  opacity: calc(0.1 + var(--o) * (0.3 + var(--hyp) * 0.45));
}
.rarity-gold .foil {
  background-image: repeating-linear-gradient(
    115deg,
    var(--color-gold-1) 0%,
    var(--color-gold-2) 8%,
    var(--color-gold-3) 14%,
    var(--color-gold-2) 20%,
    var(--color-gold-1) 28%
  );
}

/* 亮片：兩層不同間距的小光點，位置跟著光源移動，傾斜時閃爍 */
.sparkle {
  border-radius: inherit;
  mix-blend-mode: color-dodge;
  background-image:
    radial-gradient(circle, var(--spark) 0 0.06em, transparent 0.11em),
    radial-gradient(circle, var(--spark) 0 0.05em, transparent 0.09em),
    radial-gradient(circle, var(--spark) 0 0.04em, transparent 0.08em);
  background-size:
    1.7em 2.3em,
    2.9em 1.9em,
    1.3em 3.1em;
  background-position:
    calc(var(--mx) * 0.6) calc(var(--my) * 0.4),
    calc(var(--mx) * -0.5) calc(var(--my) * 0.7),
    calc(var(--mx) * 0.3) calc(var(--my) * -0.6);
  opacity: calc(var(--o) * (0.25 + var(--hyp) * 0.75));
  mask-image: radial-gradient(farthest-corner circle at var(--mx) var(--my), #000 0%, transparent 70%);
}
.sparkle-cosmos {
  --spark: var(--color-glare);
}
.sparkle-gold {
  --spark: var(--color-gold-3);
}
/* 反向閃卡：卡框是金色的光澤，照片窗不加 */
.frame-foil {
  border-radius: inherit;
  mix-blend-mode: color-dodge;
  background-image: repeating-linear-gradient(
    125deg,
    var(--color-gold-1) 0%,
    var(--color-glare) 4%,
    var(--color-gold-2) 9%,
    var(--color-gold-3) 14%,
    var(--color-gold-1) 20%
  );
  background-size: 260% 260%;
  background-position: calc(100% - var(--mx)) calc(100% - var(--my));
  opacity: calc(0.05 + var(--o) * (0.12 + var(--hyp) * 0.28));
  filter: brightness(0.5) contrast(1.6) saturate(1.3);
}

/* 去過的印章：蓋上時壓下去（只在出現時播放一次） */
.stamp {
  transform: rotate(-12deg);
  animation: stamp-in 0.32s var(--ease-out-soft) both;
}
@keyframes stamp-in {
  from {
    transform: rotate(-12deg) scale(1.35);
    opacity: 0;
  }
  60% {
    transform: rotate(-12deg) scale(0.94);
    opacity: 1;
  }
  to {
    transform: rotate(-12deg) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transform: rotateY(var(--flip, 0deg));
    transition: none;
  }
  .stamp {
    animation: none;
  }
}
</style>
