import type { Gfx } from './gfx'
import type { Season, TimeOfDay } from './palette'
import type { Rng } from './rng'
import type { Sprite } from './sprite'

/**
 * 像素散步（DESIGN.md §14a）的型別：地區（AreaDef）、腳本（EventDef）、轉場（TransitionDef）。
 * 畫面是 W×160 的點陣（GBA 的高度），W 隨容器寬度變（約 190–480）。旅人站在 x ≈ 0.32W，腳底在 FLOOR。
 */
export const H = 160
/** 旅人腳底（路面）的 y */
export const FLOOR = 138

export type Weather = 'clear' | 'rain' | 'snow'
export interface Env {
  time: TimeOfDay
  season: Season
  weather: Weather
}

/** 地區的特徵：共用腳本用來挑地方（例：貓到處都有，海龜只在 coast） */
export type AreaTag = 'city' | 'town' | 'shrine' | 'nature' | 'mountain' | 'coast' | 'snow' | 'farm' | 'deer' | 'station'

export interface LayerDef {
  /** 相對地面的捲動速度：0 不動、1 跟地面一樣；> 1 是前景 */
  speed: number
  /**
   * 畫這一層的長條：寬 w（這一區捲得到的範圍，已含畫面寬）、高 H；原點是長條左上。
   * 用 rng 擺東西（同一次造訪畫出來一樣；下次再來同一區會換一條街）
   */
  /** w：長條的寬；view：畫面寬（W）。長條比 W 寬，地區要照畫面寬擺東西（例：富士山在畫面中間）時用 view */
  draw(g: Gfx, w: number, rng: Rng, env: Env, view: number): void
}

export interface AreaDef {
  id: string
  /** 地名（banner 上的大字，台灣用字） */
  name: string
  /** 羅馬字（banner 上的小字） */
  romaji: string
  tags: AreaTag[]
  /** 這一區走多長（地面的 px）：900–1600，旅人一秒走 22px */
  length: number
  /** 可以出現的季節、時段（沒寫就全部） */
  seasons?: Season[]
  times?: TimeOfDay[]
  /** 冬天腳本要下雨時改成下雪（北海道、白川鄉） */
  snowy?: boolean
  /** 海平線的 y（有海的地方）：天上的東西（彩虹）畫到這裡為止 */
  horizon?: number
  /** 天空：整個畫面（W×H，不捲動），遠景畫在上面 */
  sky(g: Gfx, env: Env, rng: Rng): void
  /** 背景的層，遠到近（speed < 1） */
  layers: LayerDef[]
  /** 地面（speed 1）：旅人走的路與路旁 */
  ground: LayerDef
  /** 前景（speed > 1，畫在旅人前面）；可省略 */
  front?: LayerDef
  /** 這一區自己的腳本（挑的時候權重 ×2.5） */
  events?: EventDef[]
}

/** yield 的東西：秒數（等多久）、null（等一格）、函式（等到它回傳 true） */
export type Wait = number | null | undefined | (() => boolean)
export type Script = Generator<Wait, void, unknown>

/** 畫在哪一層：sky 天空與遠景之間、mid 遠景與地面之間、back 地面與旅人之間、front 旅人前面、over 最上面（天氣、轉場） */
export type Z = 'sky' | 'mid' | 'back' | 'front' | 'over'

export interface ActorInit {
  frames?: Sprite | Sprite[]
  /** 動畫每秒幾格（預設 6） */
  fps?: number
  /** x：sprite 的中心；y：sprite 的底邊（畫面座標）。world 的 x 是地面座標（畫面 x + cam） */
  x: number
  y: number
  /** world 跟地面一起捲（預設）；screen 固定在畫面上；數字＝視差（相對地面的速度，例 0.3 跟遠景一起） */
  space?: 'world' | 'screen' | number
  z?: Z
  flip?: boolean
  vx?: number
  vy?: number
  /** 重力（px/s²，往下為正） */
  gravity?: number
  /** 抖色透明度（16 實、8 半透明） */
  level?: number
  /** 自訂畫法（取代 frames）：x、y 是畫面座標（中心、底邊） */
  draw?(g: Gfx, x: number, y: number, a: Actor): void
  /** 每格更新（在 vx、vy 之後） */
  update?(a: Actor, dt: number): void
}

export interface Actor extends Required<Pick<ActorInit, 'x' | 'y' | 'space' | 'z' | 'flip' | 'vx' | 'vy' | 'gravity' | 'level' | 'fps'>> {
  frames: Sprite[]
  /** 目前第幾格（動畫）；可以手動指定，fps = 0 時不自己換 */
  frame: number
  /** 出現多久了（秒） */
  age: number
  alive: boolean
  hidden: boolean
  draw?: ActorInit['draw']
  update?: ActorInit['update']
  /** 畫面上的 x（中心） */
  sx(): number
  remove(): void
}

export type Emote = 'surprise' | 'question' | 'heart' | 'note' | 'dots' | 'sweat' | 'zzz'

export interface Hero {
  /** 畫面 x（腳的中心）、腳底 y */
  readonly x: number
  readonly y: number
  /** 地面座標 */
  readonly worldX: number
  readonly walking: boolean
  /** 跳起來的高度（0 或負數）：腳本畫拿在手上的東西時加上去 */
  readonly lift: number
  /** 停下來（畫面也停止捲動） */
  stop(): void
  walk(): void
  /** 跳一下（高度 px） */
  jump(height?: number): void
  /** 頭上冒一個符號 */
  emote(e: Emote, sec?: number): void
  face(dir: 'left' | 'right'): void
  /** 拿著的東西 */
  hold: null | 'umbrella' | 'camera'
  hidden: boolean
  /** 走路速度的倍率（1 = 22px/s） */
  speed: number
}

export interface Handle {
  stop(): void
}

/** 腳本拿到的舞台 */
export interface Stage {
  readonly W: number
  readonly H: number
  readonly FLOOR: number
  readonly rng: Rng
  readonly env: Env
  readonly area: AreaDef
  /** 地面捲到哪（世界 x = 畫面 x + cam） */
  readonly cam: number
  /** 這一區開始後幾秒 */
  readonly t: number
  /** 這一格的秒數（固定 1/60） */
  readonly dt: number
  readonly hero: Hero
  spawn(a: ActorInit): Actor
  /** 每格畫一次，直到 handle.stop() 或腳本結束：天氣、光、遮罩。t 是開始畫之後的秒數；畫的是畫面座標 */
  paint(z: Z, fn: (g: Gfx, t: number) => void): Handle
  /** 換時段、天氣：背景重畫，1.2 秒抖色淡過去 */
  setEnv(patch: Partial<Env>): void
  /** 等幾秒（yield* s.wait(1)） */
  wait(sec: number): Script
  /** actor 以 speed px/s 走到 x（同它的座標系），走的時候朝向前進方向 */
  move(a: Actor, x: number, speed: number): Script
  /** 旅人要停下來之前：等前景（樹幹、電線桿）走過、沒有擋住旅人（最多 max 秒，預設 3） */
  clearOfFront(max?: number): Script
}

export interface EventDef {
  id: string
  /** main：一次只有一個（旅人會停下來看、互動）；ambient：天氣、光、遠處的動靜，可以和 main 同時 */
  kind?: 'main' | 'ambient'
  /** 權重（預設 1） */
  weight?: number
  /** 共用腳本：哪些地區可以出現（標籤任一）；沒寫就到處都可以 */
  tags?: AreaTag[]
  when?: { time?: TimeOfDay[]; season?: Season[]; weather?: Weather[] }
  /** 這些地區（id）不出現：標籤對得上、但那裡不會有的東西（例：沖繩沒有狸貓） */
  except?: string[]
  /** 挑之前問一次：前面有沒有這個腳本要用的地方（鳥居在畫面裡、前面有攤子）。只能讀，不能 spawn */
  ready?(s: Stage): boolean
  run(s: Stage): Script
}

export interface TransitionStage extends Stage {
  /** 下一區 */
  readonly next: AreaDef
  /** 換到下一區：之後 area、cam、env 都是新的 */
  swap(): void
  /** 蓋著的畫面揭開了：地名牌這時候出來（沒叫的話，轉場結束或換過去 3 秒後出來） */
  reveal(): void
}

export interface TransitionDef {
  id: string
  weight?: number
  /** 適合的組合（例：下一區有 coast 才搭船）；沒寫就都可以 */
  fits?(from: AreaDef, to: AreaDef): boolean
  run(s: TransitionStage): Script
}
