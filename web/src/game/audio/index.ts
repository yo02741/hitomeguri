/**
 * 遊戲的聲音（規格 §6、§8.8）：仿 GBA 的聲道、tracker 編曲器、效果音、三首 BGM 與三個 jingle。全部 Web Audio 合成，沒有音檔。
 *
 *   const audio = createGameAudio()
 *   // 「開始／繼續」的 click 裡：
 *   await audio.unlock()
 *   audio.bgm('kyoto', { night, festival })
 *   audio.sfx('confirm')
 *   audio.jingle('arrive')
 *   const off = suspendWhenHidden(audio)   // 分頁在背景時暫停
 *   audio.suspend('menu') / audio.resume('menu')
 *
 * 加曲子：songs/ 寫一個 SongDef 加進 songs/index.ts 的 SONGS（tracker 格式見 tracker.ts 開頭）。
 * 加效果音：sfx.ts 的 SFX 加一個名字。
 */
export { createGameAudio, suspendWhenHidden, type AudioState, type BgmOptions, type GameAudio, type GameAudioOptions } from './gameAudio'
export { DEFAULT_SETTINGS, type AudioBus, type AudioSettings } from './settings'
export { SFX_NAMES, type SfxName } from './sfx'
export { JINGLE_IDS, SONG_IDS, type JingleId, type SongId } from './songs'
