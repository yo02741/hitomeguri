<script setup lang="ts">
import { computed } from 'vue'

import { type AchvDef, groupOf } from '../data/achievements'
import { PATTERN_BY_AREA } from '../data/patterns'
import { type AchvStatus, dotDate, tiltOf } from '../services/achievements'

// 成就的章（DESIGN.md §7.25）：紀念章帳上的一個章。組別用形狀分（顏色不是唯一的辨識方式）：
// 地方雙圈＋地方的和風紋樣、旅行角形駅スタンプ、時節小判、足跡雙圈（內圈點線）、文化指定角印、名城八角、擴充包消印。
// 達成：印泥色（--color-visited，名城、擴充包用主題色）、#stamp-ink 墨邊（DollDefs.vue）、依 id 固定傾斜。
// 未達成：虛線、不套濾鏡、不旋轉、沒有紋樣，字是 sub 色。載入中：skeleton 圓。
// label 有給時是 role="img"，否則是裝飾（外面的按鈕或文字已經說了）。
const props = defineProps<{ def: AchvDef; status: AchvStatus; at?: string | null; size?: number; label?: string }>()

const group = computed(() => groupOf.get(props.def.group)!)
const shape = computed(() => group.value.shape)
const done = computed(() => props.status === 'done')
const arc = computed(() => shape.value === 'circle' || shape.value === 'dotted' || shape.value === 'postmark')
/** 消印的圓往左偏，右邊留給波浪線 */
const cx = computed(() => (shape.value === 'postmark' ? 52 : 60))
const id = `achv-${Math.random().toString(36).slice(2, 8)}`

// Tailwind 需要看到完整的 class 名稱（同 RegionMotif.vue）
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
const INK: Record<string, string> = {
  visited: 'text-visited',
  't-castle': 'text-t-castle',
  pokemon: 'text-t-pokemon',
  shinise: 'text-t-shinise',
  chara: 'text-t-chara',
}
const inkClass = computed(() => {
  if (!done.value) return 'locked'
  const ink = group.value.ink === 'pack' ? (props.def.pack ?? 'pokemon') : group.value.ink
  return INK[ink] ?? 'text-visited'
})
const pattern = computed(() => {
  if (!done.value || props.def.rule.kind !== 'area') return null
  const p = PATTERN_BY_AREA[props.def.rule.area]
  return p ? PATTERN_CLASS[p.key] : null
})

const isLatin = (s: string) => /^[\d\s]+$/.test(s)
const scale = computed(() => (shape.value === 'postmark' ? 0.86 : shape.value === 'oval' ? 0.9 : 1))
const mainSize = computed(() => {
  const m = props.def.face.main
  const n = [...m].length
  const base = isLatin(m) ? (n <= 2 ? 34 : 29) : n <= 2 ? 25 : n === 3 ? 21 : n === 4 ? 17 : 14.5
  return base * scale.value
})
const subSize = computed(() => ([...(props.def.face.sub ?? '')].length >= 5 ? 8.5 : 9.5) * scale.value)
/** 上緣直線字的最大寬度（依形狀的內框） */
const TOP_MAX: Record<string, number> = { rect: 80, oval: 62, square: 80, octagon: 72 }
const topLen = computed(() => {
  const n = props.def.face.top.length
  const est = n * 5.6
  const max = TOP_MAX[shape.value] ?? 80
  return est > max ? max : undefined
})
// 各形狀的字的位置
const LAYOUT: Record<string, { top: number; main: number; line: number; sub: number; date: number }> = {
  circle: { top: 0, main: 66, line: 74, sub: 86, date: 97 },
  dotted: { top: 0, main: 66, line: 74, sub: 86, date: 97 },
  postmark: { top: 0, main: 64, line: 71, sub: 82, date: 92 },
  rect: { top: 32, main: 64, line: 72, sub: 85, date: 97 },
  oval: { top: 36, main: 63, line: 70, sub: 81, date: 91 },
  square: { top: 30, main: 64, line: 72, sub: 85, date: 98 },
  octagon: { top: 36, main: 66, line: 74, sub: 86, date: 97 },
}
const pos = computed(() => {
  const l = LAYOUT[shape.value]!
  // 沒有副字也沒有日期時，主字往下放在中間
  if (!props.def.face.sub && !(done.value && props.at)) return { ...l, main: l.main + 6 }
  return l
})

function octagon(r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const a = ((-112.5 + i * 45) * Math.PI) / 180
    pts.push(`${(60 + r * Math.cos(a)).toFixed(2)},${(60 + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}
const OCT_OUTER = octagon(57)
const OCT_INNER = octagon(50)

const tilt = computed(() => (done.value ? tiltOf(props.def.id) : 0))
const style = computed(() => ({
  ...(props.size ? { width: `${props.size}px`, height: `${props.size}px` } : {}),
  rotate: tilt.value ? `${tilt.value}deg` : undefined,
}))
</script>

<template>
  <span v-if="status === 'unknown'" class="skeleton block aspect-square w-full rounded-full" :style="size ? { width: `${size}px` } : undefined" :aria-label="label" :role="label ? 'img' : undefined" :aria-hidden="label ? undefined : 'true'"></span>
  <span v-else class="achv-seal relative block aspect-square" :class="inkClass" :style="style">
    <span v-if="pattern" class="wa-pattern absolute inset-[13%] rounded-full bg-visited opacity-20" :class="pattern" aria-hidden="true"></span>
    <svg viewBox="0 0 120 120" class="relative block size-full overflow-visible" :role="label ? 'img' : undefined" :aria-label="label" :aria-hidden="label ? undefined : 'true'">
      <defs v-if="arc">
        <path :id="`${id}-arc`" :d="`M ${cx - 38} 60 A 38 38 0 0 1 ${cx + 38} 60`" />
      </defs>
      <g :filter="done ? 'url(#stamp-ink)' : undefined" class="ink">
        <!-- 外框 -->
        <template v-if="shape === 'circle' || shape === 'dotted'">
          <circle cx="60" cy="60" r="56" stroke-width="4" class="frame" />
          <circle cx="60" cy="60" r="49" :stroke-width="shape === 'dotted' ? 2.2 : 1.5" :class="shape === 'dotted' ? 'dots' : 'frame'" />
        </template>
        <template v-else-if="shape === 'postmark'">
          <circle :cx="cx" cy="60" r="49" stroke-width="3.6" class="frame" />
          <circle :cx="cx" cy="60" r="42" stroke-width="1.4" class="frame" />
          <path d="M94 45q4-4.5 8 0t8 0 8 0M94 60q4-4.5 8 0t8 0 8 0M94 75q4-4.5 8 0t8 0 8 0" stroke-width="2.6" stroke-linecap="round" class="frame" />
        </template>
        <template v-else-if="shape === 'rect'">
          <rect x="5" y="9" width="110" height="102" rx="12" stroke-width="4" class="frame" />
          <rect x="12" y="16" width="96" height="88" rx="7" stroke-width="1.5" class="frame" />
        </template>
        <template v-else-if="shape === 'oval'">
          <ellipse cx="60" cy="60" rx="57" ry="45" stroke-width="4" class="frame" />
          <ellipse cx="60" cy="60" rx="50" ry="38" stroke-width="1.5" class="frame" />
        </template>
        <template v-else-if="shape === 'square'">
          <rect x="7" y="7" width="106" height="106" rx="3" stroke-width="4.5" class="frame" />
          <rect x="14" y="14" width="92" height="92" rx="1.5" stroke-width="1.5" class="frame" />
        </template>
        <template v-else-if="shape === 'octagon'">
          <polygon :points="OCT_OUTER" stroke-width="4" class="frame" />
          <polygon :points="OCT_INNER" stroke-width="1.5" class="frame" />
        </template>

        <!-- 上緣：圓形沿弧線，其他寫成直線 -->
        <text v-if="arc" font-size="7.6" font-weight="700" letter-spacing="1.6" text-anchor="middle" class="latin">
          <textPath :href="`#${id}-arc`" startOffset="50%">{{ def.face.top }}</textPath>
        </text>
        <text
          v-else
          x="60"
          :y="pos.top"
          font-size="7"
          font-weight="700"
          letter-spacing="1.4"
          text-anchor="middle"
          class="latin"
          :textLength="topLen"
          :lengthAdjust="topLen ? 'spacingAndGlyphs' : undefined"
        >{{ def.face.top }}</text>

        <!-- 主字、副字、日期 -->
        <text :x="cx" :y="pos.main" :font-size="mainSize" font-weight="800" text-anchor="middle" :class="isLatin(def.face.main) ? 'latin' : 'zh'">{{ def.face.main }}</text>
        <template v-if="def.face.sub || (done && at)">
          <line :x1="cx - 26 * scale" :y1="pos.line" :x2="cx + 26 * scale" :y2="pos.line" stroke-width="1.2" class="frame" />
          <text v-if="def.face.sub" :x="cx" :y="pos.sub" :font-size="subSize" font-weight="700" text-anchor="middle" class="zh">{{ def.face.sub }}</text>
          <text v-if="done && at" :x="cx" :y="def.face.sub ? pos.date : pos.sub" font-size="8.2" font-weight="600" text-anchor="middle" class="latin">{{ dotDate(at) }}</text>
        </template>
      </g>
    </svg>
  </span>
</template>

<style scoped>
.achv-seal {
  flex-shrink: 0;
}
.ink {
  fill: currentColor;
  stroke: currentColor;
}
.frame,
.dots {
  fill: none;
}
.dots {
  stroke-dasharray: 0.1 4.2;
  stroke-linecap: round;
  stroke-width: 2.6;
}
.ink text {
  stroke: none;
  font-family: var(--font-display-zh);
}
.ink text.latin {
  font-family: var(--font-latin);
}
/* 還沒達成：預印的虛線框，字是 sub 色 */
.locked .ink {
  fill: var(--color-sub);
  stroke: var(--color-line);
}
.locked .frame {
  stroke-dasharray: 4 3;
}
.locked .dots {
  stroke-dasharray: 0.1 4.2;
}
</style>
