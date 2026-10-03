<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Dropdown from './Dropdown.vue'

import { prepareImage, type PreparedImage } from '../services/image'
import { tripStatus } from '../services/trip'
import { todayIso } from '../services/userdb'
import { type Find, FIND_LIMITS, useFindsStore } from '../stores/finds'
import { useTripsStore } from '../stores/trips'

// 新增或編輯一張截圖（UX-FLOW.md D5）。新增時可以一次選多張，逐張填品牌、品項、說明；
// 品牌與行程沿用上一張。也可以把圖片拖進來或直接貼上。
const props = defineProps<{ open: boolean; find?: Find | null; tripId?: string }>()
const emit = defineEmits<{ 'update:open': [open: boolean]; saved: [id: string] }>()
const finds = useFindsStore()
const trips = useTripsStore()

const dialog = ref<HTMLDialogElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const queue = ref<File[]>([])
const index = ref(0)
const prepared = ref<PreparedImage | null>(null)
const preview = ref('')
const busy = ref(false)
const failed = ref(false)
const brand = ref('')
const item = ref('')
const note = ref('')
const trip = ref('')

const editing = computed(() => Boolean(props.find))
const tripOptions = computed(() =>
  trips.sorted.filter((t) => tripStatus(t, todayIso()) !== 'done' || t.id === trip.value || t.id === props.tripId),
)
const brandOptions = computed(() => [...new Set([...finds.brands, '7-11', '全家', 'LAWSON', '麥當勞'])])
const brandSuggestions = computed(() => brandOptions.value.filter((b) => b !== brand.value && (!brand.value || b.startsWith(brand.value))).slice(0, 8))

watch(
  () => props.open,
  async (o) => {
    if (!o) {
      dialog.value?.close()
      return
    }
    reset()
    brand.value = props.find?.brand ?? ''
    item.value = props.find?.item ?? ''
    note.value = props.find?.note ?? ''
    trip.value = props.find ? (props.find.trip_id ?? '') : (props.tripId ?? '')
    if (props.find) preview.value = props.find.thumb
    await nextTick()
    dialog.value?.showModal()
  },
)

function reset() {
  queue.value = []
  index.value = 0
  prepared.value = null
  setPreview('')
  failed.value = false
}

function setPreview(url: string) {
  if (preview.value.startsWith('blob:')) URL.revokeObjectURL(preview.value)
  preview.value = url
}
onBeforeUnmount(() => setPreview(''))

async function load(file: File | undefined) {
  prepared.value = null
  failed.value = false
  if (!file) return
  setPreview(URL.createObjectURL(file))
  busy.value = true
  try {
    prepared.value = await prepareImage(file)
  } catch (e) {
    console.error(e)
    failed.value = true
  } finally {
    busy.value = false
  }
}

function take(files: Iterable<File>) {
  const list = [...files].filter((f) => f.type.startsWith('image/'))
  if (!list.length) return
  queue.value = list
  index.value = 0
  void load(list[0])
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  take(input.files ?? [])
  input.value = ''
}
function onDrop(e: DragEvent) {
  if (!editing.value) take(e.dataTransfer?.files ?? [])
}
function onPaste(e: ClipboardEvent) {
  if (editing.value) return
  const files = [...(e.clipboardData?.items ?? [])].flatMap((i) => (i.kind === 'file' ? (i.getAsFile() ?? []) : []))
  if (files.length) {
    e.preventDefault()
    take(files)
  }
}

async function save() {
  const fields = { brand: brand.value, item: item.value, note: note.value, trip_id: trip.value || undefined }
  if (props.find) {
    await finds.update(props.find.id, fields)
    if (!finds.error) close()
    return
  }
  if (!prepared.value) return
  busy.value = true
  const id = await finds.add(prepared.value, fields)
  busy.value = false
  if (!id) return
  emit('saved', id)
  // 下一張：品牌、行程沿用
  if (index.value + 1 < queue.value.length) {
    index.value += 1
    item.value = ''
    note.value = ''
    void load(queue.value[index.value])
  } else close()
}
function skip() {
  if (index.value + 1 < queue.value.length) {
    index.value += 1
    void load(queue.value[index.value])
  } else close()
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-card bg-paper p-0 text-ink shadow-float backdrop:bg-ink/40"
    :aria-label="editing ? '編輯截圖' : '新增截圖'"
    @cancel.prevent="close"
    @paste="onPaste"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <form class="flex max-h-[calc(100dvh-32px)] flex-col" @submit.prevent="save">
      <div class="flex h-14 shrink-0 items-center gap-3 border-b border-line-soft px-5">
        <h2 class="text-title font-black">{{ editing ? '編輯截圖' : '新增截圖' }}</h2>
        <span v-if="queue.length > 1" class="font-latin text-body-sm text-sub">{{ index + 1 }} / {{ queue.length }}</span>
        <button
          type="button"
          class="ml-auto grid size-9 place-items-center rounded-control text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:size-tap"
          aria-label="關閉"
          @click="close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <div class="scroll-quiet flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        <button
          v-if="!preview"
          type="button"
          class="flex h-48 flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line bg-surface text-body-sm text-sub hover:border-region-strong hover:text-ink active:not-disabled:translate-y-px"
          @click="fileInput?.click()"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M20.5 16l-5-5-8.5 8.5" />
          </svg>
          選擇圖片
        </button>
        <div v-else class="relative grid max-h-[46dvh] place-items-center overflow-hidden rounded-card bg-surface">
          <img :src="preview" alt="" class="max-h-[46dvh] w-auto max-w-full object-contain" />
          <span v-if="busy" class="absolute inset-x-0 bottom-0 bg-ink/60 py-1.5 text-center text-caption text-white">處理中</span>
          <button
            v-if="!editing && queue.length <= 1"
            type="button"
            class="absolute top-2 right-2 h-8 rounded-control bg-paper/90 px-2.5 text-caption text-ink shadow-float hover:bg-paper active:not-disabled:translate-y-px pointer-coarse:h-tap"
            @click="fileInput?.click()"
          >
            換一張
          </button>
        </div>
        <p v-if="failed" class="text-caption text-danger" role="alert">無法讀取這張圖片</p>
        <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onPick" />

        <label class="flex flex-col gap-1 text-caption text-sub">
          品牌
          <input
            v-model="brand"
            type="text"
            :maxlength="FIND_LIMITS.brand"
            class="h-10 rounded-control border border-line bg-paper px-3 text-body-sm text-ink outline-none focus:border-region-strong pointer-coarse:h-tap"
          />
          <!-- 用過的品牌：點了帶入（取代原生 datalist） -->
          <span v-if="brandSuggestions.length" class="flex flex-wrap gap-1.5 pt-1">
            <button
              v-for="b in brandSuggestions"
              :key="b"
              type="button"
              class="h-7 rounded-full border border-line bg-paper px-2.5 text-caption text-ink hover:bg-surface active:not-disabled:translate-y-px"
              @click="brand = b"
            >
              {{ b }}
            </button>
          </span>
        </label>
        <label class="flex flex-col gap-1 text-caption text-sub">
          品項
          <input
            v-model="item"
            type="text"
            :maxlength="FIND_LIMITS.item"
            class="h-10 rounded-control border border-line bg-paper px-3 text-body-sm text-ink outline-none focus:border-region-strong pointer-coarse:h-tap"
          />
        </label>
        <label class="flex flex-col gap-1 text-caption text-sub">
          說明
          <textarea
            v-model="note"
            rows="3"
            :maxlength="FIND_LIMITS.note"
            class="resize-y rounded-control border border-line bg-paper px-3 py-2 text-body-sm text-ink outline-none focus:border-region-strong"
          ></textarea>
        </label>
        <label v-if="tripOptions.length" class="flex flex-col gap-1 text-caption text-sub">
          行程
          <Dropdown
            v-model="trip"
            :options="[{ value: '', label: '不指定' }, ...tripOptions.map((t) => ({ value: t.id, label: t.name || '未命名行程' }))]"
            label="行程"
            class="w-full"
          />
        </label>
        <p v-if="finds.error" class="text-caption text-danger" role="alert">{{ finds.error }}</p>
      </div>

      <div class="flex shrink-0 items-center justify-end gap-2 border-t border-line-soft px-5 py-3">
        <button
          v-if="queue.length > 1"
          type="button"
          class="h-10 rounded-control px-3.5 text-body-sm text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap"
          @click="skip"
        >
          略過這張
        </button>
        <button
          type="submit"
          class="h-10 rounded-control bg-region-strong px-5 text-body-sm font-bold text-white active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:h-tap"
          :disabled="busy || (!editing && !prepared)"
        >
          儲存
        </button>
      </div>
    </form>
  </dialog>
</template>
