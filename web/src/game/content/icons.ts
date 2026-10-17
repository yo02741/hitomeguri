import { drawSprite } from '../../services/pixelwalk/build'
import type { Gfx } from '../../services/pixelwalk/gfx'
import type { Px } from '../../services/pixelwalk/palette'
import type { Sprite } from '../../services/pixelwalk/sprite'

import type { IconId } from './items'

/**
 * 品項的像素小圖（規格 §8.5：依類別套模板：盒、碗、瓶、茶筒、袋；遊戲自己的東西各一張）與印的圖案（站章的剪影）。
 * 都用 Gfx 的指令畫成 px token 的 Sprite（drawSprite 自動描墨色外框）：遊戲裡（房間的架子）照時段換色，
 * DOM（品項卡、印帳）用白天的調色盤畫到 canvas。圖案是遊戲自己畫的模板，不是哪一家店的包裝。
 */
export const ICON = 16

type Draw = (g: Gfx) => void

const ICONS: Record<IconId, Draw> = {
  // 點心盒：盒身、蓋子、繩子
  box: (g) => {
    g.rect(2, 6, 12, 8, 'paper')
    g.rect(2, 4, 12, 3, 'shu-1')
    g.rect(2, 6, 12, 1, 'shu-2')
    g.rect(7, 4, 2, 10, 'gold-1')
    g.rect(3, 12, 10, 1, 'paper-2')
  },
  // 碗：碗身、碗口、熱氣
  bowl: (g) => {
    g.ellipse(8, 8, 6, 2, 'wood-1')
    g.poly([1.5, 8, 14.5, 8, 12, 13, 4, 13], 'shu-2')
    g.rect(5, 13, 6, 1, 'shu-2')
    g.hline(3, 12, 8, 'dirt-1')
    g.px(6, 3, 'stone-1')
    g.px(7, 4, 'stone-1')
    g.px(9, 2, 'stone-1')
    g.px(10, 3, 'stone-1')
  },
  // 瓶：瓶身、瓶頸、標籤
  bottle: (g) => {
    g.rect(6, 1, 4, 2, 'wood-2')
    g.rect(6, 3, 4, 3, 'leaf-3')
    g.rect(4, 6, 8, 9, 'leaf-3')
    g.rect(5, 6, 1, 8, 'leaf-2')
    g.rect(5, 9, 6, 4, 'paper')
    g.hline(6, 9, 11, 'shu-2')
  },
  // 茶筒：圓筒、蓋子、貼紙
  'tea-can': (g) => {
    g.rect(4, 3, 8, 3, 'stone-2')
    g.rect(4, 5, 8, 1, 'stone-3')
    g.rect(4, 6, 8, 9, 'leaf-3')
    g.rect(5, 6, 1, 9, 'leaf-2')
    g.rect(6, 8, 4, 5, 'paper')
    g.vline(8, 9, 11, 'leaf-4')
  },
  // 袋：鋸齒封口的小袋
  bag: (g) => {
    g.rect(3, 4, 10, 10, 'gold-1')
    for (let x = 3; x < 13; x += 2) g.px(x, 3, 'gold-1')
    g.rect(3, 4, 10, 1, 'gold-2')
    g.rect(5, 7, 6, 4, 'shu-2')
    g.rect(6, 8, 4, 2, 'paper')
    g.rect(3, 13, 10, 1, 'gold-2')
  },
  // 明信片：郵票角、幾條線
  postcard: (g) => {
    g.rect(1, 3, 14, 10, 'white')
    g.rect(11, 4, 3, 3, 'sea-2')
    g.hline(2, 8, 6, 'stone-2')
    g.hline(2, 8, 8, 'stone-2')
    g.hline(2, 6, 10, 'stone-2')
    g.vline(9, 5, 11, 'stone-1')
  },
  // 手ぬぐい：折起來的布，條紋
  tenugui: (g) => {
    g.rect(2, 4, 12, 9, 'cloth-1')
    for (let y = 5; y < 13; y += 2) g.hline(2, 13, y, 'white')
    g.rect(2, 12, 12, 1, 'cloth-2')
    g.vline(13, 4, 12, 'cloth-2')
  },
  // 鑰匙圈：環、鍊子、小牌子
  keyholder: (g) => {
    g.ring(5, 4, 2, 'stone-2')
    g.line(6, 6, 8, 8, 'stone-2')
    g.rect(7, 8, 6, 6, 'shu-1')
    g.rect(8, 9, 4, 4, 'paper')
    g.px(10, 11, 'shu-2')
  },
  // 貓的擺飾：坐著的貓
  neko: (g) => {
    g.ellipse(8, 11, 5, 3, 'white')
    g.circle(8, 6, 3, 'white')
    g.tri(5, 4, 6, 1, 7, 4, 'white')
    g.tri(9, 4, 10, 1, 11, 4, 'white')
    g.px(7, 6, 'ink')
    g.px(9, 6, 'ink')
    g.px(8, 7, 'shu-1')
    g.rect(6, 9, 4, 1, 'shu-2')
    g.px(8, 10, 'gold-1')
  },
  // 風獅爺：四方的身體、捲毛
  shisa: (g) => {
    g.rect(4, 8, 8, 6, 'momiji-1')
    g.rect(3, 3, 10, 6, 'momiji-1')
    g.rect(3, 3, 10, 1, 'momiji-2')
    g.px(5, 5, 'ink')
    g.px(10, 5, 'ink')
    g.rect(5, 7, 6, 1, 'white')
    g.px(4, 10, 'momiji-2')
    g.px(11, 10, 'momiji-2')
    g.rect(4, 13, 8, 1, 'momiji-2')
  },
  // 小鳥：圓圓的身體
  tori: (g) => {
    g.ellipse(8, 9, 5, 4, 'sky-day-1')
    g.ellipse(7, 10, 3, 2, 'white')
    g.tri(12, 7, 14, 6, 13, 9, 'sky-day-1')
    g.px(6, 7, 'ink')
    g.tri(3, 8, 1, 9, 3, 10, 'gold-1')
    g.hline(6, 9, 13, 'wood-2')
  },
  // 房間鑰匙：鑰匙＋木牌
  key: (g) => {
    g.rect(2, 3, 5, 8, 'wood-1')
    g.px(4, 5, 'wood-3')
    g.ring(10, 5, 2, 'gold-2')
    g.rect(10, 7, 1, 7, 'gold-1')
    g.rect(11, 11, 2, 1, 'gold-1')
    g.rect(11, 13, 2, 1, 'gold-1')
  },
  // 委託的東西：包袱
  parcel: (g) => {
    g.rect(3, 6, 10, 8, 'lavender')
    g.tri(4, 6, 8, 2, 12, 6, 'lavender')
    g.rect(7, 2, 2, 3, 'cloth-2')
    g.hline(3, 12, 9, 'cloth-2')
    g.px(5, 11, 'white')
    g.px(10, 12, 'white')
  },
}

const cache = new Map<string, Sprite>()

/** 品項的小圖（16×16，含外框） */
export function iconSprite(id: IconId): Sprite {
  const hit = cache.get(id)
  if (hit) return hit
  const s = drawSprite(ICON, ICON, ICONS[id] ?? ICONS.box)
  cache.set(id, s)
  return s
}
export const ICON_IDS = Object.keys(ICONS) as IconId[]

/** 房間牆上的相框（放了自己的照片）：木框、裡面一張風景（遊戲裡只畫這個，照片本身在擺設的面板看） */
export function pictureSprite(): Sprite {
  const hit = cache.get('picture')
  if (hit) return hit
  const s = drawSprite(ICON, 13, (g) => {
    g.rect(1, 1, 14, 11, 'wood-2')
    g.rect(3, 3, 10, 7, 'sky-day-2')
    g.tri(3, 9, 7, 5, 11, 9, 'leaf-3')
    g.rect(3, 9, 10, 1, 'leaf-2')
    g.px(11, 4, 'white')
  })
  cache.set('picture', s)
  return s
}

// ---------- 印的圖案 ----------
/**
 * 代表地標的剪影（站章、參拜印、名城的章用）：照景點的類型套模板，不是那個地標真的樣子
 * （規格 §0：不畫資料沒寫的特徵；剪影只表示「這一站附近有一座神社」這種程度）。
 */
export type Silhouette =
  | 'torii'
  | 'temple'
  | 'castle'
  | 'gusuku'
  | 'museum'
  | 'park'
  | 'bridge'
  | 'island'
  | 'beach'
  | 'tower'
  | 'gate'
  | 'market'
  | 'airport'
  | 'cape'
  | 'utaki'
  | 'house'
  | 'train'

/** 景點的類型（＋名字）→ 剪影 */
export function silhouetteOf(c: string | undefined, name = '', okinawa = false): Silhouette {
  const byType: Record<string, Silhouette> = {
    神社: 'torii',
    寺院: 'temple',
    城: okinawa ? 'gusuku' : 'castle',
    遺跡: okinawa ? 'gusuku' : 'castle',
    史跡: 'house',
    博物館: 'museum',
    美術館: 'museum',
    公園: 'park',
    庭園: 'park',
    名勝: okinawa ? 'utaki' : 'park',
    展望: 'tower',
    橋: 'bridge',
    島: 'island',
    海灘: 'beach',
    岬: 'cape',
    動物園: 'gate',
    水族館: 'gate',
    主題樂園: 'gate',
    市場: 'market',
    購物: 'market',
    街區: 'market',
    機場: 'airport',
  }
  if (c && byType[c]) return byType[c]!
  if (/御嶽|うたき/.test(name)) return 'utaki'
  if (/神社|大社|神宮|宮$/.test(name)) return 'torii'
  if (/寺|院$/.test(name)) return 'temple'
  if (/城|グスク/.test(name)) return okinawa ? 'gusuku' : 'castle'
  return 'house'
}

/** 剪影：畫在 (x, y) 起的 24×20，單色 */
function silhouette(g: Gfx, s: Silhouette, x: number, y: number, k: Px) {
  g.at(x, y, () => {
    switch (s) {
      case 'torii':
        g.rect(1, 2, 22, 2, k)
        g.rect(3, 6, 18, 2, k)
        g.rect(5, 4, 2, 16, k)
        g.rect(17, 4, 2, 16, k)
        g.rect(11, 4, 2, 4, k)
        break
      case 'temple':
        g.tri(0, 9, 12, 2, 24, 9, k)
        g.rect(4, 9, 16, 2, k)
        g.rect(5, 12, 14, 6, k)
        g.cut(10, 14, 4, 4)
        g.rect(2, 18, 20, 2, k)
        break
      case 'castle':
        // 只有石垣與城門（不畫天守）
        g.poly([0, 20, 3, 8, 21, 8, 24, 20], k)
        g.cut(9, 13, 6, 7)
        g.rect(7, 5, 10, 3, k)
        g.rect(9, 3, 6, 2, k)
        break
      case 'gusuku':
        // 彎的石垣與石門
        g.poly([0, 20, 2, 10, 8, 7, 16, 7, 22, 10, 24, 20], k)
        g.cut(9, 13, 6, 7)
        g.cut(10, 12, 4, 1)
        break
      case 'museum':
        g.tri(2, 7, 12, 2, 22, 7, k)
        for (let i = 0; i < 5; i++) g.rect(3 + i * 4, 9, 2, 8, k)
        g.rect(1, 17, 22, 3, k)
        break
      case 'park':
        g.ellipse(12, 6, 9, 4, k)
        g.ellipse(7, 10, 5, 3, k)
        g.rect(11, 9, 2, 9, k)
        g.rect(0, 18, 24, 2, k)
        break
      case 'bridge':
        g.rect(0, 9, 24, 2, k)
        for (let i = 0; i < 24; i++) {
          const yy = 15 - Math.round(Math.sin((i / 23) * Math.PI) * 5)
          g.vline(i, yy, yy + 1, k)
        }
        g.rect(2, 7, 1, 2, k)
        g.rect(21, 7, 1, 2, k)
        for (let i = 0; i < 24; i += 4) g.hline(i, i + 2, 19, k)
        break
      case 'island':
        g.ellipse(12, 12, 9, 4, k)
        g.cut(0, 13, 24, 7)
        g.rect(11, 3, 1, 9, k)
        g.ellipse(12, 3, 4, 1, k)
        for (let i = 0; i < 24; i += 4) {
          g.hline(i, i + 2, 15, k)
          g.hline(i + 2, i + 4, 18, k)
        }
        break
      case 'beach':
        g.circle(17, 5, 3, k)
        for (let i = 0; i < 24; i += 4) {
          g.hline(i, i + 2, 11, k)
          g.hline(i + 2, i + 4, 14, k)
        }
        g.poly([0, 20, 0, 17, 24, 16, 24, 20], k)
        break
      case 'tower':
        g.rect(4, 4, 16, 2, k)
        g.rect(6, 6, 2, 14, k)
        g.rect(16, 6, 2, 14, k)
        g.line(7, 8, 16, 18, k)
        g.line(17, 8, 7, 18, k)
        g.rect(2, 2, 20, 2, k)
        break
      case 'gate':
        g.rect(1, 4, 22, 4, k)
        g.rect(2, 8, 4, 12, k)
        g.rect(18, 8, 4, 12, k)
        g.rect(9, 8, 6, 2, k)
        g.cut(3, 5, 18, 1)
        break
      case 'market':
        g.poly([0, 8, 4, 3, 20, 3, 24, 8], k)
        for (let i = 0; i < 24; i += 4) g.rect(i, 8, 2, 2, k)
        g.rect(1, 11, 2, 9, k)
        g.rect(21, 11, 2, 9, k)
        g.rect(5, 14, 14, 2, k)
        break
      case 'airport':
        g.rect(2, 10, 20, 2, k)
        g.tri(9, 10, 13, 3, 15, 10, k)
        g.tri(9, 12, 13, 18, 15, 12, k)
        g.tri(2, 7, 4, 7, 5, 10, k)
        g.px(22, 11, k)
        break
      case 'cape':
        g.poly([0, 20, 0, 6, 10, 4, 15, 9, 16, 20], k)
        for (let i = 16; i < 24; i += 3) g.hline(i, i + 1, 16, k)
        g.hline(17, 23, 19, k)
        break
      case 'utaki':
        g.poly([1, 20, 4, 6, 9, 9, 11, 20], k)
        g.poly([13, 20, 15, 4, 20, 2, 23, 20], k)
        g.ellipse(12, 3, 6, 2, k)
        break
      case 'house':
        g.tri(0, 9, 12, 2, 24, 9, k)
        g.rect(3, 9, 18, 9, k)
        g.cut(5, 11, 4, 3)
        g.cut(15, 11, 4, 3)
        g.cut(10, 12, 4, 6)
        g.rect(0, 18, 24, 2, k)
        break
      case 'train':
        g.rect(2, 4, 20, 12, k)
        g.cut(4, 6, 4, 4)
        g.cut(10, 6, 4, 4)
        g.cut(16, 6, 4, 4)
        g.rect(0, 17, 24, 1, k)
        g.circle(6, 17, 1, k)
        g.circle(18, 17, 1, k)
        break
    }
  })
}

/** 羅馬字 → 3×5 字型寫得出來的（Nijōjō-mae → NIJOJO-MAE） */
export function pixelRomaji(s: string | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .\-]/g, '')
    .trim()
}

export type StampShape = 'station' | 'sanpai' | 'castle'
export interface StampArt {
  shape: StampShape
  silhouette: Silhouette
  /** 站章：站名的羅馬字（3×5 字） */
  romaji?: string
  /** 名城：番號 */
  no?: number
}

export const STAMP_INK: Record<StampShape, Px> = { station: 'cloth-2', sanpai: 'shu-2', castle: 'ink-2' }
export const STAMP_SIZE: Record<StampShape, { w: number; h: number }> = {
  station: { w: 56, h: 44 },
  sanpai: { w: 36, h: 60 },
  castle: { w: 48, h: 48 },
}

const stampCache = new Map<string, Sprite>()

/**
 * 印的圖案（不含外框）：站章＝圓角的長方形雙框、剪影、站名的羅馬字；參拜印＝直的朱印框、上面一個剪影（名字由 DOM 直書）；
 * 名城＝八角的框、剪影、「NO.53」。
 */
export function stampSprite(a: StampArt): Sprite {
  const key = `${a.shape}|${a.silhouette}|${a.romaji ?? ''}|${a.no ?? ''}`
  const hit = stampCache.get(key)
  if (hit) return hit
  const { w, h } = STAMP_SIZE[a.shape]
  const k = STAMP_INK[a.shape]
  const s = drawSprite(
    w,
    h,
    (g) => {
      if (a.shape === 'station') {
        g.frame(0, 0, w, h, k)
        g.frame(2, 2, w - 4, h - 4, k)
        for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]] as const) g.cut(x, y, 1, 1)
        silhouette(g, a.silhouette, (w - 24) >> 1, 6, k)
        const text = (a.romaji ?? '').slice(0, 12)
        const tw = text.length * 4 - 1
        g.hline(5, w - 6, 29, k)
        g.text(text, Math.max(4, (w - tw) >> 1), 32, k)
        g.hline(5, w - 6, 39, k)
      } else if (a.shape === 'sanpai') {
        g.rect(0, 0, w, h, k)
        g.cut(2, 2, w - 4, h - 4)
        g.frame(4, 4, w - 8, h - 8, k)
        silhouette(g, a.silhouette, (w - 24) >> 1, 7, k)
        g.hline(8, w - 9, 30, k)
      } else {
        // 八角的雙框：外面 2px、裡面 1px（中間先填白，最後換成透明）
        const oct = (i: number, col: Px) => {
          const c = 12
          g.poly([c + i, i, w - c - i, i, w - i, c + i, w - i, h - c - i, w - c - i, h - i, c + i, h - i, i, h - c - i, i, c + i], col)
        }
        oct(0, k)
        oct(2, 'white')
        oct(3, k)
        oct(4, 'white')
        silhouette(g, a.silhouette, (w - 24) >> 1, 8, k)
        if (a.no) {
          const t = `NO.${a.no}`
          g.text(t, (w - (t.length * 4 - 1)) >> 1, 33, k)
        }
      }
    },
    null,
  )
  // 白的底（名城框裡面）是紙的顏色，換成透明
  const white = s.keys.indexOf('white') + 1
  if (white > 0) for (let i = 0; i < s.idx.length; i++) if (s.idx[i] === white) s.idx[i] = 0
  stampCache.set(key, s)
  return s
}
