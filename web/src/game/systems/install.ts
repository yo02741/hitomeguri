import { seedOf } from '../../services/pixelwalk/rng'
import type { JingleId } from '../audio/songs'
import { factFromRef, type Fact } from '../content/facts'
import { type FlavourBloom, type FlavourWho, pickFlavour } from '../content/flavour'
import { iconSprite, pictureSprite } from '../content/icons'
import { Actor } from '../engine/actor'
import type { Game, MapSource } from '../engine/game'
import { tileDef } from '../engine/tiles'
import type { Button } from '../engine/input'
import { lookOf } from '../engine/looks'
import { Npc } from '../engine/npc'
import { folkOf } from '../sprites/folk'
import type { ActorLook, MapEntity, Script } from '../engine/types'

import { Camera } from './camera'
import { bloomOf, DataIndex, dayKey, kitOfPref, spotName, townCodeOfMap } from './data'
import { itemCard, type ItemCardData, removeItem } from './inventory'
import { registerKinds, setSystemsFor } from './kinds'
import { installNotebook } from './notebookPages'
import { area, bodyRect, intersect, type Rect, type ShotScore, SNOWY_KITS } from './photo'
import { loadThumb, photoStore, type PhotoStore, setPhotoStore } from './photoStore'
import { pruneQuests } from './quests'
import { photoInFrame, slotIndex } from './room'
import { buy as buyItem, eat as eatItem, type StockEntry } from './shop'
import { HEARD_MAX, type HeardMeta, PHOTO_MAX, type PhotoMeta, roomOf, systemsOf, type SystemsSave } from './state'
import { dataOf, type Kit, type NpcData, type PhotoSpotData, type Place, type PrefLike, type SlotData, type TownLike, type TravelLink, type WorldLike } from './types'
import { createUi, type Panel, type PanelPress, type PanelResult, type PhotoResult, type SystemsUi } from './ui'

/**
 * 番外篇的系統（規格 §8.4–§8.7、§11）：拍照與相簿、行李與旅費與店、印帳、房間、委託、台詞，以及地圖上的
 * sign、photoSpot、npc（依 role）、shop、stamp、travel、inn、shelfSlot、frameSlot、desk 的互動。
 *
 *   const systems = installSystems(game, { prefs, world, maps, travel, jingle })
 *   // PlayView：<SystemsLayer :systems="systems" :scale :width />；離開時 systems.uninstall()
 *
 * 系統不碰網站的去過、抽獎券、成就、wallet；存檔都在 Game 的存檔裡（systems 的部分是 game.state.ext.systems）。
 */
export interface SystemsDeps {
  /** 京都、沖繩的 PrefData（world/data.ts；測試用 fixture） */
  prefs?: readonly PrefLike[]
  /** world 選好的鎮 */
  world?: WorldLike | null
  /** 跟 Game 同一個 MapSource（拿房間的起點） */
  maps?: MapSource
  /** world 的坐車：選了目的地之後呼叫（沒有的話目的地選單照樣出來，選了說這一班還沒開） */
  travel?(game: Game, link: TravelLink): void
  /** 抵達新的鎮、蓋章、買到東西的短曲（PlayView 的 audio.jingle） */
  jingle?(name: JingleId): void
  /** 鎮裡放了告示牌與拍攝點的景點（委託用；world 知道） */
  townSpots?(town: string): readonly string[]
  /** 這一縣蓋得到的章一共幾個（印帳的 n / N；world 知道才給） */
  stampTotal?(pref: string): number | undefined
  /** 這一鎮今天有沒有祭典（world 自己算的話給這個；沒給用資料算：月份＋位置） */
  festival?(game: Game): boolean
  /** 現在是不是花季（櫻、楓；相簿的春櫻、秋楓格與分數）：world 自己算的話給這個；沒給用氣象廳的平年值算 */
  bloom?(game: Game): 'sakura' | 'momiji' | null
  /** 現在開著的花（world.bloomOf；路人講開花的話用）；沒給就從 bloom() 推 */
  flowers?(game: Game): ReadonlySet<FlavourBloom>
  reducedMotion?: boolean
  /** 照片放哪（測試用 memoryPhotos） */
  photos?: PhotoStore
  /** 路人用旅人產生器隨機組（閒下來時一個一個換；預設 false 用手畫的路人） */
  generatedNpcs?: boolean
}

/** 祭典那個月才套上的 tile（world/gen/town.ts 的 festivalLayer：攤子、提燈） */
const FESTIVAL_TILE = /\/(stall|chochin)\b/
const WHO_LABEL = { passer: '路人', clerk: '店員', ryokan: '旅館的人', minshuku: '民宿的人' } as const

export class GameSystems {
  readonly game: Game
  readonly ui: SystemsUi
  readonly camera: Camera
  data: DataIndex
  readonly deps: SystemsDeps
  private offs: Array<() => void> = []
  private panelPress: PanelPress | null = null
  private waiting: { done: boolean; value: PanelResult } | null = null
  private readonly talks = new Map<string, number>()
  private readonly looks = new Map<number, ActorLook>()
  private pendingShot: { meta: PhotoMeta; spotId?: string } | null = null

  constructor(game: Game, deps: SystemsDeps = {}) {
    this.game = game
    this.deps = deps
    this.data = new DataIndex(deps.prefs ?? [], deps.world ?? null)
    this.ui = createUi(deps.reducedMotion ?? game.reducedMotion)
    if (deps.photos) setPhotoStore(deps.photos)
    this.camera = new Camera({
      game,
      reduced: this.ui.reduced,
      sfx: (n) => this.sfx(n),
      changed: () => this.ui.tick++,
      showViewfinder: (spot, name) => this.openPanel({ kind: 'viewfinder', spot, name }),
      hideViewfinder: () => {
        if (this.ui.panel?.kind === 'viewfinder') this.closePanel()
      },
      pageOf: (spot) => this.pageOf(spot),
      scene: () => ({ festival: this.festivalNow(), bloom: this.bloomNow(), snowy: SNOWY_KITS.has(this.region()) }),
      festivalIn: (frame) => this.festivalInFrame(frame),
      shot: (meta, score, spotId, png) => this.onShot(meta, score, spotId, png),
    })
  }

  // ---------- 接上、拆掉 ----------
  install(): this {
    registerKinds()
    setSystemsFor(this.game, this)
    const g = this.game
    let day = ''
    this.offs.push(
      g.on('button', (e) => void this.press(e.button)),
      g.on('camera', (e) => this.openCamera(e.spot)),
      g.on('mapEnter', (e) => this.onMapEnter(e.id)),
      g.on('step', (e) => this.onStep(e.x, e.y)),
      // 換日：過了期限的委託取消
      g.on('clock', (e) => {
        const k = dayKey(e.date)
        if (k === day) return
        const first = !day
        day = k
        if (!first) this.pruneQuests()
      }),
      installNotebook(this),
    )
    return this
  }

  uninstall() {
    for (const off of this.offs) off()
    this.offs = []
    if (this.camera.open) this.camera.stop()
    if (this.ui.panel) this.closePanel()
    setSystemsFor(this.game, null)
  }

  /** 資料晚一點才讀到（bundles）：換上新的 */
  setData(prefs: readonly PrefLike[], world: WorldLike | null = this.data.world) {
    this.data = new DataIndex(prefs, world)
    this.ui.tick++
  }

  /** 這張 Game 的 systems 存檔 */
  get save(): SystemsSave {
    return systemsOf(this.game)
  }

  // ---------- 聲音 ----------
  sfx(name: string) {
    this.game.emit('sfx', { name })
  }
  jingle(name: JingleId) {
    this.deps.jingle?.(name)
  }

  // ---------- 面板 ----------
  openPanel(p: Panel) {
    this.ui.panel = p
    this.ui.tick++
    this.game.pause('systems')
  }

  /** 關上面板：世界繼續，等著的腳本拿到結果 */
  closePanel(r: PanelResult = null) {
    if (!this.ui.panel) return
    if (this.ui.panel.kind === 'viewfinder' && this.camera.open) this.camera.stop()
    this.ui.panel = null
    this.panelPress = null
    this.game.resume('systems')
    const w = this.waiting
    this.waiting = null
    if (w) {
      w.done = true
      w.value = r
    }
  }

  /** 換一個面板（不放開世界） */
  swapPanel(p: Panel) {
    this.ui.panel = p
    this.ui.tick++
  }

  /** 腳本裡：打開面板，等它關上 */
  *waitPanel(p: Panel): Script<PanelResult> {
    const w = { done: false, value: null as PanelResult }
    this.waiting = w
    this.openPanel(p)
    yield () => w.done
    return w.value
  }

  /** 面板元件綁上自己的按鍵處理 */
  bindPanel(fn: PanelPress | null) {
    this.panelPress = fn
  }

  /** 世界停住時的按鍵：有面板就交給面板 */
  press(b: Button): boolean {
    const p = this.ui.panel
    if (!p) return false
    if (p.kind === 'viewfinder') return this.camera.press(b)
    if (this.panelPress?.(b)) return true
    if (b === 'B' || b === 'START') {
      this.sfx('cancel')
      this.closePanel()
    }
    return true
  }

  refresh() {
    this.ui.tick++
  }

  // ---------- 在哪 ----------
  townHere(): TownLike | undefined {
    return this.data.townOfMap(this.game.map?.id) ?? this.data.town(this.save.lastTown)
  }

  region(): Kit {
    const t = this.townHere()
    return t ? this.data.kitOfTown(t) : kitOfPref(this.data.prefs[0]?.pref ?? 'kyoto')
  }

  /** 這一鎮今天有沒有祭典（規格 §8.3） */
  festivalNow(): boolean {
    if (this.deps.festival) return this.deps.festival(this.game)
    return this.data.festivalsAt(this.townHere(), this.game.clock.date).length > 0
  }

  /** 取景框（畫面座標）裡有祭典的攤子、提燈或祭典的人嗎 */
  festivalInFrame(frame: Rect): boolean {
    const g = this.game
    const map = g.map
    if (!map) return false
    const cam = g.camera()
    for (const a of g.npcs) {
      if (a.hidden || !a.entity?.id.startsWith('festival:')) continue
      const b = bodyRect(a.px, a.py, cam.x, cam.y)
      if (area(intersect(b, frame)) / area(b) >= 0.5) return true
    }
    const x0 = Math.max(0, Math.floor((frame.x + cam.x) / 16))
    const y0 = Math.max(0, Math.floor((frame.y + cam.y) / 16))
    const x1 = Math.min(map.w - 1, Math.floor((frame.x + frame.w - 1 + cam.x) / 16))
    const y1 = Math.min(map.h - 1, Math.floor((frame.y + frame.h - 1 + cam.y) / 16))
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        for (const layer of [map.over, map.lower]) {
          const name = tileDef(layer[y * map.w + x] ?? 0)?.name
          if (name && FESTIVAL_TILE.test(name)) return true
        }
    return false
  }

  /** 花季（平年值） */
  bloomNow(): 'sakura' | 'momiji' | null {
    if (this.deps.bloom) return this.deps.bloom(this.game)
    const t = this.townHere()
    return bloomOf(this.game.clock.date, this.data.seasonStation(t)?.normals)
  }

  /** 現在開著的花（平年值） */
  flowersNow(): ReadonlySet<FlavourBloom> {
    if (this.deps.flowers) return this.deps.flowers(this.game)
    const b = this.bloomNow()
    const kanhi = this.region() === 'okinawa'
    return new Set<FlavourBloom>(b === 'sakura' ? [kanhi ? 'kanhi' : 'sakura'] : b === 'momiji' ? ['kaede'] : [])
  }

  /** 這一句台詞：同一個人每次搭話換下一句 */
  flavour(who: FlavourWho, key: string): string | null {
    const g = this.game
    const n = this.talks.get(`${who}:${key}`) ?? 0
    this.talks.set(`${who}:${key}`, n + 1)
    const line = pickFlavour(
      { who, region: this.region(), season: g.clock.season, time: g.clock.time, weather: g.map?.outdoor ? g.weather : 'clear', bloom: this.flowersNow(), ...(g.map?.setting ? { setting: g.map.setting } : {}) },
      `${key}:${dayKey(g.clock.date)}`,
      n,
    )
    return line?.text ?? null
  }

  // ---------- 聽來的 ----------
  /** 記下聽過的一句（同一句只記一次，最新的在後面） */
  hear(h: Omit<HeardMeta, 'd' | 'm'>) {
    const s = this.save
    const same = (x: HeardMeta) =>
      x.k === h.k && x.id === h.id && x.ref?.kind === h.ref?.kind && x.ref?.id === h.ref?.id && JSON.stringify(x.p ?? {}) === JSON.stringify(h.p ?? {})
    if (s.heard.some(same)) return
    s.heard.push({ ...h, d: dayKey(this.game.clock.date), m: this.game.map?.id })
    if (s.heard.length > HEARD_MAX) s.heard.splice(0, s.heard.length - HEARD_MAX)
    this.game.changed('flags')
  }

  /** 事實樣板：資料參照 → 一句話（沒有出處 null）。given：world 給的出處（鐵路 km、直線 km） */
  fact(template: string, ref: { kind: string; id: string }, params: Record<string, string | number> = {}, given?: { label: string; url: string } | null): Fact | null {
    return factFromRef(template, ref, params, this.data, this.townHere(), given)
  }

  // ---------- 拍照 ----------
  /** 打開取景框（對話、腳本進行中不開：按一次 A 不會同時拍照又翻頁） */
  openCamera(spot: MapEntity | null) {
    if (this.ui.panel || this.game.paused || this.game.busy) return
    this.camera.start(spot)
  }

  /** 現在可以拍照嗎（「拍照」鈕顯示不顯示） */
  canShoot(): boolean {
    return !this.ui.panel && !this.game.paused && !this.game.busy
  }

  /** 相簿的哪一頁：拍攝點的景點（資料的名字），不在拍攝點就是這張地圖 */
  pageOf(spot: MapEntity | null): { page: string; name: { ja: string; zh?: string }; spotId?: string } {
    const d = (spot?.data ?? {}) as PhotoSpotData
    const s = this.data.spot(d.spotId)
    if (s) {
      const n = spotName(s)
      return { page: `spot:${s.id}`, name: { ja: n.ja, zh: n.zh }, spotId: s.id }
    }
    if (spot && d.name) {
      const n = typeof d.name === 'string' ? { ja: d.name } : { ja: d.name.ja, zh: d.name.zh }
      return { page: `spot:${d.spotId ?? spot.id}`, name: n, spotId: d.spotId }
    }
    const m = this.game.map
    return { page: `map:${m?.id ?? ''}`, name: { ja: m?.name.ja ?? '', zh: m?.name.zh && m.name.zh !== m.name.ja ? m.name.zh : undefined } }
  }

  private onShot(meta: PhotoMeta, score: ShotScore, spotId: string | undefined, png: Promise<boolean>) {
    const s = this.save
    const old = s.album[meta.page]?.[meta.slot]
    const oldMeta = old ? s.photos[old] : undefined
    const quest = !!spotId && s.quests.active.some((q) => q.type === 'photo' && q.spot === spotId && !q.ready && (q.when !== 'night' || meta.t === 'night'))
    const result: PhotoResult = {
      id: meta.id,
      name: meta.name,
      slot: meta.slot,
      score,
      date: { ...this.game.clock.date },
      time: meta.t,
      season: meta.s,
      url: null,
      replace: oldMeta ? { id: oldMeta.id, score: oldMeta.score } : null,
      quest,
    }
    this.pendingShot = { meta, spotId }
    // 委託的照片：拍到就算（跟放不放進相簿那一格分開；相簿留著原本的也沒關係）
    if (quest) {
      s.photos[meta.id] = meta
      for (const q of s.quests.active) if (q.type === 'photo' && q.spot === spotId && !q.ready && (q.when !== 'night' || meta.t === 'night')) q.ready = meta.id
      this.game.changed('flags')
      this.game.save()
    }
    // 這一格是空的：直接放進相簿
    if (!oldMeta) this.keepPhoto()
    this.swapPanel({ kind: 'photo', result })
    // 縮圖：不管有沒有存進 IndexedDB（私密視窗只在記憶體），讀得到就給
    void png.then(async () => {
      const url = await loadThumb(meta.id)
      const p = this.ui.panel
      if (p?.kind === 'photo' && p.result.id === meta.id) this.swapPanel({ kind: 'photo', result: { ...p.result, url } })
    })
  }

  /** 委託做完了：委託的照片沒放進相簿、也沒別的地方用，就刪掉 */
  releasePhoto(id: string) {
    const s = this.save
    if (this.game.state.album.includes(id) || this.photoUsed(id)) return
    if (Object.values(s.album).some((row) => Object.values(row).includes(id))) return
    delete s.photos[id]
    void photoStore().delete(id)
  }

  /** 重新開始：舊遊戲的照片（相簿、相框、委託、明信片用的）從 IndexedDB 刪掉 */
  async forgetPhotos(old: { ext?: Record<string, unknown>; album?: readonly string[] } | null): Promise<void> {
    const sys = (old?.ext?.systems ?? null) as { photos?: Record<string, unknown> } | null
    const ids = new Set([...Object.keys(sys?.photos ?? {}), ...(old?.album ?? [])])
    await Promise.all([...ids].map((id) => photoStore().delete(id)))
  }

  /** 拍好的照片放進相簿（那一格原本的換掉，原本的照片沒人用就刪） */
  keepPhoto(): boolean {
    const shot = this.pendingShot
    if (!shot) return false
    this.pendingShot = null
    const s = this.save
    const { meta } = shot
    const row = (s.album[meta.page] ??= {})
    const old = row[meta.slot]
    row[meta.slot] = meta.id
    s.photos[meta.id] = meta
    const album = this.game.state.album
    if (!album.includes(meta.id)) album.push(meta.id)
    if (old && old !== meta.id) this.dropPhoto(old)
    // 照片太多（不太會發生）：從最舊的、沒有在相簿格子裡的開始刪
    const ids = Object.keys(s.photos)
    if (ids.length > PHOTO_MAX) for (const id of ids.slice(0, ids.length - PHOTO_MAX)) if (!album.includes(id)) this.dropPhoto(id)
    for (const q of s.quests.active) if (q.type === 'photo' && q.spot === shot.spotId && !q.ready && (q.when !== 'night' || meta.t === 'night')) q.ready = meta.id
    this.game.changed('flags')
    this.game.save()
    return true
  }

  /** 不要這一張（那一格留著原本的） */
  discardPhoto() {
    const shot = this.pendingShot
    this.pendingShot = null
    if (shot && !this.photoUsed(shot.meta.id)) void photoStore().delete(shot.meta.id)
  }

  private photoUsed(id: string): boolean {
    const g = this.game
    if (photoInFrame(g, id)) return true
    if (Object.keys(g.state.items).some((k) => k.endsWith(`@${id}`))) return true
    if (roomOf(g).shelf.some((k) => k?.endsWith(`@${id}`))) return true
    return this.save.quests.active.some((q) => q.ready === id)
  }

  private dropPhoto(id: string) {
    const s = this.save
    const album = this.game.state.album
    const i = album.indexOf(id)
    if (i >= 0) album.splice(i, 1)
    if (this.photoUsed(id)) return
    delete s.photos[id]
    void photoStore().delete(id)
  }

  // ---------- 店 ----------
  /** 買一樣（扣旅費、進行李、收銀聲、短曲、存檔） */
  buy(e: StockEntry, photo?: string | null): 'ok' | 'money' | 'gone' {
    const r = buyItem(this.game, e, photo)
    if (r === 'ok') {
      this.sfx('register')
      this.jingle('bought')
      this.game.save()
    } else this.sfx('error')
    this.ui.tick++
    return r
  }

  eat(e: StockEntry): 'ok' | 'money' | 'gone' {
    const r = eatItem(this.game, e)
    if (r === 'ok') {
      this.sfx('register')
      this.game.save()
    } else this.sfx('error')
    this.ui.tick++
    return r
  }

  card(key: string): ItemCardData | null {
    return itemCard(key, this.data)
  }

  // ---------- 行李 ----------
  removeItem(key: string) {
    return removeItem(this.game, key)
  }

  // ---------- 房間 ----------
  /** 進房間：記下從哪裡來，換到 room 地圖 */
  enterRoom(): boolean {
    const g = this.game
    const room = this.deps.maps?.('room')
    const start = room?.start
    if (!room || !start) return false
    const p = g.player
    if (g.map && g.map.id !== 'room') this.save.roomFrom = { map: g.map.id, x: p.x, y: p.y, dir: p.dir }
    g.startWarp({ x: p.x, y: p.y, to: 'room', tx: start.x, ty: start.y, dir: start.dir ?? 'up', sfx: 'door' })
    return true
  }

  /** 出房間：回到進來的地方（沒有就回 world 的起點鎮的車站） */
  exitPlace(): Place | null {
    const from = this.save.roomFrom
    if (from) return from
    const t = this.data.town(this.data.world?.startTown)
    const map = t?.mapId ? this.deps.maps?.(t.mapId) : null
    return map?.start ? { map: map.id, x: map.start.x, y: map.start.y, dir: map.start.dir ?? 'down' } : null
  }

  /** 架子、相框的角色：放了東西才看得到 */
  spawnSlot(e: MapEntity, area: 'shelf' | 'frame'): Actor {
    const a = new Actor(e.id, 'npc', { frame: () => ({ sprite: iconSprite('box'), ax: 8, ay: 16 }) }, e.x, e.y, 'down')
    a.entity = e
    a.solid = false
    this.dressSlot(a, area)
    return a
  }

  private dressSlot(a: Actor, area: 'shelf' | 'frame') {
    const i = slotIndex(dataOf<SlotData>(a.entity!), area)
    const r = roomOf(this.game)
    const v = i === null ? null : area === 'shelf' ? r.shelf[i] : r.frames[i]
    a.hidden = !v
    if (!v) return
    const sprite = area === 'frame' ? pictureSprite() : iconSprite(this.card(v)?.icon ?? 'box')
    a.look = { frame: () => ({ sprite, ax: 8, ay: area === 'frame' ? 14 : 16 }) }
  }

  /** 擺設改了：房間裡的東西重畫 */
  refreshRoom() {
    for (const a of this.game.npcs) {
      const k = a.entity?.kind
      if (k === 'shelfSlot') this.dressSlot(a, 'shelf')
      else if (k === 'frameSlot') this.dressSlot(a, 'frame')
    }
    this.ui.tick++
  }

  // ---------- 路人 ----------
  spawnNpc(e: MapEntity): Actor {
    return new Npc(e, this.lookFor(e))
  }

  /** 店、剪票口、旅館、授与所的櫃台後面站一個人（data 有 look 或 lookSeed 才生） */
  spawnStaff(e: MapEntity): Actor | null {
    const d = dataOf<NpcData>(e)
    if (d.look === undefined && d.lookSeed === undefined) return null
    return new Npc({ ...e, data: { ...e.data, move: 'stand' } }, this.lookFor(e))
  }

  private lookFor(e: MapEntity): ActorLook {
    const d = dataOf<NpcData>(e)
    const seed = typeof d.lookSeed === 'number' ? d.lookSeed >>> 0 : typeof d.look === 'number' ? d.look >>> 0 : seedOf(e.id)
    const made = this.looks.get(seed)
    if (made) return made
    const gen = this.deps.generatedNpcs && d.role !== 'clerk' && d.role !== 'inn' && e.kind === 'npc'
    if (gen) this.queueLook(seed)
    if (typeof d.look === 'string') return lookOf(d.look)
    if (d.role === 'clerk' || d.role === 'inn' || e.kind !== 'npc') return lookOf('clerk')
    return lookOf(folkOf(seed))
  }

  private queue: number[] = []
  private busyLook = false
  /** 路人用旅人產生器組（一個約幾十毫秒）：閒下來時一個一個做，做好換上 */
  private queueLook(seed: number) {
    if (this.queue.includes(seed) || this.looks.has(seed)) return
    this.queue.push(seed)
    if (!this.busyLook) this.nextLook()
  }
  private nextLook() {
    const seed = this.queue.shift()
    if (seed === undefined) {
      this.busyLook = false
      return
    }
    this.busyLook = true
    const idle = (fn: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200))
    idle(() => {
      void import('../avatar/npc')
        .then(({ npcLook }) => npcLook(seed))
        .then((look) => {
          if (look) {
            if (this.looks.size > 48) this.looks.delete(this.looks.keys().next().value!)
            this.looks.set(seed, look)
            for (const a of this.game.npcs) {
              const d = a.entity ? dataOf<NpcData>(a.entity) : null
              const s = typeof d?.lookSeed === 'number' ? d.lookSeed >>> 0 : typeof d?.look === 'number' ? d.look >>> 0 : a.entity ? seedOf(a.entity.id) : -1
              if (d && s === seed && a.entity?.kind === 'npc') a.look = look
            }
          }
        })
        .catch(() => undefined)
        .finally(() => this.nextLook())
    })
  }

  whoOf(e: MapEntity): string {
    const d = dataOf<NpcData>(e)
    if (d.role === 'clerk') return WHO_LABEL.clerk
    if (d.role === 'inn') return this.region() === 'okinawa' ? WHO_LABEL.minshuku : WHO_LABEL.ryokan
    return WHO_LABEL.passer
  }

  // ---------- 事件 ----------
  private onMapEnter(id: string) {
    const s = this.save
    const code = townCodeOfMap(id)
    this.ui.hint = null
    if (code) {
      s.lastTown = code
      if (id.startsWith('town:') && !s.visited.includes(code)) {
        s.visited.push(code)
        // 第一次到這一鎮（新遊戲的起點不算：從車站大廳直接坐車走也一樣）
        if (code !== this.data.world?.startTown) this.jingle('arrive')
      }
    }
    if (this.camera.open) this.camera.stop()
    // 做不完的委託（地點不在地圖上：生成規則改了的舊存檔；過了期限）拿掉
    this.pruneQuests()
  }

  /** 委託：過了期限、地點不在地圖上的取消 */
  pruneQuests() {
    const gone = pruneQuests(this.game, { data: this.data, townSpots: this.deps.townSpots })
    if (gone.length) this.ui.tick++
  }

  private onStep(x: number, y: number) {
    const spot = this.game.view?.entitiesAt(x, y).find((e) => e.kind === 'photoSpot') ?? null
    if (!spot) {
      if (this.ui.hint) this.ui.hint = null
      return
    }
    this.ui.hint = { name: this.pageOf(spot).name.ja || null, spot }
  }

  /** DEV：狀態 */
  dev() {
    return {
      panel: this.ui.panel?.kind ?? null,
      hint: this.ui.hint,
      camera: { open: this.camera.open, zoom: this.camera.zoom, frame: { ...this.camera.frame } },
      save: JSON.parse(JSON.stringify(this.save)) as SystemsSave,
      room: JSON.parse(JSON.stringify(roomOf(this.game))) as unknown,
      festival: this.festivalNow(),
      bloom: this.bloomNow(),
      town: this.townHere()?.id ?? null,
    }
  }
}

/** PlayView 一行接上：回傳的東西給 SystemsLayer；離開頁面時 uninstall() */
export function installSystems(game: Game, deps: SystemsDeps = {}): GameSystems {
  return new GameSystems(game, deps).install()
}
