import { onScopeDispose, ref, type Ref, shallowRef, type ShallowRef, watch } from 'vue'

import type { Slot } from '../../data/outfits'
import { useAvatarStore } from '../../stores/avatar'
import { useUserStore } from '../../stores/user'
import type { ActorLook } from '../engine/types'
import { defaultLook } from '../sprites'

import { cacheKey, colourFingerprint, lookSignature, travellerCache, writePointer } from './cache'
import { whenIdle } from './draw2d'
import { ABOUT_SIZE, GAME_SIZE } from './geometry'
import { buddyLook, travellerLook } from './looks'
import type { GameRecord, TravellerLook, WalkerRecord } from './types'

/**
 * 遊戲裡的旅人與夥伴（規格 §7）：讀 avatar store（只讀；沒登入就是 store 的預設值），
 * 外觀或穿著改了就（debounce）重做；先用記憶體／IndexedDB 的快取，沒有才在閒下來的時候生成，不卡第一格。
 * 生成好之前、或生成失敗，用 game/sprites 手畫的預設旅人與柴犬。沒有穿夥伴的人也是柴犬跟著。
 * 登入的人順便做 /about 的一組、寫 localStorage 的指標（像素散步換成他的旅人）。
 *
 * 用法（PlayView）：
 *   const traveller = useTravellerSprites()
 *   game = new Game({ …, player: traveller.player.value, follower: traveller.follower.value })
 *   offs.push(traveller.attach(game))
 */
export type TravellerStatus = 'default' | 'generating' | 'ready' | 'failed'

export interface TravellerInfo {
  key: string
  from: 'memory' | 'idb' | 'generated' | 'partial'
  side: GameRecord['side']
  /** 生成花的毫秒（從快取來的是當初生成的時間） */
  ms: number
  timings?: Record<string, number>
}

/** Game 裡會用到的兩個方法（engine/game.ts 的 setLook、setFollowerLook） */
export interface LookTarget {
  setLook(look: ActorLook): void
  setFollowerLook(look: ActorLook): void
}

export interface TravellerSprites {
  player: ShallowRef<ActorLook>
  follower: ShallowRef<ActorLook>
  status: Ref<TravellerStatus>
  info: ShallowRef<TravellerInfo | null>
  /** 把旅人、夥伴接到 Game：現在就換，之後改了也跟著換；回傳拆掉的函式 */
  attach(game: LookTarget): () => void
  /** 馬上重做（不管快取） */
  regenerate(): void
}

export interface TravellerOptions {
  /** 外觀改了等多久再重做（毫秒，預設 400） */
  debounce?: number
  /** 側面用 3D（預設 true） */
  side3d?: boolean
  /** 3D 側面（主執行緒會忙幾百毫秒）什麼時候做：PlayView 給「標題畫面、手帳、暫停、換地圖的時候」；沒給就馬上 */
  whenQuiet?(): Promise<void>
}

/** avatar store 現在的外觀（背景不算） */
function currentLook(avatar: ReturnType<typeof useAvatarStore>): TravellerLook {
  const equipped: TravellerLook['equipped'] = {}
  for (const [slot, id] of Object.entries(avatar.worn) as Array<[Slot, string | undefined]>) if (slot !== 'bg' && id) equipped[slot] = id
  return { parts: { ...avatar.parts }, equipped }
}

export function useTravellerSprites(o: TravellerOptions = {}): TravellerSprites {
  const avatar = useAvatarStore()
  const user = useUserStore()
  const player = shallowRef<ActorLook>(defaultLook('traveler'))
  const follower = shallowRef<ActorLook>(defaultLook('shiba'))
  const status = ref<TravellerStatus>('default')
  const info = shallowRef<TravellerInfo | null>(null)
  const cache = travellerCache()
  let token = 0
  let timer = 0
  let force = false

  function apply(rec: GameRecord, from: TravellerInfo['from'], timings?: Record<string, number>) {
    // 同一組（快取又讀了一次）不用換
    if (info.value?.key === rec.key && info.value.from !== 'partial' && from !== 'generated' && status.value === 'ready') return
    player.value = travellerLook(rec)
    follower.value = rec.buddy ? buddyLook(rec.buddy) : defaultLook('shiba')
    info.value = { key: rec.key, from, side: rec.side, ms: rec.ms, timings }
    if (from !== 'partial') status.value = 'ready'
  }

  async function run(my: number) {
    const look = currentLook(avatar)
    const uid = user.user?.uid ?? null
    const fp = colourFingerprint()
    const keys = { game: cacheKey(GAME_SIZE, look, fp), about: cacheKey(ABOUT_SIZE, look, fp) }
    const stale = () => my !== token
    if (!force) {
      const [g, a] = await Promise.all([cache.get(keys.game), uid ? cache.get(keys.about) : Promise.resolve(null)])
      if (stale()) return
      if (g?.rec.kind === 'game') {
        apply(g.rec, g.from)
        // 登入的人還要有 /about 的一組；有了就只更新指標
        if (!uid || a) {
          if (uid) writePointer(uid, keys)
          return
        }
      }
    }
    force = false
    await whenIdle()
    if (stale()) return
    status.value = 'generating'
    let out: { game: GameRecord; about: WalkerRecord | null; timings: Record<string, number> } | null = null
    try {
      const { generateTraveller } = await import('./generate')
      out = await generateTraveller(look, {
        keys,
        about: !!uid,
        side3d: o.side3d ?? true,
        isStale: stale,
        whenQuiet: o.whenQuiet,
        onPartial: (r) => {
          if (!stale() && status.value !== 'ready') apply(r, 'partial')
        },
      })
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('traveller：旅人生成失敗，用預設的旅人', e)
    }
    if (stale()) return
    if (!out) {
      // 失敗：留著目前的（預設的手畫旅人，或之前的那一組）
      if (status.value === 'generating') status.value = info.value ? 'ready' : 'failed'
      return
    }
    apply(out.game, 'generated', out.timings)
    if (import.meta.env?.DEV) console.info('traveller：生成', out.game.side, `${out.game.ms}ms`, out.timings)
    await cache.put(out.game)
    if (out.about) await cache.put(out.about)
    if (uid && out.about && !stale()) writePointer(uid, keys)
  }

  function schedule(delay: number) {
    token++
    const my = token
    clearTimeout(timer)
    timer = window.setTimeout(() => void run(my), delay)
  }

  let first = true
  // 字串比較：store 重算了但外觀沒變（例：成就的狀態更新）不會重做
  watch(
    () => `${lookSignature(currentLook(avatar))}|${user.user?.uid ?? ''}`,
    () => {
      schedule(first ? 0 : (o.debounce ?? 400))
      first = false
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    token++
    clearTimeout(timer)
  })

  return {
    player,
    follower,
    status,
    info,
    attach(game: LookTarget) {
      game.setLook(player.value)
      game.setFollowerLook(follower.value)
      const stop1 = watch(player, (l) => game.setLook(l))
      const stop2 = watch(follower, (l) => game.setFollowerLook(l))
      return () => {
        stop1()
        stop2()
      }
    },
    regenerate() {
      force = true
      schedule(0)
    },
  }
}
