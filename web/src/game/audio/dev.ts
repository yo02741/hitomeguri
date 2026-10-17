import type { BgmOptions, GameAudio } from './gameAudio'
import type { RenderStats } from './offline'
import { SFX_NAMES, type SfxName } from './sfx'
import { JINGLE_IDS, SONG_IDS, type JingleId, type SongId } from './songs'

/**
 * 開發用：console 裡 `__gameAudio` 試聽每首曲子、每個效果音（正式版不會有）。
 *   await __gameAudio.play('kyoto', { night: true })   放曲子（第一次會 unlock）
 *   await __gameAudio.fx('shutter')                     放效果音
 *   await __gameAudio.jingle('arrive')
 *   await __gameAudio.tour()                            依序放全部效果音
 *   await __gameAudio.check()                           離線算一遍，看峰值、有沒有聲音
 *   __gameAudio.stop()
 */
export interface DevAudio {
  audio: GameAudio
  songs: readonly SongId[]
  jingles: readonly JingleId[]
  sfx: readonly SfxName[]
  play(id: SongId | null, opts?: BgmOptions): Promise<void>
  fx(name: SfxName): Promise<void>
  jingle(name: JingleId): Promise<void>
  tour(gap?: number): Promise<void>
  stop(): void
  check(seconds?: number): Promise<RenderStats[]>
}

declare global {
  interface Window {
    __gameAudio?: DevAudio
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function installDevHook(audio: GameAudio): () => void {
  if (typeof window === 'undefined') return () => {}
  const dev: DevAudio = {
    audio,
    songs: SONG_IDS,
    jingles: JINGLE_IDS,
    sfx: SFX_NAMES,
    async play(id, opts) {
      await audio.unlock()
      audio.bgm(id, opts)
    },
    async fx(name) {
      await audio.unlock()
      audio.sfx(name)
    },
    async jingle(name) {
      await audio.unlock()
      audio.jingle(name)
    },
    async tour(gap = 900) {
      await audio.unlock()
      for (const name of SFX_NAMES) {
        console.info(`效果音：${name}`)
        audio.sfx(name)
        await sleep(gap + (name.startsWith('train') || name === 'plane' || name === 'ferry' || name === 'bus' ? 1600 : 0))
      }
    },
    stop() {
      audio.bgm(null)
    },
    async check(seconds = 5) {
      const { renderAll, townLevels } = await import('./offline')
      const stats = await renderAll(seconds)
      console.table(stats)
      // 鎮曲之間的音量（A 加權）：相差超過 3 dB 就提醒（換鎮、坐飛機到別的縣時忽大忽小）
      const levels = await townLevels()
      console.table(levels)
      const db = levels.map((l) => l.dBA)
      if (Math.max(...db) - Math.min(...db) > 3) console.warn('game audio：鎮曲的音量差太多（A 加權）', levels)
      return stats
    },
  }
  window.__gameAudio = dev
  return () => {
    if (window.__gameAudio === dev) delete window.__gameAudio
  }
}
