<script setup lang="ts">
import '../gba.css'

import { onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef } from 'vue'

import { createGameAudio } from '../../../game/audio'
import { type AskEvent, Game, type SayEvent } from '../../../game/engine'
import type { Button } from '../../../game/engine/input'
import { localStore } from '../../../game/engine/save'
import type { Dir } from '../../../game/engine/types'
import kyoto from '../../../game/fixtures/kyoto.json'
import okinawa from '../../../game/fixtures/okinawa.json'
import { registerDefaultLooks } from '../../../game/sprites'
import { DEV_START, devMaps, devWorld } from '../../../game/systems/dev/testWorld'
import type { PrefLike } from '../../../game/systems/types'
import { useGameSystems } from '../../../game/systems/useGameSystems'
import { GAME_UI, type GameUiContext } from '../../../game/ui/context'
import type { DialogLine } from '../../../game/ui/dialog'
import { notebookData, type NotebookData, type NotebookPageId } from '../../../game/ui/notebook'
import { loadGameFont } from '../../../game/ui/font'
import { UI_DEFAULTS, type UiSettings } from '../../../game/ui/settings'
import { charsPerSecond } from '../../../game/ui/text'
import { readTokens } from '../../../services/pixelwalk/palette'
import DialogBox from '../DialogBox.vue'
import Notebook from '../Notebook.vue'
import SystemsLayer from '../SystemsLayer.vue'

// 開發用：P2 系統的試玩台（不進正式的路由）。P0 的測試小鎮改成兩鎮＋車站大廳＋你的房間（game/systems/dev/testWorld.ts），
// 資料是 fixtures；接法跟 PlayView 一樣（對話框、手帳、SystemsLayer、installSystems），給 Playwright 走過拍照、買東西、蓋章、擺設、委託。
const W = 240
const H = 160
// ?layout=portrait：手機直拿（面板蓋住整個畫面）；?scale=2
const q = new URLSearchParams(location.search)
const layout = (q.get('layout') === 'portrait' ? 'portrait' : 'desktop') as 'desktop' | 'portrait'
const scale = Number(q.get('scale')) || 3
const PREFS = [kyoto, okinawa] as unknown as PrefLike[]

const canvas = ref<HTMLCanvasElement | null>(null)
const dialogRef = ref<InstanceType<typeof DialogBox> | null>(null)
const notebookRef = ref<InstanceType<typeof Notebook> | null>(null)
const line = shallowRef<DialogLine | null>(null)
const menuOpen = ref(false)
const nbData = shallowRef<NotebookData | null>(null)
const nbPage = ref<NotebookPageId>('map')
const ui = reactive<UiSettings>({ ...UI_DEFAULTS, textSpeed: 'instant' })
const audio = createGameAudio({ storage: null, devHook: false })
const maps = devMaps()
let game: Game | null = null
let raf = 0
let seq = 0
let pending: { kind: 'say'; resolve(): void } | { kind: 'ask'; resolve(i: number): void } | null = null
const offs: Array<() => void> = []

const { systems, install } = useGameSystems(() => ({
  prefs: PREFS,
  world: devWorld(PREFS),
  maps,
  jingle: (n) => audio.jingle(n),
  travel: (g, link) => {
    // 假的坐車：淡出、換到那一鎮
    g.run(function* (s) {
      yield* s.sfx('trainDepart')
      yield* s.fade('out')
      yield* s.warp(`town:${link.town}`, 14, 20, 'up')
      yield* s.fade('in')
    })
  },
}))

const uiCtx: GameUiContext = {
  sfx: (n) => audio.sfx(n),
  save: () => game?.save() ?? { ok: false, bytes: 0 },
  audioSettings: () => audio.settings(),
  setVolume: (b, v) => audio.setVolume(b, v),
  setMuted: (b, m) => audio.setMuted(b, m),
  setTyping: (on) => audio.setTyping(on),
  ui,
  setUi: (p) => Object.assign(ui, p),
  reduced: false,
  touch: () => false,
}
provide(GAME_UI, uiCtx)

function onDone(i: number) {
  const p = pending
  pending = null
  line.value = null
  if (p?.kind === 'say') p.resolve()
  else if (p?.kind === 'ask') p.resolve(i)
  canvas.value?.focus()
}
function closeMenu() {
  menuOpen.value = false
  game?.closeMenu()
  canvas.value?.focus()
}
function onButton(b: Button) {
  if (menuOpen.value) return void notebookRef.value?.press(b)
  if (line.value) dialogRef.value?.press(b)
}

function frame() {
  raf = requestAnimationFrame(frame)
  const g = game
  const c = canvas.value?.getContext('2d')
  if (!g || !c) return
  g.update(1 / 60)
  const f = g.render()
  c.putImageData(new ImageData(new Uint8ClampedArray(f.buf.buffer as ArrayBuffer, f.buf.byteOffset, f.buf.byteLength), f.w, f.h), 0, 0)
}

onMounted(() => {
  void loadGameFont()
  registerDefaultLooks()
  const g = new Game({ tokens: readTokens(), maps, start: DEV_START, width: W, saveKey: 'hitomeguri:game:v1:p2dev', storage: localStore })
  game = g
  offs.push(install(g))
  offs.push(
    g.on('say', (e: SayEvent) => {
      pending = { kind: 'say', resolve: e.resolve }
      line.value = { id: ++seq, kind: 'say', text: e.text, who: e.who, source: e.source, options: [], cancel: 0 }
    }),
    g.on('ask', (e: AskEvent) => {
      pending = { kind: 'ask', resolve: e.resolve }
      line.value = { id: ++seq, kind: 'ask', text: e.text, who: e.who, source: e.source, options: e.options, cancel: e.cancel }
    }),
    g.on('button', (e) => onButton(e.button)),
    g.on('menu', (e) => {
      if (!e.open) return
      nbData.value = notebookData(g, null)
      menuOpen.value = true
    }),
    g.on('change', () => menuOpen.value && (nbData.value = notebookData(g, null))),
    g.on('sfx', (e) => {
      const n = e.name === 'photo' ? 'shutter' : e.name === 'shop' ? 'register' : e.name
      audio.sfx(n as never)
    }),
    g.attachKeyboard(window),
  )
  const unlock = () => void audio.unlock()
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
  if (new URLSearchParams(location.search).has('fresh')) g.newGame()
  else g.continueGame()
  const w = window as unknown as { __p2?: unknown }
  w.__p2 = {
    game: g,
    systems: () => systems.value,
    warp: (map: string, x: number, y: number, dir?: Dir) => g.warpNow(map, x, y, dir),
    setDate: (y: number, m: number, d: number) => g.clock.setDate(y, m, d),
    setTime: (h: number, m = 0) => g.clock.setTime(h, m),
    weather: (k: 'clear' | 'rain' | 'snow') => g.setWeather(k),
    tap: (b: Button) => g.input.tap(b, 'dev'),
    press: (b: Button) => g.input.press(b, 'dev'),
    release: (b: Button) => g.input.release(b, 'dev'),
    place: (x: number, y: number, dir: Dir) => {
      g.player.place(x, y, dir)
      g.follower?.reset(x, y, dir)
    },
    state: () => ({
      map: g.map?.id,
      x: g.player.x,
      y: g.player.y,
      dir: g.player.dir,
      money: g.state.money,
      items: { ...g.state.items },
      stamps: [...g.state.stamps],
      album: [...g.state.album],
      paused: g.paused,
      busy: g.busy,
      date: { ...g.clock.date },
      time: g.clock.hhmm,
      dialog: dialogRef.value?.state() ?? null,
      menu: menuOpen.value,
      notebook: menuOpen.value ? (notebookRef.value?.state() ?? null) : null,
      systems: systems.value?.dev() ?? null,
    }),
  }
  raf = requestAnimationFrame(frame)
  canvas.value?.focus()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  for (const off of offs) off()
  audio.dispose()
})
const cps = charsPerSecond(ui.textSpeed, false)
</script>

<template>
  <div class="play-root harness" :class="`lay-${layout}`" :style="{ '--u': `${scale}px` }">
    <div class="play-screen" :style="{ width: `${W * scale}px`, height: `${H * scale}px` }">
      <canvas ref="canvas" class="play-canvas" :width="W" :height="H" tabindex="0" role="img" aria-label="試玩台"></canvas>
      <DialogBox ref="dialogRef" :line="line" :cps="cps" :scale="scale" :width="W" @done="onDone" @sfx="(n) => audio.sfx(n)" />
      <SystemsLayer v-if="systems" :systems="systems" :scale="scale" :width="W" :layout="layout" />
      <Notebook v-if="menuOpen && nbData" ref="notebookRef" :data="nbData" :start="nbPage" @page="(p) => (nbPage = p)" @close="closeMenu" />
    </div>
  </div>
</template>

<style scoped>
.harness {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100vh;
  color: var(--color-px-white);
  background: var(--color-px-ink);
  font-family: var(--font-game);
}
.harness :deep(:lang(ja)) {
  font-family: var(--font-game-ja);
}
.play-screen {
  position: relative;
}
.play-canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  outline: none;
}
</style>
