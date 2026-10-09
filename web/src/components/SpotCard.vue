<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useTilt } from '../composables/tilt'
import { NATIONAL_PATTERN, PATTERN_BY_AREA } from '../data/patterns'
import { regionOf } from '../data/regions'
import { type CardFace, commonsThumb, type Rarity } from '../services/card'
import { BASE_VARIANT, type Variant } from '../services/cardVariants'
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
    /** 樣式（DESIGN.md §7.19a）：基本、季節、全景、金箔、特別全景 */
    variant?: Variant
    /** 收集冊的格子：靜止時畫成平面（不建 3D、反光、亮片的層），滑鼠移上去或聚焦時才換成完整的卡 */
    lite?: boolean
  }>(),
  { label: '', size: 'sm', number: '', visitedOn: null, visited: false, flipped: false, tilt: undefined, variant: () => BASE_VARIANT, lite: false },
)

const SPARKLE: Record<string, string> = { gold: 'sparkle-gold', silver: 'sparkle-silver', night: 'sparkle-night' }
const own = useTilt(props.size === 'lg' ? 16 : 12)
const t = computed(() => props.tilt ?? own)

// lite：一頁上百張卡都是 3D 時，瀏覽器要建上千個合成層，手機捲動會卡。靜止的卡畫成平面，
// 滑鼠移上去、鍵盤聚焦時才「醒來」；離開後等傾斜回正再睡回去。
const awake = ref(false)
let sleepTimer = 0
function wake() {
  clearTimeout(sleepTimer)
  awake.value = true
}
function sleep() {
  clearTimeout(sleepTimer)
  sleepTimer = window.setTimeout(() => (awake.value = false), 500)
}
const isLite = computed(() => props.lite && !awake.value && !props.flipped)
function onEnter() {
  if (props.lite) wake()
}
function onLeave() {
  if (!props.tilt) own.reset()
  if (props.lite) sleep()
}

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

// 照片：小卡用 500px 縮圖；縮圖取不到時改用小一號的縮圖、原網址，再不行就退回紋樣
const tries = ref(0)
// 全景卡（全景、特別全景、夜景）照片鋪滿整張卡，縮圖要大一號，否則直向放大會糊
const fullArt = computed(() => ['full', 'special', 'night'].includes(props.variant.kind))
// 不是基本卡的照片（DESIGN.md §7.19a）：抽到那個季節的照片，沒有就用基本卡的照片。
// 全景、特別全景也用基本卡的照片（審過的主照片）：Wikidata 的全景照片多半很寬，裁成直向卡會糊、主體也常被裁掉。
// 不拿第二張或其他季節的照片補：地圖資料沒有第二張，詳細資料載入後照片會換一張；別的季節的照片也常拍到別處
const photo = computed(() => {
  const c = props.card
  if (props.variant.kind === 'base') return c.image
  const seasonal = props.variant.photo ? c.seasonImages?.[props.variant.photo] : undefined
  return seasonal ?? c.image
})
watch(() => photo.value?.url, () => {
  tries.value = 0
  contain.value = false
})
// 全景卡的照片太寬（裁成 5:7 只剩不到 55% 寬）或太小（鋪滿要放大）時不裁：整張照片置中，
// 後面墊同一張照片的模糊放大版，卡面看起來還是鋪滿（DESIGN.md §7.19a）。載入後依原圖尺寸決定，不換照片
const contain = ref(false)
function onLoad(e: Event) {
  if (!fullArt.value) return
  const img = e.target as HTMLImageElement
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (!w || !h) return
  // offsetHeight 是排版高度，不受傾斜的 transform 影響
  const cardHeight = (img.closest('.card') as HTMLElement | null)?.offsetHeight ?? 0
  const tooWide = ((5 / 7) * h) / w < 0.45
  const tooSmall = h < cardHeight * (window.devicePixelRatio || 1) * 0.8
  contain.value = tooWide || tooSmall
}
const imageSrc = computed(() => {
  const url = photo.value?.url
  if (!url) return undefined
  const widths: (500 | 960 | 1280)[] =
    props.size === 'lg' ? (fullArt.value ? [1280, 960] : [960]) : fullArt.value ? [960, 500] : [500]
  // 原圖比要的寬度小時 Commons 會回錯誤，依序退回小一號、原網址
  const list = [...new Set([...widths.map((w) => commonsThumb(url, w)), url])]
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
  // 全景卡、金箔卡的光澤蓋滿整張卡，照片窗不另外加
  if (props.variant.kind !== 'base' && props.variant.kind !== 'season') return 'none'
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
    :class="[sizeClass[size], { 'is-lite': isLite }]"
    :style="t.style.value"
    @pointerenter="onEnter"
    @pointermove="tilt ? undefined : own.onPointerMove($event)"
    @pointerleave="onLeave"
    @focusin="onEnter"
    @focusout="lite && sleep()"
  >
    <div
      class="card relative aspect-[5/7] w-[20em]"
      :class="[{ 'is-flipped': flipped, 'full-art': fullArt }, `rarity-${rarity}`, `v-${variant.kind}`, variant.season ? `season-${variant.season}` : '']"
      :data-pref="card.pref"
    >
      <!-- 正面 -->
      <div class="face paper-grain absolute inset-0 flex flex-col gap-[0.55em] overflow-hidden rounded-[1em] bg-region p-[0.75em] text-on-region">
        <!-- 反向閃卡：卡框發亮（照片窗與文字在上面） -->
        <div v-if="foil === 'reverse'" class="frame-foil pointer-events-none absolute inset-0"></div>
        <!-- 季節卡：卡框散落那個季節的花樣（櫻、煙火、楓、雪） -->
        <div v-if="variant.kind === 'season'" class="season-wash pointer-events-none absolute inset-0"></div>
        <div v-if="variant.kind === 'season'" class="season-drop pointer-events-none absolute inset-0">
          <div class="season-pattern absolute inset-0"></div>
        </div>
        <div class="relative flex items-center gap-[0.5em] px-[0.2em] text-[0.8em] leading-none font-bold whitespace-nowrap">
          <span lang="ja">{{ region?.name.ja }}</span>
          <span class="truncate font-latin tracking-[0.2em] uppercase">{{ region?.name.romaji }}</span>
          <span v-if="label" class="ml-auto shrink-0 rounded-full bg-paper px-[0.6em] py-[0.25em] text-ink">{{ label }}</span>
          <span class="shrink-0 font-latin" :class="label ? '' : 'ml-auto'">{{ number }}</span>
        </div>

        <div class="window relative aspect-[4/3] shrink-0 overflow-hidden rounded-[0.6em] bg-region-accent">
          <!-- 全景卡放整張照片時的底：同一張照片（同一個網址，不另外下載）縮小模糊再放大鋪滿 -->
          <img
            v-if="imageSrc && fullArt && contain"
            :src="imageSrc"
            alt=""
            aria-hidden="true"
            class="backdrop pointer-events-none absolute object-cover"
            referrerpolicy="no-referrer"
            decoding="async"
            draggable="false"
          />
          <img
            v-if="imageSrc"
            data-photo
            :src="imageSrc"
            :alt="card.name.ja"
            class="relative size-full"
            :class="fullArt && contain ? 'object-contain' : 'object-cover'"
            referrerpolicy="no-referrer"
            :loading="size === 'lg' ? 'eager' : 'lazy'"
            decoding="async"
            draggable="false"
            @load="onLoad"
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
              <span v-if="dateText" class="font-num text-[0.62em] font-semibold">{{ dateText }}</span>
            </span>
          </span>
        </div>

        <!-- 全景卡：照片上下加暗面，文字壓在照片上 -->
        <div v-if="fullArt" class="scrim pointer-events-none absolute inset-0"></div>
        <div class="name-block relative flex min-h-0 flex-1 flex-col justify-center px-[0.2em]">
          <span v-if="card.name.kana" lang="ja" class="truncate text-[0.72em] tracking-kana">{{ card.name.kana }}</span>
          <span lang="ja" class="card-name truncate leading-tight font-black tracking-name" :class="nameSize">{{ card.name.ja }}</span>
          <span v-if="card.name.romaji" class="truncate font-latin text-[0.8em] font-semibold tracking-romaji uppercase">{{ card.name.romaji }}</span>
        </div>

        <div class="card-foot relative flex h-[1.9em] shrink-0 items-center gap-[0.5em] border-t border-on-region/25 px-[0.2em] text-[0.72em] leading-none">
          <span>{{ card.kind }}</span>
          <span v-if="variant.kind !== 'base'" class="variant-chip ml-auto rounded-full px-[0.6em] py-[0.2em] font-bold">{{ variant.label }}</span>
          <span class="font-bold" :class="variant.kind === 'base' ? 'ml-auto' : ''">ひとめぐり</span>
        </div>

        <!-- 切手：消印 -->
        <svg v-if="variant.kind === 'stamp'" class="postmark pointer-events-none absolute" viewBox="0 0 100 60" aria-hidden="true">
          <circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" stroke-width="2.5" />
          <circle cx="30" cy="30" r="20" fill="none" stroke="currentColor" stroke-width="1.2" />
          <path d="M58 18q6-5 12 0t12 0 12 0M58 30q6-5 12 0t12 0 12 0M58 42q6-5 12 0t12 0 12 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
        </svg>
        <!-- 全景、夜景、金箔、銀箔、特別全景：整張卡的蝕刻紋、虹、亮片 -->
        <div v-if="['full', 'gold', 'silver', 'special'].includes(variant.kind)" class="etched pointer-events-none absolute inset-0"></div>
        <div v-if="variant.kind === 'special'" class="foil whole pointer-events-none absolute inset-0"></div>
        <div
          v-if="['special', 'gold', 'silver', 'night'].includes(variant.kind)"
          class="sparkle whole pointer-events-none absolute inset-0"
          :class="SPARKLE[variant.kind] ?? 'sparkle-cosmos'"
        ></div>
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
            <span v-if="photo?.author" class="truncate">照片：{{ photo.author }}・{{ photo.license }}</span>
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
/* 靜止的格子卡（lite）：平面、不畫背面、反光與亮片（平放時本來就幾乎看不到） */
.is-lite {
  perspective: none;
}
.is-lite .card {
  transform-style: flat;
  transform: none;
}
.is-lite .face {
  backface-visibility: visible;
}
.is-lite .back,
.is-lite .glare,
.is-lite .sparkle {
  display: none;
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
.sparkle-silver {
  --spark: var(--color-silver-3);
}
/* 夜景：星點，不隨光源移動，傾斜時一閃一閃 */
.sparkle-night {
  --spark: var(--color-night-star);
  mix-blend-mode: screen;
  background-position: 10% 20%, 60% 70%, 30% 90%;
  mask-image: linear-gradient(to bottom, #000 0%, transparent 60%);
  opacity: calc(0.35 + var(--o) * (0.2 + var(--hyp) * 0.45));
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

/* ---------- 樣式（DESIGN.md §7.19a） ---------- */
.variant-chip {
  background: var(--color-glare);
  color: var(--color-shade);
}
/* 季節卡：卡框散落季節的花樣，照片窗加一圈季節色 */
/* 季節卡：卡框上半染季節色，花樣加一點影子（淡色的縣也看得出來），傾斜時跟著光源慢慢飄 */
.season-wash {
  border-radius: inherit;
  background: linear-gradient(165deg, color-mix(in oklab, var(--season) 70%, var(--region-base)) 0%, transparent 62%);
}
.season-drop {
  border-radius: inherit;
  overflow: hidden;
  filter: drop-shadow(0 0.06em 0.04em color-mix(in oklab, var(--color-shade) 35%, transparent));
}
.season-pattern {
  background-color: color-mix(in oklab, var(--season) 85%, var(--color-glare));
  mask-size: 3.4em 3.4em;
  mask-position: calc(var(--mx, 50%) * 0.12) calc(var(--my, 50%) * 0.18);
  opacity: 0.95;
}
.season-spring {
  --season: var(--color-sakura-1);
}
.season-summer {
  --season: var(--color-hanabi-3);
}
.season-autumn {
  --season: var(--color-momiji-2);
}
.season-winter {
  --season: var(--color-snow);
}
.season-spring .season-pattern {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='black'%3E%3Cellipse cx='10' cy='12' rx='3.0' ry='5.2' transform='rotate(20 10 12)'/%3E%3Cellipse cx='40' cy='8' rx='2.4' ry='4.2' transform='rotate(-35 40 8)'/%3E%3Cellipse cx='26' cy='34' rx='3.3' ry='5.7' transform='rotate(60 26 34)'/%3E%3Cellipse cx='52' cy='40' rx='2.7' ry='4.7' transform='rotate(10 52 40)'/%3E%3Cellipse cx='12' cy='50' rx='2.4' ry='4.2' transform='rotate(-60 12 50)'/%3E%3C/g%3E%3C/svg%3E");
}
.season-summer .season-pattern {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='black' stroke-width='1.6' stroke-linecap='round'%3E%3Cline x1='27.0' y1='22.0' x2='34.0' y2='22.0'/%3E%3Cline x1='26.0' y1='24.9' x2='31.7' y2='29.1'/%3E%3Cline x1='23.5' y1='26.8' x2='25.7' y2='33.4'/%3E%3Cline x1='20.5' y1='26.8' x2='18.3' y2='33.4'/%3E%3Cline x1='18.0' y1='24.9' x2='12.3' y2='29.1'/%3E%3Cline x1='17.0' y1='22.0' x2='10.0' y2='22.0'/%3E%3Cline x1='18.0' y1='19.1' x2='12.3' y2='14.9'/%3E%3Cline x1='20.5' y1='17.2' x2='18.3' y2='10.6'/%3E%3Cline x1='23.5' y1='17.2' x2='25.7' y2='10.6'/%3E%3Cline x1='26.0' y1='19.1' x2='31.7' y2='14.9'/%3E%3Cline x1='51.0' y1='48.0' x2='55.0' y2='48.0'/%3E%3Cline x1='50.1' y1='50.1' x2='52.9' y2='52.9'/%3E%3Cline x1='48.0' y1='51.0' x2='48.0' y2='55.0'/%3E%3Cline x1='45.9' y1='50.1' x2='43.1' y2='52.9'/%3E%3Cline x1='45.0' y1='48.0' x2='41.0' y2='48.0'/%3E%3Cline x1='45.9' y1='45.9' x2='43.1' y2='43.1'/%3E%3Cline x1='48.0' y1='45.0' x2='48.0' y2='41.0'/%3E%3Cline x1='50.1' y1='45.9' x2='52.9' y2='43.1'/%3E%3C/g%3E%3C/svg%3E");
}
.season-autumn .season-pattern {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='black'%3E%3Cpolygon points='17.6,7.1 18.9,13.2 24.9,14.7 19.6,17.9 19.9,24.1 15.3,20.0 9.5,22.3 12.0,16.6 8.1,11.8 14.2,12.4'/%3E%3Cpolygon points='41.0,35.7 44.6,38.9 49.1,37.2 47.1,41.6 50.1,45.4 45.3,44.9 42.7,48.9 41.7,44.1 37.1,42.9 41.2,40.5'/%3E%3C/g%3E%3C/svg%3E");
}
.season-winter .season-pattern {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg stroke='black' stroke-width='1.5' stroke-linecap='round'%3E%3Cline x1='15.0' y1='8.0' x2='15.0' y2='22.0'/%3E%3Cline x1='8.9' y1='11.5' x2='21.1' y2='18.5'/%3E%3Cline x1='21.1' y1='11.5' x2='8.9' y2='18.5'/%3E%3Cline x1='45.0' y1='39.0' x2='45.0' y2='49.0'/%3E%3Cline x1='40.7' y1='41.5' x2='49.3' y2='46.5'/%3E%3Cline x1='49.3' y1='41.5' x2='40.7' y2='46.5'/%3E%3C/g%3E%3Ccircle cx='46' cy='14' r='1.8' fill='black'/%3E%3Ccircle cx='14' cy='46' r='1.5' fill='black'/%3E%3C/svg%3E");
}
.v-season .window {
  box-shadow: 0 0 0 0.18em var(--season);
}
.v-season .variant-chip {
  background: var(--season);
}

/* 全景卡：照片鋪滿，上下暗面，文字壓在照片上 */
.full-art .face {
  color: var(--color-glare);
}
.full-art .window {
  position: absolute;
  inset: 0;
  aspect-ratio: auto;
  border-radius: inherit;
}
.full-art .backdrop {
  /* 只有卡的 28% 大小時模糊，再放大 4 倍鋪滿（比整張卡大一點，模糊的邊不會露出來）：模糊的層小、畫得快 */
  top: 50%;
  left: 50%;
  width: 28%;
  height: 28%;
  max-width: none;
  transform: translate(-50%, -50%) scale(4);
  filter: blur(0.3em) brightness(0.72) saturate(1.1);
}
.full-art .name-block {
  justify-content: flex-end;
  padding-bottom: 0.3em;
  text-shadow: 0 0.06em 0.3em color-mix(in oklab, var(--color-shade) 60%, transparent);
}
.full-art .scrim {
  border-radius: inherit;
  background:
    linear-gradient(to bottom, color-mix(in oklab, var(--color-shade) 55%, transparent) 0%, transparent 22%),
    linear-gradient(to top, color-mix(in oklab, var(--color-shade) 72%, transparent) 0%, transparent 42%);
}
.full-art .stamp {
  bottom: 34%;
}
.full-art .card-foot,
.v-gold .card-foot {
  border-color: color-mix(in oklab, currentColor 35%, transparent);
}

/* 金箔卡：整張金框，照片窗有金邊 */
.v-gold .face:not(.back) {
  background: linear-gradient(
    135deg,
    var(--color-gold-2) 0%,
    var(--color-gold-1) 35%,
    var(--color-gold-3) 50%,
    var(--color-gold-1) 65%,
    var(--color-gold-2) 100%
  );
  color: var(--color-shade);
}
.v-gold .window {
  box-shadow: 0 0 0 0.2em var(--color-gold-2);
}
.v-gold .variant-chip {
  background: var(--color-shade);
  color: var(--color-gold-3);
}

/* 銀箔卡：整張銀框 */
.v-silver .face:not(.back) {
  background: linear-gradient(
    135deg,
    var(--color-silver-2) 0%,
    var(--color-silver-1) 35%,
    var(--color-silver-3) 50%,
    var(--color-silver-1) 65%,
    var(--color-silver-2) 100%
  );
  color: var(--color-shade);
}
.v-silver .window {
  box-shadow: 0 0 0 0.2em var(--color-silver-2);
}
.v-silver .card-foot {
  border-color: color-mix(in oklab, currentColor 35%, transparent);
}
.v-silver .variant-chip {
  background: var(--color-shade);
  color: var(--color-silver-3);
}
.v-silver .etched {
  mix-blend-mode: soft-light;
}

/* 夜景卡：夜晚的照片鋪滿，深藍卡面與暗面（只有真的夜景照片的景點才有這種卡） */
.v-night .face:not(.back) {
  background: var(--color-night);
  color: var(--color-glare);
}
.v-night .scrim {
  background:
    linear-gradient(to bottom, color-mix(in oklab, var(--color-night) 70%, transparent) 0%, transparent 28%),
    linear-gradient(to top, color-mix(in oklab, var(--color-night) 88%, transparent) 0%, transparent 45%);
}
.v-night .variant-chip {
  background: var(--color-night-star);
  color: var(--color-night);
}

/* 墨繪卡：照片變水墨，和紙卡面、墨框、墨色文字 */
.v-sumi .face:not(.back) {
  background: color-mix(in oklab, var(--color-glare) 88%, var(--region-base));
  color: var(--region-ink);
}
.v-sumi .window {
  border-radius: 0.1em;
  box-shadow:
    0 0 0 0.1em var(--region-ink),
    0.12em 0.12em 0 0.1em color-mix(in oklab, var(--region-ink) 35%, transparent);
}
.v-sumi .window img {
  filter: grayscale(1) contrast(1.4) brightness(1.08);
}
.v-sumi .window::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: var(--region-ink);
  mix-blend-mode: soft-light;
  opacity: 0.25;
}
.v-sumi .card-foot {
  border-color: color-mix(in oklab, var(--region-ink) 40%, transparent);
}
.v-sumi .variant-chip {
  background: var(--region-ink);
  color: var(--color-glare);
}

/* 切手卡：白邊、四邊齒孔、照片窗外一圈地區色、消印 */
.v-stamp {
  border-radius: 0;
}
.v-stamp .face {
  border-radius: 0;
  background: var(--color-glare);
  color: var(--region-ink);
  padding: 0.95em;
  mask-image:
    linear-gradient(#000, #000),
    radial-gradient(circle, #000 0.22em, transparent 0.24em),
    radial-gradient(circle, #000 0.22em, transparent 0.24em),
    radial-gradient(circle, #000 0.22em, transparent 0.24em),
    radial-gradient(circle, #000 0.22em, transparent 0.24em);
  mask-size:
    100% 100%,
    0.72em 0.72em,
    0.72em 0.72em,
    0.72em 0.72em,
    0.72em 0.72em;
  mask-repeat: no-repeat, repeat-x, repeat-x, repeat-y, repeat-y;
  mask-position:
    0 0,
    0.36em -0.36em,
    0.36em calc(100% + 0.36em),
    -0.36em 0.36em,
    calc(100% + 0.36em) 0.36em;
  mask-composite: exclude;
}
.v-stamp .window {
  border-radius: 0;
  box-shadow: 0 0 0 0.12em var(--region-base);
}
.v-stamp .card-foot {
  border-color: color-mix(in oklab, var(--region-ink) 40%, transparent);
}
.v-stamp .variant-chip {
  background: var(--region-strong);
  color: var(--color-glare);
}
.postmark {
  right: -0.3em;
  bottom: 2.1em;
  width: 9em;
  color: var(--region-ink);
  opacity: 0.6;
  transform: rotate(-12deg);
  mix-blend-mode: multiply;
}

/* 蝕刻紋：細密的斜線，跟著光源亮起來（全景、金箔、銀箔、特別全景） */
.etched {
  border-radius: inherit;
  mix-blend-mode: overlay;
  background-image:
    repeating-linear-gradient(
      62deg,
      color-mix(in oklab, var(--color-glare) 70%, transparent) 0 0.06em,
      transparent 0.06em 0.28em
    ),
    repeating-linear-gradient(
      -28deg,
      color-mix(in oklab, var(--color-glare) 45%, transparent) 0 0.05em,
      transparent 0.05em 0.36em
    );
  mask-image: radial-gradient(farthest-corner circle at var(--mx) var(--my), #000 0%, transparent 65%);
  opacity: calc(0.15 + var(--o) * 0.75);
}
.v-gold .etched {
  mix-blend-mode: soft-light;
}
/* 特別全景：虹色鋪滿整張卡 */
.foil.whole {
  background-image: repeating-linear-gradient(
    115deg,
    var(--color-foil-1) 0%,
    var(--color-foil-2) 6%,
    var(--color-foil-3) 12%,
    var(--color-foil-4) 18%,
    var(--color-foil-5) 24%,
    var(--color-foil-1) 30%
  );
  opacity: calc(0.12 + var(--o) * (0.25 + var(--hyp) * 0.45));
}
.sparkle.whole {
  opacity: calc(0.2 + var(--o) * (0.3 + var(--hyp) * 0.5));
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

/* 年代主題（DESIGN.md §13）：照片留紙邊、年代的照片濾鏡與質感、名稱用展示字型；框與陰影依年代 */
:root[data-theme] .card {
  border-radius: var(--radius-card);
  box-shadow: var(--era-card-shadow);
}
:root[data-theme] .face {
  border-radius: var(--radius-card);
}
:root[data-theme='showa'] .face,
:root[data-theme='edo'] .face {
  border: 0.08em solid var(--region-ink);
}
:root[data-theme] .face:not(.back) .window {
  border-radius: calc(var(--radius-card) / 2);
  padding: 0.28em;
  background: var(--color-era-card);
}
:root[data-theme='showa'] .face:not(.back) .window,
:root[data-theme='edo'] .face:not(.back) .window {
  border: 0.08em solid var(--region-ink);
  border-radius: 0;
}
:root[data-theme] .full-art .face:not(.back) .window {
  border: 0;
  padding: 0;
}
:root[data-theme] .window::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: var(--era-photo-overlay);
  background-size: var(--era-photo-overlay-size);
  mix-blend-mode: var(--era-photo-blend);
}
:root[data-theme] .card-name {
  font-family: var(--font-display);
  font-weight: var(--display-weight);
}
:root[data-theme] .stamp {
  outline: 0.06em solid var(--color-visited);
  outline-offset: -0.42em;
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
