import type { Weather } from '../../engine/render'
import type { Season, TimeOfDay } from '../../engine/types'

/**
 * 虛構的台詞（規格 §8.7）：路人閒聊、店員、茶屋裡的一句、旅館的人、祭典的人。
 * 都是遊戲寫的，所以不准有真實的地名、店名、祭典名、站名、特色名、數字＋年／月／km、驚嘆號、emoji（flavour.test.ts 擋）。
 * 寫法照旅遊書與路人說話：短、安靜、具體；不要每句都講景色（天氣、腳累、零錢、貓、等車…）。
 */
/** airport：機場的大廳的路人（P4：台灣的出發大廳、日本的機場大廳） */
export type FlavourWho = 'passer' | 'station' | 'shinise' | 'shokudo' | 'teahouse' | 'inn' | 'festival' | 'airport'
export type FlavourRegion = 'kinki' | 'okinawa' | 'kanto' | 'hokkaido' | 'any'

/** 花況（world/season.ts 的 Flower：平年值算的「開著」）：講開花、紅葉的台詞只在那個時候說 */
export type FlavourBloom = 'ume' | 'sakura' | 'ajisai' | 'kaede' | 'ichou' | 'kanhi'

/** 街上（大樓、高架、住商混合的街）或郊外（田、牧場、矢羽根）：world 生成那一鎮時決定的（地圖的 urban） */
export type FlavourSetting = 'urban' | 'rural'

export interface FlavourWhen {
  season?: readonly Season[]
  time?: readonly TimeOfDay[]
  weather?: readonly Weather[]
  /** 其中一種開著（紅著）才說 */
  bloom?: readonly FlavourBloom[]
  /** 只在街上或郊外說（講大樓、高架的；講田、牛、拖拉機、矢羽根的） */
  setting?: readonly FlavourSetting[]
}

export interface FlavourLine {
  id: string
  who: FlavourWho
  region: FlavourRegion
  when?: FlavourWhen
  text: string
}

/** 一組台詞（同一個 who、region、when）寫成一個陣列，這裡展開成一句一句、編 id */
export function lines(who: FlavourWho, region: FlavourRegion, tag: string, texts: readonly string[], when?: FlavourWhen): FlavourLine[] {
  return texts.map((text, i) => ({ id: `${region}.${who}.${tag}.${i + 1}`, who, region, when, text }))
}
