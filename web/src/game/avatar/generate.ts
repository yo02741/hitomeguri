import { outfitById } from '../../data/outfits'
import { parseColor, readTokens } from '../../services/pixelwalk/palette'

import { composeBack, composeFront, localVars } from './compose'
import { drawDoll, ensureDollDefs, yieldMain } from './draw2d'
import { ABOUT_SIZE, buddyFrame, frame, type Frame, GAME_SIZE, legTop } from './geometry'
import { buddyFacing, heldRule } from './held'
import { kmeans, samplePixels } from './kmeans'
import {
  addShade,
  cleanOrphans,
  cleanSeams,
  dominant,
  edgeShade,
  LAYER,
  layerMap,
  majority,
  mirror,
  nearestIndex,
  ORDER_FRONT,
  ORDER_HAND_BEHIND,
  outline,
  stampEyes,
  toFrame,
} from './pixelize'
import { sideTemplate, type TemplateInk } from './template'
import type { Facing, GameRecord, Img, Overhead, Raster, Rgb, RgbFrame, SpriteSize, TravellerLook, WalkerRecord } from './types'
import { umbrellaSprite } from './umbrella'
export { GEN_VERSION } from './version'
import { blink, walkFrontBack, walkSide } from './walk'

/**
 * 你的旅人變像素人（規格 §7）：一隻旅人 → 遊戲用的一組（20×28：下、上、左 × 站、左步、右步）
 * ＋ /about 像素散步用的一組（16×24 朝右：走 4、站 2、跳 1）＋夥伴＋頭頂的傘。
 * 正面、背面是 2D（紙娃娃的 SVG），側面是 3D（沒有 WebGL 時用參數化範本）。
 * 每一步之間讓出主執行緒；isStale() 變 true 就放棄（外觀又改了）。
 */
/** 大圖每個像素幾個細格 */
const F = 8
/** 旅人自己的顏色幾色（不含外框的墨色與交界的深色） */
const COLORS = 10

export interface GenerateOptions {
  keys: { game: string; about: string }
  /** 要不要做 /about 的一組（登入的人才需要） */
  about?: boolean
  /** 側面用 3D（預設 true；false 只用範本，NPC 用） */
  side3d?: boolean
  /** 2D 做完、3D 還沒好時先給一組（側面是範本） */
  onPartial?(game: GameRecord): void
  isStale?(): boolean
  /** 3D 的側面（主執行緒會連著忙幾百毫秒）等這個好了才做：遊戲裡等打開手帳、暫停、換地圖的時候 */
  whenQuiet?(): Promise<void>
}

export interface Generated {
  game: GameRecord
  about: WalkerRecord | null
  /** 各步驟花的毫秒 */
  timings: Record<string, number>
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** 這隻旅人在某個尺寸的一組素材 */
interface Pass {
  fr: Frame
  ids: Int8Array
  eyes: Float32Array
}

export async function generateTraveller(look: TravellerLook, o: GenerateOptions): Promise<Generated | null> {
  const t0 = now()
  const timings: Record<string, number> = {}
  let mark = t0
  const tm = (k: string) => {
    const t = now()
    timings[k] = Math.round((t - mark) * 10) / 10
    mark = t
  }
  const stale = () => !!o.isStale?.()
  const release = await ensureDollDefs()
  try {
    const ink: Rgb = parseColor(readTokens().ink)
    const skinRgb = parseColor(css(`--color-doll-skin-${look.parts.skin}`))
    const local = localVars(look)
    const handId = look.equipped.hand
    const rule = heldRule(handId)
    const showHand = rule !== 'overhead'
    const handBehind = rule === 'behind'
    const hi = (inner: string, fr: Frame, ids = false) =>
      drawDoll(inner, local, [fr.x0, fr.y0, fr.vw, fr.vh], fr.s * F, fr.size.cw * F, fr.size.ch * F, ids)

    // ---------- 遊戲的一組：大圖三張（正面、正面的圖層、背面） ----------
    const fr = frame(GAME_SIZE)
    const { cw, ch } = GAME_SIZE
    const frontHi = await hi(composeFront(look, fr.g, { hand: showHand, handBehind }), fr)
    const idsHi = await hi(composeFront(look, fr.g, { ids: true, hand: showHand, handBehind }), fr, true)
    const backHi = await hi(composeBack(look, fr.g, { hand: showHand }), fr)
    tm('raster')
    if (stale()) return null
    await yieldMain()

    // 調色盤：正面＋背面一起分 10 色（四個方向的顏色一樣），最後加外框的墨色
    const pal = kmeans([...samplePixels(frontHi, 6000, 1), ...samplePixels(backHi, 3000, 2)], COLORS)
    const base = pal.length
    pal.push(ink)
    const INK = base
    const colors = pal.slice(0, base)
    tm('kmeans')
    await yieldMain()

    // 正面：多數決 → 眼睛 → 清孤立像素 → 圖層交界加深
    const gp: Pass = { fr, ...layerMap(idsHi, cw, ch, F) }
    const eyed = stampEyes(majority(frontHi, cw, ch, F, colors), gp.eyes, INK)
    const frontClean = cleanOrphans(eyed.raster, INK, eyed.fixed)
    const front = edgeShade(frontClean, gp.ids, pal, handBehind ? ORDER_HAND_BEHIND : ORDER_FRONT, INK)
    const lt = legTop(fr)
    const down = walkFrontBack(front, lt).map((r) => toFrame(cw, ch, outline(r, INK), pal)) as GameRecord['down']
    // 背面
    const back = cleanOrphans(majority(backHi, cw, ch, F, colors), INK)
    const up = walkFrontBack(back, lt).map((r) => toFrame(cw, ch, outline(r, INK), pal)) as GameRecord['up']
    tm('front+back')
    if (stale()) return null
    await yieldMain()

    // 側面先用範本（3D 好了再換）
    const skin = nearestIndex(colors, skinRgb)
    const tplInk = templateInk(frontClean, gp, pal, skin, INK, { hat: !!look.equipped.head, hand: showHand && !!handId })
    const left = sideFrames(sideTemplate(GAME_SIZE, tplInk), GAME_SIZE, INK, pal)
    const buddy = look.equipped.buddy ? await buddyOf(look, local, fr.s, ink) : null
    const overhead = rule === 'overhead' && handId ? await umbrellaOf(handId, local, GAME_SIZE, ink) : null
    tm('side-template+buddy')
    const game: GameRecord = {
      fmt: 1,
      kind: 'game',
      key: o.keys.game,
      at: Date.now(),
      w: cw,
      h: ch,
      box: fr.box,
      down,
      up,
      left,
      overhead,
      buddy,
      side: 'template',
      ms: 0,
    }
    if (stale()) return null
    o.onPartial?.({ ...game, ms: Math.round(now() - t0) })
    await yieldMain()

    // ---------- /about 的一組（16×24） ----------
    let ap: Pass | null = null
    let walker: WalkerRecord | null = null
    if (o.about) {
      const fa = frame(ABOUT_SIZE)
      const aIdsHi = await hi(composeFront(look, fa.g, { ids: true, hand: showHand, handBehind }), fa, true)
      ap = { fr: fa, ...layerMap(aIdsHi, ABOUT_SIZE.cw, ABOUT_SIZE.ch, F) }
      const tpl = sideTemplate(ABOUT_SIZE, tplInk)
      walker = walkerRecord(o.keys.about, ABOUT_SIZE, fa, tpl.raster, tpl.eyes, tpl.legTop, skin, INK, pal, {
        buddy: look.equipped.buddy ? await buddyOf(look, local, fa.s, ink) : null,
        overhead: rule === 'overhead' && handId ? await umbrellaOf(handId, local, ABOUT_SIZE, ink) : null,
      })
      tm('about')
      if (stale()) return null
      await yieldMain()
    }

    // ---------- 側面：3D ----------
    if (o.side3d !== false) {
      if (o.whenQuiet) await o.whenQuiet()
      if (stale()) return null
      const { renderSide3D } = await import('./side3d')
      // 沒有 WebGL 的瀏覽器 renderSide3D 直接回 null（不載 three.js）
      const eq = { ...look.equipped }
      if (!showHand) delete eq.hand
      const imgs = await renderSide3D({ parts: look.parts, equipped: eq }, ap ? [fr, ap.fr] : [fr], F, timings, stale)
      tm('side-3d')
      if (stale()) return null
      if (imgs) {
        const s = side3dRaster(imgs[0]!, gp, colors, skin, INK, { ink: tplInk, pal, legTop: legTop(fr, 252) })
        game.left = sideFrames({ raster: s.raster, legTop: legTop(fr, 252) }, GAME_SIZE, INK, pal)
        game.side = '3d'
        if (ap && walker) {
          const a = side3dRaster(imgs[1]!, ap, colors, skin, INK, { ink: tplInk, pal, legTop: legTop(ap.fr, 252) })
          walker = walkerRecord(o.keys.about, ABOUT_SIZE, ap.fr, a.raster, a.eyes, legTop(ap.fr, 252), skin, INK, pal, walker)
        }
      }
    }
    game.ms = Math.round(now() - t0)
    timings.total = game.ms
    return { game, about: walker, timings }
  } finally {
    release()
  }
}

/** 範本的顏色：從正面點陣依圖層取最常見的顏色 */
function templateInk(r: Raster, p: Pass, pal: Rgb[], skin: number, ink: number, has: { hat: boolean; hand: boolean }): TemplateInk {
  const { w, h, raw } = r
  const cells = (pred: (layer: number, y: number) => boolean) => {
    const out: number[] = []
    for (let i = 0; i < raw.length; i++) if (pred(p.ids[i]!, Math.floor(i / w))) out.push(i)
    return out
  }
  const skip = new Set([skin, ink])
  const hem = Math.round((p.fr.g.mapBody(0, 236)[1] - p.fr.y0) * p.fr.s)
  const lt = legTop(p.fr)
  const feet = h - 2
  const hair = dominant(raw, cells((l) => l === LAYER.hairBack || l === LAYER.hairFront), skip)
  const top = dominant(raw, cells((l, y) => l === LAYER.body && y < hem), skip)
  const bottom = dominant(raw, cells((l, y) => l === LAYER.body && y >= lt && y < feet - 1), skip)
  const shoes = dominant(raw, cells((l, y) => l === LAYER.body && y >= feet - 1), skip)
  const hat = has.hat ? dominant(raw, cells((l) => l === LAYER.hat), skip) : -1
  const hand = has.hand ? dominant(raw, cells((l) => l === LAYER.hand), skip) : -1
  const t = top >= 0 ? top : skin
  return {
    hair: hair >= 0 ? hair : ink,
    skin,
    top: t,
    topShade: addShade(pal, t, 0.6),
    bottom: bottom >= 0 ? bottom : t,
    shoes: shoes >= 0 ? shoes : ink,
    hat: hat >= 0 ? hat : undefined,
    hand: hand >= 0 ? hand : undefined,
    ink,
  }
}

/** 3D 的大圖 → 點陣：多數決、清孤立像素、補一隻眼睛（正面眼睛所在的列，從臉的最前面往裡一格） */
function side3dRaster(img: Img, p: Pass, colors: Rgb[], skin: number, ink: number, seams?: { ink: TemplateInk; pal: Rgb[]; legTop: number }): { raster: Raster; eyes: number[] } {
  const { cw, ch } = p.fr.size
  let r = majority(img, cw, ch, F, colors)
  // 身體那幾列（衣服的顏色出現的第一列到腿）：袖子外框轉過來的縫換掉，身體才不會一條一條的
  if (seams && seams.ink.top !== skin) {
    const t = seams.ink
    let y0 = r.h
    for (let y = 0; y < r.h && y0 === r.h; y++) {
      let n = 0
      for (let x = 0; x < r.w; x++) if (r.raw[y * r.w + x] === t.top) n++
      if (n >= 2) y0 = y
    }
    // 衣服的深一階（topShade）不放進來：那條縫通常就是這個顏色
    const keep = new Set([t.top, t.skin, t.bottom, t.hair, t.ink, ...(t.hand !== undefined ? [t.hand] : [])])
    r = cleanSeams(r, y0, seams.legTop, keep, seams.pal, skin)
  }
  r = cleanOrphans(r, ink)
  return sideEye(r, p.eyes, skin, ink)
}

/** 側面的眼睛：正面看得到眼睛的那幾列（≥ 0.22，沒有就取最多的一列），朝左，第一個皮膚色往裡一格 */
export function sideEye(r: Raster, cov: Float32Array, skin: number, ink: number): { raster: Raster; eyes: number[] } {
  const { w, h } = r
  const raw = r.raw.slice()
  const rows = new Set<number>()
  let best = 0
  for (let i = 0; i < cov.length; i++) {
    if (cov[i]! >= 0.22) rows.add(Math.floor(i / w))
    if (cov[i]! > cov[best]!) best = i
  }
  if (!rows.size && cov[best]! > 0.06) rows.add(Math.floor(best / w))
  const eyes: number[] = []
  for (const y of rows) {
    if (y < 0 || y >= h) continue
    let x = 0
    while (x < w && raw[y * w + x] !== skin) x++
    if (x + 1 < w && raw[y * w + x + 1] === skin) {
      raw[y * w + x + 1] = ink
      eyes.push(y * w + x + 1)
    }
  }
  return { raster: { w, h, raw }, eyes }
}

/** 側面（朝左）：[站, 邁步, 邁步]（左步、右步一樣；右邊用左邊翻） */
function sideFrames(s: { raster: Raster; legTop: number }, size: SpriteSize, ink: number, pal: Rgb[]): GameRecord['left'] {
  const [st, step] = walkSide(s.raster, s.legTop)
  const f = (r: Raster) => toFrame(size.cw, size.ch, outline(r, ink), pal)
  const a = f(st)
  const b = f(step)
  return [a, b, b] as GameRecord['left']
}

/** /about 的一組：朝右（左邊翻過來）；眨眼＝眼睛換成皮膚的深一階 */
function walkerRecord(
  key: string,
  size: SpriteSize,
  fr: Frame,
  raster: Raster,
  eyes: number[],
  lt: number,
  skin: number,
  ink: number,
  pal: Rgb[],
  extra: { buddy: WalkerRecord['buddy']; overhead: Overhead | null },
): WalkerRecord {
  const [st, step] = walkSide(raster, lt)
  const lid = addShade(pal, skin, 0.7)
  const closed = blink(st, eyes, lid)
  const f = (r: Raster) => toFrame(size.cw, size.ch, outline(mirror(r), ink), pal)
  const S = f(st)
  const P = f(step)
  // 相機：舉到眼睛前面（朝右時眼睛在右邊）
  const ey = eyes.length ? Math.floor(eyes[0]! / size.cw) : fr.box[1] + Math.round(size.h * 0.3)
  const ex = eyes.length ? size.cw - 1 - (eyes[0]! % size.cw) : fr.box[0] + size.w - 4
  return {
    fmt: 1,
    kind: 'walk',
    key,
    at: Date.now(),
    w: size.cw,
    h: size.ch,
    box: fr.box,
    walk: [S, P, S, P],
    stand: [S, f(closed)],
    jump: P,
    camera: [ex - 1, ey],
    overhead: extra.overhead,
    buddy: extra.buddy,
  }
}

/** 夥伴：圖示範圍縮成旅人比例的 1.5 倍（最大 16px），自己的 8 色＋外框 */
async function buddyOf(look: TravellerLook, local: Record<string, string>, s: number, ink: Rgb): Promise<{ sprite: RgbFrame; facing: Facing } | null> {
  const id = look.equipped.buddy
  const o = id ? outfitById.get(id) : undefined
  if (!o) return null
  const bf = buddyFrame(o.icon, s)
  const img = await drawDoll(o.svg, local, [bf.x0, bf.y0, bf.vw, bf.vh], bf.s * F, bf.w * F, bf.h * F)
  const pal = kmeans(samplePixels(img, 4000, 3), 8)
  const colors = pal.slice()
  pal.push(ink)
  const INK = pal.length - 1
  const r = cleanOrphans(majority(img, bf.w, bf.h, F, colors), INK)
  return { sprite: toFrame(bf.w, bf.h, outline(r, INK), pal), facing: buddyFacing(id) }
}

/** 頭頂的傘：取這把傘自己的 3 色（傘面、一圈、傘柄＝最暗的） */
async function umbrellaOf(id: string, local: Record<string, string>, size: SpriteSize, ink: Rgb): Promise<Overhead | null> {
  const o = outfitById.get(id)
  if (!o) return null
  const [x = 0, y = 0, w = 100, h = 100] = o.icon.split(/\s+/).map(Number)
  const k = 0.5
  const img = await drawDoll(o.svg, local, [x, y, w, h], k, Math.ceil(w * k), Math.ceil(h * k))
  const cs = kmeans(samplePixels(img, 3000, 4, 128), 3)
  if (!cs.length) return null
  const lum = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  const canopy = cs[0]!
  const rest = cs.slice(1)
  const shaft = rest.length ? rest.reduce((a, b) => (lum(b) < lum(a) ? b : a)) : canopy
  const accent = rest.find((c) => c !== shaft) ?? rest[0] ?? canopy
  const pal: Rgb[] = [canopy, accent, shaft, ink]
  const u = umbrellaSprite(Math.round(size.w * 1.4), { canopy: 0, accent: 1, shaft: 2, ink: 3 })
  return { sprite: toFrame(u.raster.w, u.raster.h, u.raster.raw, pal), x: Math.round((size.cw - u.raster.w) / 2), dy: -u.stubBottom }
}
