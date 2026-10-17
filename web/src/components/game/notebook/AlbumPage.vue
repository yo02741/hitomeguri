<script setup lang="ts">
import { computed, nextTick, ref, watchEffect } from 'vue'

import type { Button } from '../../../game/engine/input'
import { downloadPhoto, loadThumb } from '../../../game/systems/photoStore'
import { type AlbumPageData, dateText, type PhotoEntry, SEASON_LABEL, TIME_LABEL } from '../../../game/ui/notebook'

import { useRows } from './rows'

// 手帳「相簿」（規格 §8.4）：一個地標一頁，六格（平常、春櫻、秋楓、雪、夜、祭典）。說明只寫資料裡的地名＋遊戲日期與時段。
// 照片按 A（或點）放大看，可以存成 PNG。照片在 IndexedDB（systems/photoStore），這裡讀縮圖。
const props = defineProps<{ data: AlbumPageData }>()
const root = ref<HTMLElement | null>(null)
const rows = useRows(root)
const urls = ref<Record<string, string | null>>({})
const open = ref<PhotoEntry | null>(null)
const status = ref('')
const closeEl = ref<HTMLButtonElement | null>(null)
let back: HTMLElement | null = null

const pages = computed(() => props.data.pages ?? [])
watchEffect(() => {
  const ids = [...pages.value.flatMap((p) => p.slots.map((s) => s.photo?.id)), ...props.data.photos.map((p) => p.id)].filter((x): x is string => !!x)
  for (const id of ids) if (!(id in urls.value)) void loadThumb(id).then((u) => (urls.value = { ...urls.value, [id]: u }))
})
const src = (p: PhotoEntry) => p.thumb ?? urls.value[p.id] ?? null

function show(p: PhotoEntry) {
  back = document.activeElement as HTMLElement | null
  open.value = p
  status.value = ''
  void nextTick(() => closeEl.value?.focus({ preventScroll: true }))
}
function hide() {
  open.value = null
  void nextTick(() => back?.focus({ preventScroll: true }))
}
async function save() {
  const p = open.value
  if (!p) return
  const d = p.date
  const ok = await downloadPhoto(p.id, `${p.spot.ja}-${d.y}${String(d.m).padStart(2, '0')}${String(d.d).padStart(2, '0')}`)
  status.value = ok ? '存好了。' : '這次沒有存到。'
}

function press(b: Button): boolean {
  if (open.value) {
    if (b === 'B' || b === 'A') hide()
    return true
  }
  if (b === 'left') return rows.move('up')
  if (b === 'right') return rows.move('down') || true
  if (rows.move(b)) return true
  if (b === 'A') {
    const a = document.activeElement
    if (a instanceof HTMLButtonElement && root.value?.contains(a)) a.click()
    return true
  }
  return false
}
defineExpose({ focusFirst: rows.focusFirst, press })

const caption = (p: PhotoEntry) => `${dateText(p.date)}・${TIME_LABEL[p.time]}・${SEASON_LABEL[p.season]}`
</script>

<template>
  <div ref="root" class="nb-page album">
    <p v-if="!data.photos.length && !pages.length" class="nb-empty">還沒有拍過照片。</p>
    <section v-for="pg in pages" v-show="!open" :key="pg.key" class="album-page" :aria-labelledby="`al-${pg.key}`">
      <h3 :id="`al-${pg.key}`" class="album-title">
        <span lang="ja">{{ pg.name.ja }}</span>
        <span v-if="pg.name.zh && pg.name.zh !== pg.name.ja" class="nb-sub">　{{ pg.name.zh }}</span>
      </h3>
      <ul class="album-grid">
        <li v-for="s in pg.slots" :key="s.slot" class="album-slot" :class="{ 'is-empty': !s.photo }">
          <button v-if="s.photo" type="button" class="album-btn" data-row :aria-label="`${s.label}　${caption(s.photo)}　放大看`" @click="show(s.photo)">
            <img v-if="src(s.photo)" :src="src(s.photo)!" class="album-img" alt="" width="240" height="160" />
            <span v-else class="album-img" aria-hidden="true"></span>
            <span class="album-label">{{ s.label }}</span>
          </button>
          <span v-else class="album-label nb-sub">{{ s.label }}</span>
        </li>
      </ul>
    </section>

    <div v-if="open" class="gba-box album-zoom" role="dialog" :aria-label="open.spot.ja">
      <img v-if="src(open)" :src="src(open)!" class="album-big" :alt="open.spot.ja" width="240" height="160" />
      <p class="album-cap">
        <span lang="ja">{{ open.spot.ja }}</span><br />
        <span class="nb-sub">{{ caption(open) }}<template v-if="open.score !== undefined">　{{ open.score }} 分</template><template v-if="open.together">　合照</template></span>
      </p>
      <div class="album-acts">
        <button ref="closeEl" type="button" class="nb-btn" @click="hide">收起</button>
        <button type="button" class="nb-btn" @click="save">存成 PNG</button>
        <p class="sys-status" role="status">{{ status }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.album {
  position: relative;
}
.album-page {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
}
.album-title {
  margin: 0;
  font-size: 1em;
  font-weight: 700;
}
.album-grid {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5em;
}
.album-slot {
  display: flex;
  flex-direction: column;
}
.album-slot.is-empty {
  justify-content: flex-end;
  aspect-ratio: 3 / 2.4;
  padding: 0.3em;
  border: 2px dashed var(--color-px-stone-1);
  border-radius: 3px;
}
.album-btn {
  display: flex;
  flex-direction: column;
  gap: 0.15em;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: zoom-in;
}
.album-img {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 2;
  height: auto;
  object-fit: cover;
  image-rendering: pixelated;
  background: var(--color-px-paper);
  border: 2px solid var(--color-px-ink);
}
.album-label {
  font-size: 0.8em;
}
.album-zoom {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  padding: 0.7em 0.8em;
}
.album-big {
  display: block;
  width: 100%;
  max-width: 16em;
  height: auto;
  image-rendering: pixelated;
  border: 2px solid var(--color-px-ink);
}
.album-cap {
  margin: 0;
}
.album-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6em;
  align-items: center;
}
</style>
