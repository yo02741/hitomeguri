<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'

import { useFloating } from '../composables/floating'
import { usePrep } from '../composables/prep'
import { regionOf } from '../data/regions'
import { googleMapsUrl } from '../services/maps'
import { wide } from '../services/viewport'
import { type Phrase, SITUATION_LABEL } from '../services/prep'
import { overlapping, dateRange } from '../services/timed'
import { dayCount, dayDate, dayPref, shortDate, type Stop } from '../services/trip'
import { useCatalogStore } from '../stores/catalog'
import { useFindsStore } from '../stores/finds'
import { useUserStore } from '../stores/user'
import BackLink from '../components/BackLink.vue'
import SkeletonRows from '../components/SkeletonRows.vue'

// 旅前小書（UX-FLOW.md D6）：把行程與旅前準備排成可以列印、存成 PDF 的小冊子。
// 用瀏覽器的列印（存成 PDF），不經過伺服器。紙張 A5（對折成小冊）或 A4；各段可以取捨。
const props = defineProps<{ id: string }>()
const userStore = useUserStore()
const { trip, prefs, details, byId, phrases, words, loading } = usePrep(() => props.id)
const catalog = useCatalogStore()
const finds = useFindsStore()
onMounted(() => void catalog.loadTimed())

const paper = ref<'A5' | 'A4'>('A5')
const onlyMust = ref(false)
const parts = ref({ days: true, phrases: true, words: true, limited: true, notes: true })
const PARTS = [
  { key: 'days', label: '行程' },
  { key: 'phrases', label: '會話' },
  { key: 'words', label: '地區特色' },
  { key: 'limited', label: '期間限定' },
  { key: 'notes', label: '筆記' },
] as const

// 手機（<1024）：紙張與各段勾選收進「內容 ▾」，工具列只留一列（旅前準備・內容・列印）
const contentBtn = ref<HTMLButtonElement | null>(null)
const contentPanel = ref<HTMLElement | null>(null)
const { open: contentOpen, style: contentStyle, side: contentSide, origin: contentOrigin } = useFloating(contentBtn, contentPanel)
watch(contentOpen, async (o) => {
  if (!o) return
  await nextTick()
  contentPanel.value?.querySelector<HTMLElement>('button, input')?.focus()
})
function closeContent() {
  contentOpen.value = false
  contentBtn.value?.focus()
}
watch(wide, (w) => w && (contentOpen.value = false))

// 列印的紙張大小：@page 只能寫在樣式表裡，這一頁開著時加一段 <style>
const pageStyle = document.createElement('style')
onMounted(() => document.head.append(pageStyle))
onBeforeUnmount(() => pageStyle.remove())
watchEffect(() => {
  pageStyle.textContent = `@page { size: ${paper.value}; margin: ${paper.value === 'A5' ? '11mm 12mm' : '16mm 18mm'}; }`
})

// 存成 PDF 時預設檔名取自頁面標題
watch(
  () => trip.value?.name,
  (n) => (document.title = `${n || '未命名行程'} 旅前小書`),
  { immediate: true },
)

const dates = computed(() => {
  const t = trip.value
  if (!t?.start_date) return ''
  const e = t.end_date && t.end_date !== t.start_date ? t.end_date : ''
  return e ? `${t.start_date.replaceAll('-', '/')} – ${e.slice(5).replace('-', '/')}` : t.start_date.replaceAll('-', '/')
})
const days = computed(() => (trip.value ? (dayCount(trip.value.start_date, trip.value.end_date) ?? trip.value.days.length) : 0))
const prefNames = computed(() => prefs.value.map((p) => regionOf(p)).filter((r) => r !== undefined))
const band = computed(() => {
  const w = new Map<string, number>()
  for (const d of trip.value?.days ?? []) {
    const p = dayPref(d)
    if (p) w.set(p, (w.get(p) ?? 0) + 1)
  }
  for (const p of prefs.value) if (!w.has(p)) w.set(p, 0.5)
  return [...w.entries()]
})

/** 行程的一站：名稱、念法、最近車站 */
function stopInfo(s: Stop) {
  const d = details.value.get(s.spot_id)
  const m = byId.value.get(s.spot_id)
  const st = d?.nearest_stations?.[0]
  return {
    ja: d?.name.ja ?? m?.n ?? s.name,
    kana: d?.name.kana ?? m?.h,
    romaji: d?.name.romaji ?? m?.r,
    zh: d && d.name.zh_tw !== d.name.ja ? d.name.zh_tw : undefined,
    station: st ? { ja: st.name.ja, kana: st.name.kana, m: st.distance_m } : undefined,
    maps: googleMapsUrl(d?.name.ja ?? s.name, s.pref),
  }
}

const shownPhrases = computed(() => phrases.value.filter((p) => !onlyMust.value || p.priority === 1))
const TABS = [
  { key: 'hear', label: '聽', sub: '會聽到的' },
  { key: 'say', label: '說', sub: '要開口說的' },
  { key: 'read', label: '讀', sub: '招牌、包裝、站牌' },
] as const
const phraseGroups = computed(() =>
  TABS.map((t) => {
    const out = new Map<string, Phrase[]>()
    for (const p of shownPhrases.value.filter((x) => x.direction === t.key))
      out.set(p.context.situation, [...(out.get(p.context.situation) ?? []), p])
    const order = Object.keys(SITUATION_LABEL)
    const rank = (s: string) => (order.includes(s) ? order.indexOf(s) : order.length)
    return { ...t, groups: [...out.entries()].sort((a, b) => rank(a[0]) - rank(b[0])) }
  }).filter((t) => t.groups.length),
)

const timed = computed(() => {
  const t = trip.value
  if (!t?.start_date) return []
  return overlapping(catalog.timed ?? [], t.start_date, t.end_date ?? t.start_date, prefs.value)
})
// 截圖用原圖（縮圖印出來太糊）
const tripFinds = computed(() => finds.forTrip(props.id))
const fullImages = ref<Record<string, string>>({})
watch(
  tripFinds,
  async (list) => {
    for (const f of list) {
      if (fullImages.value[f.id]) continue
      const data = await finds.image(f.id)
      if (data) fullImages.value = { ...fullImages.value, [f.id]: data }
    }
  },
  { immediate: true },
)
const hasLimited = computed(() => timed.value.length > 0 || tripFinds.value.length > 0)

function print() {
  window.print()
}
</script>

<template>
  <div v-if="trip" :data-pref="prefs[0]" class="flex flex-col bg-surface print:block print:bg-transparent">
    <!-- 工具列：只在螢幕上 -->
    <div class="sticky top-0 z-10 border-b border-line bg-paper print:hidden">
      <div class="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3 max-lg:flex-nowrap max-lg:gap-x-2 max-sm:px-4">
        <BackLink :to="`/trips/${trip.id}/prep`">旅前準備</BackLink>
        <button
          v-if="!wide"
          ref="contentBtn"
          type="button"
          class="flex h-9 shrink-0 items-center gap-1 rounded-control border border-line bg-paper pr-2 pl-3 text-body-sm text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
          aria-haspopup="dialog"
          :aria-expanded="contentOpen"
          @click="contentOpen = !contentOpen"
        >
          內容
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="text-sub" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div v-if="wide" class="flex items-center gap-1 text-body-sm" role="group" aria-label="紙張">
          <button
            v-for="p in ['A5', 'A4'] as const"
            :key="p"
            type="button"
            class="h-8 rounded-control px-2.5 font-latin active:not-disabled:translate-y-px pointer-coarse:h-tap"
            :class="paper === p ? 'bg-region-tint font-bold text-ink' : 'text-sub hover:text-ink'"
            :aria-pressed="paper === p"
            @click="paper = p"
          >
            {{ p }}
          </button>
        </div>
        <div v-if="wide" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm">
          <label v-for="p in PARTS" :key="p.key" class="flex cursor-pointer items-center gap-1.5 pointer-coarse:min-h-tap">
            <input v-model="parts[p.key]" type="checkbox" class="size-4 accent-(--region-strong)" />
            {{ p.label }}
          </label>
          <label class="flex cursor-pointer items-center gap-1.5 border-l border-line pl-3 pointer-coarse:min-h-tap">
            <input v-model="onlyMust" type="checkbox" class="size-4 accent-(--region-strong)" />
            只放必備會話
          </label>
        </div>
        <button
          type="button"
          class="ml-auto h-10 shrink-0 rounded-control bg-region-strong px-4 text-body-sm font-bold whitespace-nowrap text-white active:translate-y-px pointer-coarse:h-tap"
          @click="print"
        >
          列印／存成 PDF
        </button>
      </div>
    </div>
    <Teleport to="body">
      <div
        v-if="contentOpen"
        ref="contentPanel"
        :data-pref="prefs[0]"
        data-floating
        data-reduce="fade"
        class="fixed z-50 flex min-w-52 flex-col rounded-card bg-paper p-1.5 text-body-sm text-ink shadow-float print:hidden"
        :class="contentSide === 'top' ? 'animate-pop-up' : 'animate-pop-in'"
        :style="{ ...contentStyle, transformOrigin: contentOrigin }"
        role="dialog"
        aria-label="內容"
        @keydown.esc.stop.prevent="closeContent"
      >
        <div class="flex min-h-tap items-center gap-3 px-3" role="group" aria-label="紙張">
          <span class="flex-1 text-sub">紙張</span>
          <button
            v-for="p in ['A5', 'A4'] as const"
            :key="p"
            type="button"
            class="h-tap rounded-control px-3 font-latin active:not-disabled:translate-y-px"
            :class="paper === p ? 'bg-region-tint font-bold text-ink' : 'text-sub'"
            :aria-pressed="paper === p"
            @click="paper = p"
          >
            {{ p }}
          </button>
        </div>
        <div class="mx-1 my-1 border-t border-line-soft" role="none"></div>
        <label v-for="p in PARTS" :key="p.key" class="flex min-h-tap cursor-pointer items-center gap-3 rounded-control px-3 active:bg-surface">
          <input v-model="parts[p.key]" type="checkbox" class="size-4 accent-(--region-strong)" />
          {{ p.label }}
        </label>
        <div class="mx-1 my-1 border-t border-line-soft" role="none"></div>
        <label class="flex min-h-tap cursor-pointer items-center gap-3 rounded-control px-3 active:bg-surface">
          <input v-model="onlyMust" type="checkbox" class="size-4 accent-(--region-strong)" />
          只放必備會話
        </label>
      </div>
    </Teleport>

    <SkeletonRows v-if="loading" :rows="4" class="mx-auto w-full max-w-3xl px-6 pt-6 print:hidden" />

    <!-- 紙面：螢幕上照紙寬預覽，列印時交給 @page -->
    <article
      class="mx-auto mt-8 mb-24 flex max-w-full flex-col bg-white text-ink shadow-float [print-color-adjust:exact] print:my-0 print:block print:w-auto print:max-w-none print:p-0 print:shadow-none"
      :class="paper === 'A5' ? 'w-[148mm] px-[12mm] py-[11mm] text-[13px]' : 'w-[210mm] px-[18mm] py-[16mm] text-[14px]'"
    >
      <!-- 封面 -->
      <section class="flex flex-col" :class="paper === 'A5' ? 'min-h-[170mm] print:min-h-[184mm]' : 'min-h-[250mm] print:min-h-[262mm]'">
        <div class="flex h-3 w-full overflow-hidden rounded-tag" aria-hidden="true">
          <span v-for="[p, w] in band" :key="p" :data-pref="p" class="h-full bg-region" :style="{ flexGrow: w }"></span>
        </div>
        <div class="mt-[18mm] flex flex-col gap-3">
          <span class="text-body-sm font-bold tracking-section text-sub">旅前小書</span>
          <h1 class="text-h1 leading-tight font-black tracking-title">{{ trip.name || '未命名行程' }}</h1>
          <p v-if="dates" class="font-latin text-title">
            {{ dates }}<span class="ml-2 font-sans text-body-sm text-sub">{{ days }} 天</span>
          </p>
        </div>
        <ul class="mt-8 flex flex-wrap gap-x-5 gap-y-3">
          <li v-for="r in prefNames" :key="r.prefecture" :data-pref="r.prefecture" class="flex items-center gap-2">
            <span class="size-3 rounded-full bg-region" aria-hidden="true"></span>
            <span class="flex flex-col leading-tight">
              <span lang="ja" class="text-caption tracking-kana text-sub">{{ r.name.kana }}</span>
              <span lang="ja" class="text-title font-black">{{ r.name.ja }}</span>
            </span>
          </li>
        </ul>
        <div class="mt-auto flex items-end justify-between pt-10">
          <span class="flex flex-col leading-none">
            <span lang="ja" class="mb-[3px] text-[9px] tracking-[3px] text-sub">ひとめぐり</span>
            <span lang="ja" class="text-[18px] font-black tracking-[2px]">一巡り</span>
          </span>
          <span class="font-latin text-caption tracking-[3px] text-sub uppercase">Hitomeguri</span>
        </div>
      </section>

      <!-- 行程：每天的停留點、念法、最近車站 -->
      <section v-if="parts.days" class="mt-8 break-before-page border-t border-dashed border-line pt-8 print:mt-0 print:border-0 print:pt-0">
        <h2 class="mb-4 border-b-2 border-ink pb-1.5 text-h3 font-black tracking-title">行程</h2>
        <div v-for="(d, i) in trip.days" :key="i" class="mb-5 break-inside-avoid-page">
          <div class="mb-2 flex items-center gap-3" :data-pref="dayPref(d) ?? prefs[0]">
            <span class="grid size-10 shrink-0 place-items-center rounded-badge bg-region text-on-region leading-none">
              <span class="flex flex-col items-center font-latin font-bold">
                <span class="text-[9px]">DAY</span><span class="text-[16px]">{{ i + 1 }}</span>
              </span>
            </span>
            <span v-if="dayDate(trip, i)" class="font-latin text-title font-bold">{{ shortDate(dayDate(trip, i)!) }}</span>
          </div>
          <ol v-if="d.stops.length" class="flex flex-col">
            <li v-for="(s, j) in d.stops" :key="s.spot_id + j" class="flex gap-3 border-b border-line-soft py-2 break-inside-avoid last:border-b-0">
              <span class="w-5 shrink-0 pt-3 text-right font-latin font-bold text-sub">{{ j + 1 }}</span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span v-if="stopInfo(s).kana" lang="ja" class="text-[0.85em] tracking-kana text-sub">{{ stopInfo(s).kana }}</span>
                <a :href="stopInfo(s).maps" lang="ja" class="w-fit text-[1.15em] font-black text-ink no-underline pointer-coarse:-my-3 pointer-coarse:py-3">{{ stopInfo(s).ja }}</a>
                <span class="text-[0.85em] text-sub">
                  <template v-if="stopInfo(s).zh">{{ stopInfo(s).zh }}</template>
                  <template v-if="stopInfo(s).zh && stopInfo(s).romaji">・</template>
                  <span class="font-latin">{{ stopInfo(s).romaji }}</span>
                </span>
                <span v-if="stopInfo(s).station" class="mt-0.5 text-[0.85em]">
                  <span class="text-sub">最寄駅</span>
                  <span lang="ja" class="ml-1.5 font-bold">{{ stopInfo(s).station!.ja }}</span>
                  <span v-if="stopInfo(s).station!.kana" lang="ja" class="ml-1 text-sub">{{ stopInfo(s).station!.kana }}</span>
                  <span class="ml-1 font-latin text-sub">{{ Math.round(stopInfo(s).station!.m / 10) * 10 }} m</span>
                </span>
              </span>
            </li>
          </ol>
          <p v-else class="text-[0.9em] text-sub">這天還沒有地點</p>
        </div>
        <div v-if="trip.unscheduled.length" class="break-inside-avoid-page">
          <h3 class="mb-1 flex items-center gap-2 text-[0.85em] font-bold tracking-section text-sub">待排</h3>
          <ul class="flex flex-col">
            <li v-for="s in trip.unscheduled" :key="s.spot_id" class="border-b border-line-soft py-1.5 last:border-b-0">
              <span lang="ja" class="font-bold">{{ stopInfo(s).ja }}</span>
              <span v-if="stopInfo(s).kana" lang="ja" class="ml-2 text-[0.85em] text-sub">{{ stopInfo(s).kana }}</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- 會話：聽／說／讀，依情境 -->
      <section v-if="parts.phrases && phraseGroups.length" class="mt-8 break-before-page border-t border-dashed border-line pt-8 print:mt-0 print:border-0 print:pt-0">
        <h2 class="mb-4 border-b-2 border-ink pb-1.5 text-h3 font-black tracking-title">會話</h2>
        <div v-for="t in phraseGroups" :key="t.key" class="mb-4">
          <h3 class="mb-1 flex items-baseline gap-2 text-title font-black">
            {{ t.label }}<span class="text-[0.85em] font-normal text-sub">{{ t.sub }}</span>
          </h3>
          <div v-for="[situation, items] in t.groups" :key="situation" class="mb-3">
            <h4 class="mb-1 flex items-center gap-2 text-[0.85em] font-bold tracking-section text-sub">{{ SITUATION_LABEL[situation] ?? situation }}</h4>
            <!-- 「讀」多是單字，排兩欄 -->
            <ul :class="t.key === 'read' ? 'grid grid-cols-2 gap-x-5' : 'flex flex-col'">
              <li v-for="p in items" :key="p.id" class="flex flex-col border-b border-line-soft py-1.5 break-inside-avoid">
                <span lang="ja" class="text-[0.8em] tracking-kana text-sub">{{ p.kana }}</span>
                <span lang="ja" class="text-[1.1em] font-bold">{{ p.ja }}</span>
                <span class="text-[0.9em] text-ink-2">{{ p.zh_tw }}</span>
                <span v-if="p.answer_hint" class="mt-1 w-fit rounded-tag border border-ink px-2 py-0.5 text-[0.85em]">
                  <span lang="ja">{{ p.answer_hint.ja }}</span>
                  <span class="ml-2 text-sub">{{ p.answer_hint.zh_tw }}</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
        <p class="text-[0.8em] text-sub">會話為編輯整理，尚待校對。</p>
      </section>

      <!-- 地區特色詞 -->
      <section v-if="parts.words && words.length" class="mt-8 break-before-page border-t border-dashed border-line pt-8 print:mt-0 print:border-0 print:pt-0">
        <h2 class="mb-4 border-b-2 border-ink pb-1.5 text-h3 font-black tracking-title">地區特色</h2>
        <ul class="grid grid-cols-2 gap-x-5">
          <li v-for="w in words" :key="w.key" class="flex flex-col border-b border-line-soft py-1.5 break-inside-avoid">
            <span lang="ja" class="text-[0.8em] tracking-kana text-sub">{{ w.kana }}</span>
            <span lang="ja" class="font-bold">{{ w.ja }}</span>
            <span v-if="w.zh" class="text-[0.85em] text-sub">{{ w.zh }}</span>
          </li>
        </ul>
      </section>

      <!-- 期間限定：季節觀測與截圖 -->
      <section v-if="parts.limited && hasLimited" class="mt-8 break-before-page border-t border-dashed border-line pt-8 print:mt-0 print:border-0 print:pt-0">
        <h2 class="mb-4 border-b-2 border-ink pb-1.5 text-h3 font-black tracking-title">期間限定</h2>
        <ul v-if="timed.length" class="mb-4 flex flex-col">
          <li v-for="t in timed" :key="t.id" class="flex items-baseline gap-3 border-b border-line-soft py-1.5 break-inside-avoid last:border-b-0">
            <span class="flex min-w-0 flex-1 flex-col">
              <span lang="ja" class="font-bold">{{ t.title.ja }}</span>
              <span v-if="t.summary_zh" class="text-[0.85em] text-ink-2">{{ t.summary_zh }}</span>
            </span>
            <span class="shrink-0 font-latin text-[0.85em] text-sub">{{ dateRange(t) }}</span>
          </li>
        </ul>
        <p v-if="timed.some((t) => t.source_label)" lang="ja" class="mb-4 text-[0.75em] text-sub">
          {{ timed.find((t) => t.source_label)?.source_label }}
        </p>
        <div v-if="tripFinds.length" class="grid grid-cols-2 gap-4">
          <figure v-for="f in tripFinds" :key="f.id" class="flex flex-col gap-1 break-inside-avoid">
            <img :src="fullImages[f.id] ?? f.thumb" alt="" class="max-h-[80mm] w-full rounded-tag object-contain object-top" />
            <figcaption class="flex flex-col">
              <span v-if="f.brand" class="text-[0.8em] text-sub">{{ f.brand }}</span>
              <span v-if="f.item" class="font-bold">{{ f.item }}</span>
              <span v-if="f.note" class="text-[0.85em] whitespace-pre-line text-ink-2">{{ f.note }}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <!-- 筆記頁 -->
      <section v-if="parts.notes" class="mt-8 break-before-page border-t border-dashed border-line pt-8 print:mt-0 print:border-0 print:pt-0">
        <h2 class="mb-4 border-b-2 border-ink pb-1.5 text-h3 font-black tracking-title">筆記</h2>
        <div
          :class="paper === 'A5' ? 'h-[150mm]' : 'h-[220mm]'"
          :style="{
            backgroundImage: 'linear-gradient(to bottom, transparent calc(100% - 1px), var(--region-line) calc(100% - 1px))',
            backgroundSize: '100% 9mm',
          }"
          aria-hidden="true"
        ></div>
      </section>
    </article>
  </div>
  <section v-else class="mx-auto w-full max-w-3xl px-6 py-9">
    <p v-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
  </section>
</template>

