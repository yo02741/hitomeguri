<script setup lang="ts">
import '../components/game/gba.css'

import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef, watch } from 'vue'

import DialogBox from '../components/game/DialogBox.vue'
import Notebook from '../components/game/Notebook.vue'
import PlaceSign from '../components/game/PlaceSign.vue'
import SystemsLayer from '../components/game/SystemsLayer.vue'
import TitleScreen from '../components/game/TitleScreen.vue'
import TouchPad from '../components/game/TouchPad.vue'
import { createGameAudio, suspendWhenHidden } from '../game/audio'
import { useTravellerSprites } from '../game/avatar'
import { type AskEvent, Game, type SayEvent } from '../game/engine'
import type { MapSource } from '../game/engine/game'
import { type Button, KEYMAP } from '../game/engine/input'
import { localStore, saveKey } from '../game/engine/save'
import { type Dir, type MapName, passable, VIEW_H } from '../game/engine/types'
import type { FlavourBloom } from '../game/content/flavour'
import { arrivalJingle, loadPlayWorld, playMaps } from '../game/play/world'
import { registerDefaultLooks } from '../game/sprites'
import { useGameSystems } from '../game/systems'
import { GAME_UI, type GameUiContext } from '../game/ui/context'
import type { DialogLine } from '../game/ui/dialog'
import { loadGameFont } from '../game/ui/font'
import { fitScreen, type Layout, layoutOf } from '../game/ui/layout'
import { notebookData, type NotebookData, type NotebookPageId } from '../game/ui/notebook'
import { loadUi, saveUi, toEngine, uiStorage, type UiSettings } from '../game/ui/settings'
import { moodOf, sfxOf, songOf } from '../game/ui/sound'
import { charsPerSecond } from '../game/ui/text'
import { gateStore, type TitleChoice } from '../game/ui/title'
import { BUNDLES, type GameWorld, type PrefData } from '../game/world'
import { prefetchedGame } from '../services/playPrefetch'
import { readTokens } from '../services/pixelwalk/palette'
import { useCatalogStore } from '../stores/catalog'
import { useUserStore } from '../stores/user'

// 番外篇（像素遊戲，規格 §1–§6）的頁面：畫面（canvas，整數倍放大）、標題、對話框、地名牌、旅人手帳、暫停、手機的十字鍵與 A/B、聲音。
// 遊戲本身是 game/engine 的 Game（不碰 DOM）；這一頁把它的事件接到介面元件（components/game/），把按鍵交給它。
// 版面：桌機畫面置中；手機直拿畫面在上、控制區在下；打橫十字鍵與 A/B 分到畫面兩側（game/ui/layout.ts）。
// 頁面本身不捲動。標題畫面後面就是遊戲自己在走（存檔用 gateStore 擋住，按開始／繼續才寫）。
// 世界（P2，規格 §8）：京都、沖繩的 bundles 讀進來（game/play/world.ts）→ 鎮、室內、你的房間；新遊戲從京都駅的大廳開始。
// 系統（拍照、店、印、房間、委託）：useGameSystems＋SystemsLayer。資料還在讀、讀不到時標題畫面只寫一行。
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const coarse = typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)') : null
/** 打開手帳時聲音也停（規格 §6）。false：手帳裡照樣有游標聲、存檔聲，鎮曲壓低（MENU_DIM）不停 */
const SUSPEND_ON_MENU = false
/** 手帳打開時鎮曲壓到多少 */
const MENU_DIM = 0.45
const LOADING_TEXT = '讀取中'
const OFFLINE_TEXT = '資料讀不到，連上網路後再開一次。'

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const dialogRef = ref<InstanceType<typeof DialogBox> | null>(null)
const notebookRef = ref<InstanceType<typeof Notebook> | null>(null)
const titleRef = ref<InstanceType<typeof TitleScreen> | null>(null)

const scale = ref(3)
const width = ref(240)
/** 邏輯高（160；手機直拿時照可用高度變高，最多 256） */
const height = ref(VIEW_H)
/** 有觸控按鈕：pointer: coarse，或第一次用手指點 */
const touch = ref(!!coarse?.matches)
const layout = ref<Layout>('desktop')
const mode = ref<'boot' | 'title' | 'play'>('boot')
const failed = ref(false)
const hasSave = ref(false)
/** 世界的資料：讀中、好了、讀不到 */
const dataState = ref<'loading' | 'ready' | 'error'>('loading')
const titleStatus = computed(() => (dataState.value === 'loading' ? LOADING_TEXT : dataState.value === 'error' ? OFFLINE_TEXT : null))

const place = ref<MapName | null>(null)
const sign = ref<{ name: MapName; n: number } | null>(null)
const line = shallowRef<DialogLine | null>(null)
const menuOpen = ref(false)
const nbData = shallowRef<NotebookData | null>(null)
/** 手帳上次看的那一頁（這次打開時從這頁開始） */
const nbPage = ref<NotebookPageId>('map')
const userPaused = ref(false)
const livePlace = ref('')
const liveLine = ref('')
const fontEpoch = ref(0)
const savedAt = ref<number | null>(null)

const store = uiStorage()
const ui = reactive<UiSettings>(loadUi(store))
const cps = computed(() => charsPerSecond(ui.textSpeed, reduced))

const audio = createGameAudio()
/** DEV：放過的效果音與短曲（給 Playwright 檢查；正式版沒有） */
const soundLog: string[] = []
if (import.meta.env.DEV) {
  const { sfx, jingle } = audio
  audio.sfx = (n) => {
    soundLog.push(`sfx:${n}`)
    if (soundLog.length > 200) soundLog.splice(0, 100)
    sfx(n)
  }
  audio.jingle = (n) => {
    soundLog.push(`jingle:${n}`)
    jingle(n)
  }
}
const userStore = useUserStore()
const catalog = useCatalogStore()
// 你的旅人（規格 §7）：avatar store 只讀；生成好之前、失敗時是手畫的預設旅人與柴犬。
// 在 /play 換衣服（avatar store 改了）會重做；從 /log/avatar 換完再進來，這一頁重新掛上，也會用新的那一套。
// 3D 的側面（主執行緒連著忙幾百毫秒）：標題畫面、手帳打開、暫停、換地圖的時候才做（走路時不卡）
const traveller = useTravellerSprites({ whenQuiet: () => quiet() })
let quietWaiters: Array<() => void> = []
function quiet(): Promise<void> {
  if (isQuiet()) return Promise.resolve()
  return new Promise((r) => quietWaiters.push(r))
}
const isQuiet = () => mode.value !== 'play' || menuOpen.value || !!game?.paused
function wakeQuiet(force = false) {
  if (!quietWaiters.length || (!force && !isQuiet())) return
  const list = quietWaiters
  quietWaiters = []
  for (const r of list) r()
}

let game: Game | null = null
let gate: ReturnType<typeof gateStore> | null = null
let world: GameWorld | null = null
let worldPrefs: PrefData[] = []
/** DEV：P0 的測試小鎮（p0:town、p0:shop） */
let devMaps: MapSource | null = null
let uid: string | null = null
/** 抵達新鎮的短曲：坐車的話等到站之後 */
const arrive = arrivalJingle((n) => audio.jingle(n))

// 拍照、店、印、房間、委託（game/systems）：Game 建好之後、newGame 之前 install
const { systems, install: installSystems } = useGameSystems(() => ({
  prefs: worldPrefs,
  world: world?.world ?? null,
  maps: mapsOf(),
  travel: (g, link) => {
    const r = world && link.link ? startRide(g, link.link) : null
    if (!r) {
      arrive.reset()
      audio.sfx('error')
    }
  },
  jingle: (n) => arrive.jingle(n),
  festival: (g) => world?.festivalNow(g) ?? false,
  bloom: (g) => {
    if (!world) return null
    const b = world.bloomOf(g.clock.date, world.townOf(g.map?.id ?? '')?.id)
    return b.has('sakura') || b.has('kanhi') ? 'sakura' : b.has('kaede') || b.has('ichou') ? 'momiji' : null
  },
  // 路人講開花的話：平年值算的那一天開著的花
  flowers: (g) => (world ? (world.bloomOf(g.clock.date, world.townOf(g.map?.id ?? '')?.id) as Set<FlavourBloom>) : new Set()),
  // 委託：真的放上地圖、有告示牌與拍攝點的景點
  townSpots: (t) => world?.questSpotsOf(t) ?? [],
  reducedMotion: reduced,
}))
const mapsOf = (): MapSource => (world ? playMaps(world, devMaps) : () => null)

/** 坐車：地名牌收起來（不蓋在車窗上），抵達的短曲等到站之後 */
function startRide(g: Game, linkId: string) {
  if (!world) return null
  hideSign()
  arrive.ride()
  return world.travel(g, linkId, { onArrive: () => arrive.arrived() })
}
let ctx: CanvasRenderingContext2D | null = null
let image: ImageData | null = null
let imageOf: unknown = null
let raf = 0
let last = 0
let acc = 0
let signTimer = 0
let menuTimer = 0
let lineSeq = 0
let wantBgm: string | null = null
let pending: { kind: 'say'; resolve(): void } | { kind: 'ask'; resolve(i: number): void } | null = null
let detachKeys: (() => void) | null = null
let offHidden: (() => void) | null = null
/** 標題畫面時把還沒生成的鎮先做好（委託、第一次坐車不用等） */
let stopWarm: (() => void) | null = null
/** 世界停住（手帳、暫停）時畫面不變：不用每格重畫，有變動（設定、換頁、面板）才畫一次 */
let dirty = true
let pauseReasons: string[] = []
const markDirty = () => {
  dirty = true
}
const offs: Array<() => void> = []

const canvasLabel = computed(() => {
  if (mode.value !== 'play' || !place.value) return 'ひとめぐり 番外篇'
  const p = place.value
  return p.zh && p.zh !== p.ja ? `${p.ja}（${p.zh}）` : p.ja
})

// ---------- 給介面元件的東西 ----------
const uiCtx: GameUiContext = {
  sfx: (n) => audio.sfx(n),
  save: () => game?.save() ?? { ok: false, bytes: 0 },
  audioSettings: () => audio.settings(),
  setVolume: (b, v) => audio.setVolume(b, v),
  setMuted: (b, m) => audio.setMuted(b, m),
  setTyping: (on) => audio.setTyping(on),
  ui,
  setUi(patch) {
    Object.assign(ui, patch)
    saveUi(store, ui)
    applySettings()
  },
  reduced,
  touch: () => touch.value,
}
provide(GAME_UI, uiCtx)

function applySettings() {
  if (game) game.settings = toEngine(ui, game.settings)
  markDirty()
}

// ---------- 版面與畫面 ----------
function measure() {
  const el = root.value
  if (!el) return
  const cs = getComputedStyle(el)
  const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
  if (w <= 0 || h <= 0) return
  layout.value = layoutOf(w, h, touch.value)
  const f = fitScreen(w, h, layout.value)
  scale.value = f.scale
  width.value = f.width
  height.value = f.height
  if (canvas.value && (canvas.value.width !== f.width || canvas.value.height !== f.height)) {
    canvas.value.width = f.width
    canvas.value.height = f.height
  }
  game?.resize(f.width, f.height)
  imageOf = null
  paint()
}

function paint() {
  if (!game || !ctx) return
  dirty = false
  const f = game.render()
  if (imageOf !== f || !image || image.width !== f.w) {
    image = new ImageData(new Uint8ClampedArray(f.buf.buffer as ArrayBuffer, f.buf.byteOffset, f.buf.byteLength), f.w, f.h)
    imageOf = f
  }
  ctx.putImageData(image, 0, 0)
}

function frame(now: number) {
  raf = 0
  if (!game || document.hidden) return
  const dt = Math.min(0.1, (now - (last || now)) / 1000)
  last = now
  acc += dt
  let n = 0
  while (acc >= 1 / 60 && n < 6) {
    game.update(1 / 60)
    attract(1 / 60)
    acc -= 1 / 60
    n++
  }
  if (n === 6) acc = 0
  // 停住（手帳、P 暫停、減少動態的標題畫面）時世界不動：有變動才畫（取景框、面板的 'systems' 照畫，框會動）
  const still = game.paused && !pauseReasons.includes('systems')
  if (n > 0 && (!still || dirty)) paint()
  wakeQuiet()
  raf = requestAnimationFrame(frame)
}
function loop() {
  if (raf || !game || document.hidden) return
  last = 0
  raf = requestAnimationFrame(frame)
}

// ---------- 標題畫面後面：旅人自己慢慢走（減少動態時不動） ----------
let idle = 0
let wait = 1.2
function attract(dt: number) {
  const g = game
  if (!g || mode.value !== 'title' || reduced || !g.view) return
  const p = g.player
  if (p.moving || g.busy) {
    idle = 0
    return
  }
  idle += dt
  if (idle < wait) return
  idle = 0
  wait = 1.5 + Math.random() * 2.5
  const v = g.view
  for (let k = 0; k < 20; k++) {
    const x = p.x + Math.round((Math.random() - 0.5) * 14)
    const y = p.y + Math.round((Math.random() - 0.5) * 10)
    if (!v.inside(x, y) || !passable(v.beh(x, y)) || v.warpAt(x, y) || v.entitiesAt(x, y).length) continue
    if (Math.abs(x - p.x) + Math.abs(y - p.y) < 3) continue
    if (g.walkTo(x, y)) return
  }
}

// ---------- 地名牌 ----------
function hideSign() {
  clearTimeout(signTimer)
  sign.value = null
}
/** aria-live：同一句再來一次也要讀（先清空、下一格再放進去，內容沒變讀屏就不會讀） */
function announce(target: typeof liveLine, text: string) {
  target.value = ''
  void nextTick(() => requestAnimationFrame(() => (target.value = text)))
}
function showSign(name: MapName) {
  sign.value = { name, n: (sign.value?.n ?? 0) + 1 }
  announce(livePlace, name.zh && name.zh !== name.ja ? `${name.ja}，${name.zh}` : name.ja)
  clearTimeout(signTimer)
  signTimer = window.setTimeout(() => (sign.value = null), 3000)
}
// 一到就打開取景框、賣店：地名牌先收起來（不跟取景框左上角的名字疊在一起）
watch(
  () => systems.value?.ui.panel?.kind ?? null,
  (k) => {
    if (k) hideSign()
  },
)

// ---------- 對話 ----------
function openLine(l: Omit<DialogLine, 'id'>, p: NonNullable<typeof pending>) {
  pending = p
  line.value = { ...l, id: ++lineSeq }
  announce(liveLine, [l.who ? `${l.who}：${l.text}` : l.text, l.kind === 'ask' ? l.options.join('、') : ''].filter(Boolean).join('　'))
}
function onDialogDone(i: number) {
  const p = pending
  pending = null
  line.value = null
  if (p?.kind === 'say') p.resolve()
  else if (p?.kind === 'ask') p.resolve(i)
  focusCanvas()
}
function focusCanvas() {
  void nextTick(() => {
    if (!menuOpen.value && mode.value === 'play') canvas.value?.focus({ preventScroll: true })
  })
}

// ---------- 旅人手帳 ----------
function openMenu() {
  if (!game) return
  nbData.value = notebookData(game, savedAt.value)
  menuOpen.value = true
  nbDown = false
  markDirty()
  audio.sfx('cursor')
  clearTimeout(menuTimer)
  // 打開的聲音放完再停；不停的話鎮曲壓低
  if (SUSPEND_ON_MENU) menuTimer = window.setTimeout(() => menuOpen.value && void audio.suspend('menu'), 160)
  else audio.dim(MENU_DIM)
}
function closeMenu() {
  if (!menuOpen.value) return
  clearTimeout(menuTimer)
  menuOpen.value = false
  markDirty()
  game?.closeMenu()
  audio.dim(1)
  void audio.resume('menu').then(() => audio.sfx('cancel'))
  focusCanvas()
}
/** 手機：手帳在 pointerdown（十字鍵旁的「手帳」）就打開，同一下的 click 落在蓋上來的手帳上：手帳裡沒按下去過的 click 不算 */
let nbDown = false
function onNbDown() {
  nbDown = true
}
function onNbClick(e: MouseEvent) {
  if (e.detail > 0 && !nbDown) {
    e.stopPropagation()
    e.preventDefault()
  }
}
/** 殘影的 mousedown 也擋（焦點不會跳到手指下面那一個） */
function onNbMouseDown(e: MouseEvent) {
  if (!nbDown) e.preventDefault()
}
function refreshMenu() {
  if (menuOpen.value && game) nbData.value = notebookData(game, savedAt.value)
}

// ---------- 聲音 ----------
/** 地圖的曲子（鎮：kinki→kyoto、okinawa→okinawa；室內、車站、房間：interior）＋夜裡慢版＋祭典的太鼓 */
function applyBgm() {
  if (!game || mode.value !== 'play') return
  audio.bgm(songOf(wantBgm), moodOf(game.clock.time, systems.value?.festivalNow() ?? false))
}
/** iOS：被中斷（來電、切 app）後要在手勢裡再 unlock（很便宜，不會 reject） */
function onGesture() {
  if (mode.value !== 'play' || menuOpen.value || userPaused.value || document.hidden) return
  const s = audio.state()
  if (s === 'locked' || s === 'suspended') void audio.unlock()
}

// ---------- 按鍵 ----------
/** 世界停住時（對話、手帳、暫停）的按鍵 */
function onButton(b: Button) {
  if (menuOpen.value) {
    notebookRef.value?.press(b)
    return
  }
  // 面板（取景框、店…）開著時按鍵是面板的：一次按鍵不會同時給面板又翻對話
  if (systems.value?.ui.panel) return
  if (line.value) dialogRef.value?.press(b)
}

/** 標題畫面的鍵盤（遊戲的鍵盤要按了開始才接上） */
function onTitleKey(e: KeyboardEvent) {
  if (mode.value !== 'title' || e.ctrlKey || e.metaKey || e.altKey) return
  const b = KEYMAP[e.code]
  if (!b) return
  const el = e.target as HTMLElement | null
  // 焦點在按鈕上時 Enter／Space 照瀏覽器的 click
  if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && el?.closest?.('button, a[href]')) return
  e.preventDefault()
  if (!e.repeat) titleRef.value?.press(b)
}

function padPress(b: Button) {
  if (mode.value === 'title') return void titleRef.value?.press(b)
  game?.input.press(b, 'touch')
}
function padRelease(b: Button) {
  if (mode.value !== 'title') game?.input.release(b, 'touch')
}
function padDir(d: Dir | null) {
  if (mode.value === 'title') {
    if (d) titleRef.value?.press(d)
    return
  }
  game?.input.setDir(d, 'touch')
}
function padTick() {
  if (mode.value === 'play') audio.sfx('cursor')
}

/** 點畫面：對話中＝按 A；平常＝走過去（點 NPC、告示牌走到旁邊） */
function onTap(e: PointerEvent) {
  if (e.pointerType === 'touch' && !touch.value) {
    touch.value = true
    measure()
  }
  if (!game || !canvas.value || mode.value !== 'play' || menuOpen.value) return
  canvas.value.focus({ preventScroll: true })
  if (line.value) {
    dialogRef.value?.press('A')
    return
  }
  const r = canvas.value.getBoundingClientRect()
  game.tap(((e.clientX - r.left) / r.width) * width.value, ((e.clientY - r.top) / r.height) * height.value)
}
function onRootPointer(e: PointerEvent) {
  if (e.pointerType === 'touch' && !touch.value) {
    touch.value = true
    measure()
  }
  onGesture()
}

function unpause() {
  game?.resume('user')
}

// ---------- 開始 ----------
function start(c: TitleChoice) {
  if (!game || !gate || mode.value !== 'title') return
  // 使用者的手勢裡：建 AudioContext（iOS 要這樣才出得了聲）
  const fresh = c !== 'continue' || !game.hasSave()
  // 新遊戲：京都駅的大廳淡入＋電車到站的聲音
  void audio.unlock().then(() => fresh && mode.value === 'play' && audio.sfx('trainArrive'))
  // 重新開始：舊遊戲的照片（相簿、相框、委託用的）從 IndexedDB 刪掉
  if (c === 'restart') void systems.value?.forgetPhotos(game.savedData())
  gate.open()
  stopWarm?.()
  stopWarm = null
  window.removeEventListener('keydown', onTitleKey)
  mode.value = 'play'
  arrive.reset()
  if (c === 'continue') game.continueGame()
  else game.newGame()
  applySettings()
  detachKeys = game.attachKeyboard(window)
  applyBgm()
  focusCanvas()
}

/**
 * 存檔的 key 用登入的 uid（沒登入是 guest）：標題畫面等登入狀態確定才出選項（最多 8 秒；Firebase 載不到、離線時不要一直等）。
 * 等不到就先用 guest，之後確定了、還在標題畫面時換成那個人的（watch userStore.user）。
 */
const AUTH_WAIT_MS = 8000
async function whoAmI(): Promise<string | null> {
  const t0 = performance.now()
  while (!userStore.ready && performance.now() - t0 < AUTH_WAIT_MS) await new Promise((r) => setTimeout(r, 50))
  return userStore.user?.uid ?? null
}
const uidNow = () => (userStore.ready ? (userStore.user?.uid ?? null) : uid)
watch(
  () => (userStore.ready ? (userStore.user?.uid ?? 'guest') : null),
  (u) => {
    if (u === null || !game || !gate || gate.isOpen || mode.value !== 'title') return
    uid = u === 'guest' ? null : u
    game.setSaveKey(saveKey(uid))
    hasSave.value = game.hasSave()
  },
)

function wire(g: Game) {
  offs.push(
    g.on('say', (e: SayEvent) => {
      if (mode.value !== 'play') return e.resolve()
      openLine({ kind: 'say', text: e.text, who: e.who, source: e.source, options: [], cancel: 0 }, { kind: 'say', resolve: e.resolve })
    }),
    g.on('ask', (e: AskEvent) => {
      if (mode.value !== 'play') return e.resolve(e.cancel)
      openLine({ kind: 'ask', text: e.text, who: e.who, source: e.source, options: e.options, cancel: e.cancel }, { kind: 'ask', resolve: e.resolve })
    }),
    g.on('mapEnter', (e) => {
      place.value = e.name
      // 換地圖（淡出淡入的時候）：3D 的側面可以做了
      wakeQuiet(true)
      if (mode.value === 'play') showSign(e.name)
      // 同一首曲子的鎮之間（例：京都的兩個鎮）祭典的太鼓也要跟著換
      applyBgm()
    }),
    g.on('sfx', (e) => {
      if (mode.value !== 'play') return
      const n = sfxOf(e.name)
      if (n) audio.sfx(n)
    }),
    g.on('bgm', (e) => {
      wantBgm = e.name
      applyBgm()
    }),
    g.on('clock', () => applyBgm()),
    g.on('button', (e) => onButton(e.button)),
    g.on('menu', (e) => {
      if (e.open) openMenu()
    }),
    g.on('pause', (e) => {
      pauseReasons = e.reasons
      markDirty()
      wakeQuiet()
      const was = userPaused.value
      userPaused.value = e.reasons.includes('user')
      if (userPaused.value !== was) void (userPaused.value ? audio.suspend('pause') : audio.resume('pause'))
    }),
    g.on('save', (e) => {
      if (mode.value === 'play' && e.ok) savedAt.value = Date.now()
      refreshMenu()
    }),
    g.on('change', () => {
      markDirty()
      refreshMenu()
    }),
    // 相機（取景框）：systems 自己接 g.on('camera')
  )
}

async function boot() {
  void loadGameFont().then(() => fontEpoch.value++)
  // 標題畫面先出來（資料讀中只有一行字）；登入狀態與世界的資料一起等
  mode.value = 'title'
  window.addEventListener('keydown', onTitleKey)
  if (import.meta.env.DEV) devMaps = (await import('../game/play/devMaps')).p0Maps
  const who = whoAmI()
  const ok = await loadWorld()
  uid = await who
  if (!canvas.value || !ok) return
  makeGame()
}

/** 讀京都、沖繩的資料 → 世界（版本照 catalog store 的索引）；讀不到時標題畫面寫一行＋再試一次 */
async function loadWorld(): Promise<boolean> {
  dataState.value = 'loading'
  // 遊戲用的小 bundle：路由進來時（router 的 beforeEnter）已經開始抓的那一份
  const r = await loadPlayWorld(() => catalog.loadIndex(), { api: { ...BUNDLES, fetchGame: prefetchedGame } })
  if (!r.ok) {
    if (import.meta.env.DEV) console.info('game：資料讀不到', r.errors.map((e) => e.message), r.warnings)
    dataState.value = 'error'
    return false
  }
  if (import.meta.env.DEV && (r.errors.length || r.warnings.length)) console.info('game：資料少了一些', r.errors.map((e) => e.message), r.warnings)
  world = r.world
  worldPrefs = r.prefs
  dataState.value = 'ready'
  return true
}

async function retryWorld() {
  if (dataState.value === 'loading' || game) return
  if ((await loadWorld()) && canvas.value && !game) makeGame()
}
/** 讀不到的時候，連上網路就自己再讀一次 */
const onOnline = () => {
  if (dataState.value === 'error') void retryWorld()
}

function makeGame() {
  const w = world
  if (!canvas.value || !w) return
  registerDefaultLooks()
  ctx = canvas.value.getContext('2d')
  gate = gateStore(localStore)
  try {
    game = new Game({
      tokens: readTokens(),
      maps: mapsOf(),
      start: w.start,
      genVersion: w.genVersion,
      // 季節：現在所在的鎮的氣象台平年值（京都、那覇…）
      seasonOf: (d) => w.seasonOf(d),
      width: width.value,
      height: height.value,
      reducedMotion: reduced,
      saveKey: saveKey((uid = uidNow())),
      storage: gate.store,
      player: traveller.player.value,
      follower: traveller.follower.value,
    })
  } catch (e) {
    if (import.meta.env.DEV) console.warn('game：起不來', e)
    failed.value = true
    return
  }
  const g = game
  // 生成好的旅人與夥伴：現在就換上，之後（快取讀到、3D 側面做好、換了衣服）也跟著換
  offs.push(traveller.attach(g))
  // 系統（實體的互動、手帳的頁）要在 newGame 之前接上；世界的花況、天氣、最後住的旅館
  offs.push(installSystems(g), w.attach(g))
  wire(g)
  hasSave.value = g.hasSave()
  // 標題後面的畫面：新遊戲的起點（京都駅的大廳），旅人自己走（不會寫到存檔）
  g.newGame()
  if (reduced) g.pause('title')
  applySettings()
  if (import.meta.env.DEV) installDev(g)
  measure()
  loop()
  // 標題畫面的時候，閒下來把還沒生成的鎮做好
  stopWarm = w.warm()
}

// ---------- 分頁在背景、離開頁面 ----------
function onVisibility() {
  if (!game) return
  if (document.hidden) {
    if (mode.value === 'play') game.save()
    game.pause('hidden')
  } else {
    game.resume('hidden')
    loop()
  }
}
const onPageHide = () => {
  if (mode.value === 'play') game?.save()
}
const onPointerKind = () => {
  touch.value = !!coarse?.matches
  measure()
}

/** DEV：給 Playwright、手動測試用 */
function installDev(g: Game) {
  const w = window as unknown as { __game?: unknown }
  w.__game = {
    game: g,
    start: (c: TitleChoice = 'new') => start(c),
    warp: (map: string, x: number, y: number, dir?: Dir) => g.warpNow(map, x, y, dir),
    setDate: (y: number, m: number, d: number) => g.clock.setDate(y, m, d),
    setTime: (h: number, m = 0) => g.clock.setTime(h, m),
    money: (n: number) => {
      g.state.money = Math.max(0, g.state.money + n)
      g.changed('money')
    },
    weather: (k: 'clear' | 'rain' | 'snow') => g.setWeather(k),
    skip: () => {
      const p = pending
      pending = null
      line.value = null
      g.skip()
      if (p?.kind === 'say') p.resolve()
    },
    press: (b: Button) => g.input.press(b, 'dev'),
    release: (b: Button) => g.input.release(b, 'dev'),
    save: () => g.save(),
    audio: () => ({ state: audio.state(), current: audio.current(), settings: audio.settings() }),
    sounds: () => [...soundLog],
    traveller: () => ({ status: traveller.status.value, info: traveller.info.value }),
    regenerate: () => traveller.regenerate(),
    tap: (b: Button) => g.input.tap(b, 'dev'),
    place: (x: number, y: number, dir: Dir = g.player.dir) => {
      g.player.place(x, y, dir)
      g.follower?.reset(x, y, dir)
    },
    /** 世界：鎮、交通、起點 */
    world: () =>
      world && {
        start: world.start,
        towns: world.towns.map((t) => ({ id: t.id, pref: t.pref, name: t.name.ja, mapId: t.mapId, kit: t.kit, island: t.island, stops: t.stops.map((x) => x.id), spots: t.spots })),
        links: world.links.map((l) => ({ id: l.id, from: l.from, to: l.to, mode: l.mode, name: l.name, minutes: l.minutes, legs: l.legs.map((x) => x.mode) })),
      },
    /** 傳送到某鎮的某個站（main、airport、bus、st:…） */
    town: (code: string, stop = 'main') => {
      const gen = world?.generate(code)
      const a = gen?.stops[stop] ?? gen?.stops.main
      return a ? g.warpNow(a.map, a.x, a.y, a.dir) : false
    },
    /** 坐車（link id） */
    travel: (id: string) => !!startRide(g, id),
    /** P0 的測試小鎮 */
    p0: () => g.warpNow('p0:town', 14, 20, 'up'),
    entities: () => (g.map?.entities ?? []).map((e) => ({ id: e.id, kind: e.kind, x: e.x, y: e.y, data: e.data })),
    /** 某張地圖（不進去）：大小、門、實體 */
    mapInfo: (id: string) => {
      const m = mapsOf()(id)
      return m && { id: m.id, name: m.name, w: m.w, h: m.h, start: m.start, outdoor: m.outdoor, bgm: m.bgm, warps: m.warps.map((w2) => ({ ...w2 })), entities: m.entities.map((e) => ({ id: e.id, kind: e.kind, x: e.x, y: e.y, facing: e.facing, data: e.data })) }
    },
    warps: () => (g.map?.warps ?? []).map((w2) => ({ ...w2 })),
    npcs: () => g.npcs.map((a) => ({ id: a.id, x: a.x, y: a.y, kind: a.entity?.kind ?? null, hidden: !!a.hidden })),
    systems: () => systems.value?.dev() ?? null,
    state: () => ({
      mode: mode.value,
      map: g.map?.id,
      x: g.player.x,
      y: g.player.y,
      dir: g.player.dir,
      moving: g.player.moving,
      follower: g.follower ? { x: g.follower.actor.x, y: g.follower.actor.y } : null,
      money: g.state.money,
      items: { ...g.state.items },
      stamps: [...g.state.stamps],
      album: [...g.state.album],
      panel: systems.value?.ui.panel?.kind ?? null,
      hint: systems.value?.ui.hint?.name ?? null,
      festival: systems.value?.festivalNow() ?? false,
      weather: g.weather,
      data: dataState.value,
      flags: { ...g.state.flags },
      date: { ...g.clock.date },
      time: g.clock.hhmm,
      period: g.clock.time,
      season: g.clock.season,
      busy: g.busy,
      paused: g.paused,
      userPaused: userPaused.value,
      dialog: dialogRef.value?.state() ?? null,
      menu: menuOpen.value,
      notebook: menuOpen.value ? (notebookRef.value?.state() ?? null) : null,
      title: mode.value === 'title' ? (titleRef.value?.state() ?? null) : null,
      sign: sign.value?.name.ja ?? null,
      settings: { ...g.settings },
      ui: { ...ui },
      layout: layout.value,
      touch: touch.value,
      W: g.W,
      H: g.H,
      cam: g.camera(),
      scale: scale.value,
      label: canvasLabel.value,
    }),
  }
}

let ro: ResizeObserver | null = null
onMounted(() => {
  measure()
  void boot()
  // 資料索引（index.html 一到就 preload）：之後讀縣的資料要它的版本；這一頁也拿，preload 才不會白抓（瀏覽器會警告）
  void catalog.loadIndex()
  ro = new ResizeObserver(() => measure())
  if (root.value) ro.observe(root.value)
  offHidden = suspendWhenHidden(audio)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  coarse?.addEventListener('change', onPointerKind)
  window.addEventListener('keydown', onGesture, true)
  window.addEventListener('online', onOnline)
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  if (mode.value === 'play') game?.save()
  detachKeys?.()
  for (const off of offs) off()
  ro?.disconnect()
  offHidden?.()
  clearTimeout(signTimer)
  clearTimeout(menuTimer)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', onPageHide)
  window.removeEventListener('keydown', onTitleKey)
  window.removeEventListener('keydown', onGesture, true)
  window.removeEventListener('online', onOnline)
  coarse?.removeEventListener('change', onPointerKind)
  audio.dispose()
  stopWarm?.()
  const w = window as unknown as { __game?: unknown }
  delete w.__game
  // 大的東西不要留著參照（頁面的實例萬一被別的地方抓著，也只剩空殼）
  game = null
  world = null
  worldPrefs = []
  devMaps = null
  ctx = null
  image = null
  imageOf = null
  quietWaiters = []
})
</script>

<template>
  <div ref="root" class="play-root" :class="`lay-${layout}`" :style="{ '--u': `${scale}px` }" @pointerdown.capture="onRootPointer">
    <RouterLink to="/" class="play-back" aria-label="回到 ひとめぐり">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      <span lang="ja">ひとめぐり</span>
    </RouterLink>

    <div class="play-stage">
      <TouchPad v-if="layout === 'landscape'" side="left" class="play-side" @press="padPress" @release="padRelease" @dir="padDir" @tick="padTick" />

      <div class="play-screen" :style="{ width: `${width * scale}px`, height: `${height * scale}px` }">
        <!-- role="application"：讀屏（NVDA、JAWS）聚焦時切到焦點模式，方向鍵、空白鍵交給遊戲 -->
        <canvas
          ref="canvas"
          class="play-canvas"
          tabindex="0"
          role="application"
          aria-roledescription="遊戲畫面"
          :aria-label="canvasLabel"
          @pointerdown="onTap"
        ></canvas>
        <PlaceSign v-if="sign" :key="sign.n" :name="sign.name" :scale="scale" />
        <DialogBox
          ref="dialogRef"
          :line="line"
          :cps="cps"
          :scale="scale"
          :width="width"
          :font-epoch="fontEpoch"
          @done="onDialogDone"
          @sfx="(n) => audio.sfx(n)"
        />
        <!-- 暫停（P）：抖色蓋一層，正中「暫停」；點一下繼續 -->
        <div v-if="userPaused" class="play-veil" @pointerdown.stop="unpause">
          <p class="gba-box play-paused">暫停</p>
        </div>
        <SystemsLayer v-if="systems && mode === 'play'" :systems="systems" :scale="scale" :width="width" :layout="layout" :busy="!!line" />
        <TitleScreen
          v-if="mode === 'title'"
          ref="titleRef"
          :has-save="hasSave"
          :scale="scale"
          :status="titleStatus"
          :retry="dataState === 'error'"
          @choose="start"
          @retry="retryWorld"
          @sfx="(n) => audio.sfx(n)"
        />
        <Notebook
          v-if="menuOpen && nbData && layout === 'desktop'"
          ref="notebookRef"
          :data="nbData"
          :start="nbPage"
          @page="(p) => (nbPage = p)"
          @close="closeMenu"
        />
      </div>

      <TouchPad v-if="layout === 'landscape'" side="right" class="play-side" @press="padPress" @release="padRelease" @dir="padDir" @tick="padTick" />
      <TouchPad v-if="layout === 'portrait'" side="both" class="play-under" @press="padPress" @release="padRelease" @dir="padDir" @tick="padTick" />
    </div>

    <!-- 手機：手帳蓋住整個畫面與控制區（字與按鈕才夠大） -->
    <div v-if="menuOpen && nbData && layout !== 'desktop'" class="play-nb-full" @pointerdown="onNbDown" @mousedown.capture="onNbMouseDown" @click.capture="onNbClick">
      <Notebook ref="notebookRef" :data="nbData" :start="nbPage" @page="(p) => (nbPage = p)" @close="closeMenu" />
    </div>

    <p v-if="failed" class="play-failed">遊戲載入不了，稍後再試。</p>
    <p class="sr-only" aria-live="polite">{{ livePlace }}</p>
    <p class="sr-only" aria-live="polite">{{ liveLine }}</p>
  </div>
</template>

<style scoped>
.play-root {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  color: var(--color-px-white);
  background: var(--color-px-ink);
  touch-action: manipulation;
  font-family: var(--font-game);
}
.play-root :deep(:lang(ja)) {
  font-family: var(--font-game-ja);
}
.play-back {
  position: absolute;
  top: env(safe-area-inset-top);
  left: max(12px, env(safe-area-inset-left));
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  padding: 0 4px;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-px-paper-2);
  text-decoration: none;
}
.play-back :lang(ja) {
  font-family: var(--font-ja);
}
.play-back:hover {
  color: var(--color-px-white);
}
.play-back:focus-visible {
  outline: 2px solid var(--color-px-gold-1);
  outline-offset: 2px;
}
/* 畫面本身：玩的時候焦點一直在這裡，框用安靜的石色（看得到、不搶畫面）；手機（觸控的版面）不畫框 */
.play-canvas:focus-visible {
  outline: 2px solid var(--color-px-stone-3);
  outline-offset: 3px;
}
.lay-portrait .play-canvas:focus-visible,
.lay-landscape .play-canvas:focus-visible {
  outline: none;
}
.play-stage {
  display: flex;
  flex: 1;
  min-height: 0;
  align-items: center;
  justify-content: center;
}
.lay-desktop .play-stage {
  padding: 44px 0 24px;
}
.lay-portrait .play-stage {
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 44px;
}
/* 直拿：畫面往下長到剩控制區的高度，控制區貼在下面（不在中間空一大段） */
.play-under {
  flex: 1;
  justify-content: flex-end;
  width: 100%;
  padding: 12px 16px;
}
.play-side {
  flex: 1;
  min-width: 0;
  justify-content: center;
}
.play-screen {
  position: relative;
  flex-shrink: 0;
}
.play-canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  touch-action: none;
  outline: none;
}
/* 50% 的抖色（一格一格的棋盤），格子跟著放大倍數 */
.play-veil {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background-image: conic-gradient(var(--color-px-ink) 90deg, transparent 90deg 180deg, var(--color-px-ink) 180deg 270deg, transparent 270deg);
  background-size: calc(var(--u) * 2) calc(var(--u) * 2);
  cursor: pointer;
}
.play-paused {
  margin: 0;
  padding: calc(var(--u) * 4) calc(var(--u) * 12);
  font-size: max(14px, calc(var(--u) * 9));
  letter-spacing: 0.3em;
}
.play-nb-full {
  position: absolute;
  inset: 0;
  z-index: 3;
  padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
  background: var(--color-px-ink);
}
.play-nb-full > :deep(.nb) {
  position: relative;
  height: 100%;
}
.play-failed {
  position: absolute;
  inset: 0;
  margin: auto;
  height: fit-content;
  text-align: center;
}
</style>
