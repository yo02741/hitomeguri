import { AREA_ZH, areaCountLabel, areaPrefs, regions } from './regions'

// 成就（DESIGN.md §7.25）：紀念章帳。條件只取真實的名單（日本100名城、Wikidata 的文化指定、8 個地方）
// 與自己的紀錄（去過的日期、已結束的旅行）。介面寫「成就」，程式命名用 achv（badge 已經指主題 marker）。
// 判斷與達成日的推算在 services/achievements.ts；這裡只有目錄與文案。

export type AchvGroup = 'area' | 'trip' | 'time' | 'foot' | 'heritage' | 'castle' | 'pack'
/** core：只需要 marks＋trips＋regions；data：還需要 achievements.json */
export type AchvDep = 'core' | 'data'
export type AchvShape = 'circle' | 'rect' | 'oval' | 'dotted' | 'square' | 'octagon' | 'postmark'
export type Designation = '世界遺產' | '國寶' | '特別史跡' | '特別名勝'
export type AchvRule =
  | { kind: 'area'; area: string }
  | { kind: 'prefs'; need: number }
  | { kind: 'spots'; need: number }
  | { kind: 'trips'; need: number }
  | { kind: 'tripDays'; need: number }
  | { kind: 'tripPrefs'; need: number }
  | { kind: 'tripShared' }
  | { kind: 'revisit'; gap: number }
  | { kind: 'prefOccasions'; need: number; gap: number }
  | { kind: 'seasons' }
  | { kind: 'months' }
  | { kind: 'years'; need: number }
  | { kind: 'tag'; tag: Designation; need: number }
  | { kind: 'castle'; group: '100' | 'zoku'; need: number }
  | { kind: 'prefix'; prefix: string; need: number }

export type AchvPack = 'pokemon' | 'shinise' | 'chara' | 'castle'

export interface AchvDef {
  id: string
  group: AchvGroup
  name: string
  /** 對話框裡的「條件」：只寫事實 */
  hint: string
  /** 印面：上緣的字、主字、副字 */
  face: { top: string; main: string; sub?: string }
  rule: AchvRule
  dep: AchvDep
  /** 屬於哪個擴充包：關掉的擴充包，還沒達成的不列 */
  pack?: AchvPack
  tickets: 0 | 5
  /** 新卡入手時同時拿到好幾個，先蓋 rank 大的（同組裡 need 大的在前） */
  rank: number
}

export const GROUPS: Array<{ key: AchvGroup; label: string; shape: AchvShape; ink: 'visited' | 't-castle' | 'pack' }> = [
  { key: 'area', label: '地方', shape: 'circle', ink: 'visited' },
  { key: 'trip', label: '旅行', shape: 'rect', ink: 'visited' },
  { key: 'time', label: '時節', shape: 'oval', ink: 'visited' },
  { key: 'foot', label: '足跡', shape: 'dotted', ink: 'visited' },
  { key: 'heritage', label: '文化指定', shape: 'square', ink: 'visited' },
  { key: 'castle', label: '名城', shape: 'octagon', ink: 't-castle' },
  { key: 'pack', label: '擴充包', shape: 'postmark', ink: 'pack' },
]
export const groupOf = new Map(GROUPS.map((g) => [g.key, g]))

const RANK: Record<AchvGroup, number> = { area: 70, foot: 60, castle: 50, heritage: 40, trip: 30, time: 20, pack: 10 }

/** 地方：北海道只有一縣，已由初訪章涵蓋 */
export const ACHV_AREAS = [...new Set(regions.map((r) => r.area))].filter((a) => a !== 'hokkaido')

const AREA_TOP: Record<string, string> = { kyushu: 'KYUSHU OKINAWA' }
const AREA_MAIN: Record<string, string> = { chugoku: '中國' }

const TOP = 'HITOMEGURI'

type Seed = Omit<AchvDef, 'rank' | 'dep' | 'tickets'> & { tickets?: 0 | 5 }

function areaDef(area: string): Seed {
  const count = areaCountLabel(area)
  return {
    id: `area-${area}`,
    group: 'area',
    name: `${AREA_ZH[area]} ${count}`,
    hint: `去過${AREA_ZH[area]} ${count}`,
    face: { top: AREA_TOP[area] ?? area.toUpperCase(), main: AREA_MAIN[area] ?? AREA_ZH[area] ?? area, sub: count },
    rule: { kind: 'area', area },
    tickets: 5,
  }
}

const SEEDS: Seed[] = [
  ...ACHV_AREAS.map(areaDef),

  // 旅行
  { id: 'trips-1', group: 'trip', name: '旅行 1 趟', hint: '已結束的旅行 1 趟', face: { top: TOP, main: '1', sub: '趟' }, rule: { kind: 'trips', need: 1 }, tickets: 5 },
  { id: 'trips-5', group: 'trip', name: '旅行 5 趟', hint: '已結束的旅行 5 趟', face: { top: TOP, main: '5', sub: '趟' }, rule: { kind: 'trips', need: 5 }, tickets: 5 },
  { id: 'trips-10', group: 'trip', name: '旅行 10 趟', hint: '已結束的旅行 10 趟', face: { top: TOP, main: '10', sub: '趟' }, rule: { kind: 'trips', need: 10 }, tickets: 5 },
  { id: 'trip-7days', group: 'trip', name: '一趟 7 天', hint: '一趟旅行 7 天以上', face: { top: TOP, main: '7', sub: '天' }, rule: { kind: 'tripDays', need: 7 }, tickets: 5 },
  { id: 'trip-5prefs', group: 'trip', name: '一趟 5 縣', hint: '一趟旅行去了 5 個都道府縣', face: { top: TOP, main: '5', sub: '縣' }, rule: { kind: 'tripPrefs', need: 5 }, tickets: 5 },
  { id: 'trip-shared', group: 'trip', name: '共編的旅行', hint: '有兩位以上成員的旅行結束', face: { top: TOP, main: '共編', sub: '旅行' }, rule: { kind: 'tripShared' }, tickets: 5 },
  { id: 'revisit', group: 'trip', name: '再訪', hint: '同一個地方，相隔 30 天以上再去', face: { top: TOP, main: '再訪' }, rule: { kind: 'revisit', gap: 30 }, tickets: 5 },
  { id: 'pref-3times', group: 'trip', name: '同一縣 3 次', hint: '同一個縣，相隔 30 天以上去過 3 次', face: { top: TOP, main: '3', sub: '次' }, rule: { kind: 'prefOccasions', need: 3, gap: 30 }, tickets: 5 },

  // 時節
  { id: 'seasons-4', group: 'time', name: '四季', hint: '春夏秋冬都有去過的日子', face: { top: TOP, main: '四季', sub: '春夏秋冬' }, rule: { kind: 'seasons' }, tickets: 5 },
  { id: 'months-12', group: 'time', name: '十二個月', hint: '1 月到 12 月都有去過的日子', face: { top: TOP, main: '12', sub: '個月' }, rule: { kind: 'months' }, tickets: 5 },
  { id: 'years-3', group: 'time', name: '3 個年份', hint: '3 個不同的年份有去過的日子', face: { top: TOP, main: '3', sub: '年份' }, rule: { kind: 'years', need: 3 }, tickets: 5 },
  { id: 'years-10', group: 'time', name: '10 個年份', hint: '10 個不同的年份有去過的日子', face: { top: TOP, main: '10', sub: '年份' }, rule: { kind: 'years', need: 10 }, tickets: 5 },

  // 足跡（錢包已依縣、依每 10 個景點給過券）
  { id: 'prefs-10', group: 'foot', name: '都道府縣 10', hint: '去過 10 個都道府縣', face: { top: TOP, main: '10', sub: '都道府縣' }, rule: { kind: 'prefs', need: 10 } },
  { id: 'prefs-30', group: 'foot', name: '都道府縣 30', hint: '去過 30 個都道府縣', face: { top: TOP, main: '30', sub: '都道府縣' }, rule: { kind: 'prefs', need: 30 } },
  { id: 'prefs-47', group: 'foot', name: '都道府縣 47', hint: '47 個都道府縣都去過', face: { top: TOP, main: '47', sub: '都道府縣' }, rule: { kind: 'prefs', need: 47 } },
  { id: 'spots-10', group: 'foot', name: '足跡 10 處', hint: '去過的地方 10 處', face: { top: TOP, main: '10', sub: '處' }, rule: { kind: 'spots', need: 10 } },
  { id: 'spots-100', group: 'foot', name: '足跡 100 處', hint: '去過的地方 100 處', face: { top: TOP, main: '100', sub: '處' }, rule: { kind: 'spots', need: 100 } },
  { id: 'spots-300', group: 'foot', name: '足跡 300 處', hint: '去過的地方 300 處', face: { top: TOP, main: '300', sub: '處' }, rule: { kind: 'spots', need: 300 } },

  // 文化指定（Wikidata）
  { id: 'heritage-1', group: 'heritage', name: '世界遺產', hint: '去過標示世界遺產的景點', face: { top: TOP, main: '世界', sub: '遺產' }, rule: { kind: 'tag', tag: '世界遺產', need: 1 } },
  { id: 'heritage-10', group: 'heritage', name: '世界遺產 10 處', hint: '去過 10 處標示世界遺產的景點', face: { top: TOP, main: '10', sub: '世界遺產' }, rule: { kind: 'tag', tag: '世界遺產', need: 10 } },
  { id: 'kokuho-1', group: 'heritage', name: '國寶', hint: '去過標示國寶的景點', face: { top: TOP, main: '國寶' }, rule: { kind: 'tag', tag: '國寶', need: 1 } },
  { id: 'shiseki-5', group: 'heritage', name: '特別史跡 5 處', hint: '去過 5 處標示特別史跡的景點', face: { top: TOP, main: '5', sub: '特別史跡' }, rule: { kind: 'tag', tag: '特別史跡', need: 5 } },
  { id: 'meisho-5', group: 'heritage', name: '特別名勝 5 處', hint: '去過 5 處標示特別名勝的景點', face: { top: TOP, main: '5', sub: '特別名勝' }, rule: { kind: 'tag', tag: '特別名勝', need: 5 } },

  // 名城（擴充包「城」）
  { id: 'castle100-10', group: 'castle', name: '日本100名城 10 城', hint: '去過日本100名城 10 城', face: { top: 'NIHON 100 MEIJO', main: '10', sub: '城' }, rule: { kind: 'castle', group: '100', need: 10 }, pack: 'castle' },
  { id: 'castle100-50', group: 'castle', name: '日本100名城 50 城', hint: '去過日本100名城 50 城', face: { top: 'NIHON 100 MEIJO', main: '50', sub: '城' }, rule: { kind: 'castle', group: '100', need: 50 }, pack: 'castle' },
  { id: 'castle100-100', group: 'castle', name: '日本100名城 100 城', hint: '日本100名城的 100 城都去過', face: { top: 'NIHON 100 MEIJO', main: '100', sub: '城' }, rule: { kind: 'castle', group: '100', need: 100 }, pack: 'castle' },
  { id: 'zoku-10', group: 'castle', name: '続日本100名城 10 城', hint: '去過続日本100名城 10 城', face: { top: 'ZOKU 100 MEIJO', main: '10', sub: '城' }, rule: { kind: 'castle', group: 'zoku', need: 10 }, pack: 'castle' },
  { id: 'zoku-50', group: 'castle', name: '続日本100名城 50 城', hint: '去過続日本100名城 50 城', face: { top: 'ZOKU 100 MEIJO', main: '50', sub: '城' }, rule: { kind: 'castle', group: 'zoku', need: 50 }, pack: 'castle' },

  // 擴充包（只看 id 前綴）
  { id: 'pokefuta-1', group: 'pack', name: '寶可夢人孔蓋', hint: '去過寶可夢人孔蓋', face: { top: 'POKEMON', main: '人孔蓋' }, rule: { kind: 'prefix', prefix: 'pokefuta-', need: 1 }, pack: 'pokemon' },
  { id: 'pokefuta-10', group: 'pack', name: '寶可夢人孔蓋 10 個', hint: '去過寶可夢人孔蓋 10 個', face: { top: 'POKEMON', main: '10', sub: '人孔蓋' }, rule: { kind: 'prefix', prefix: 'pokefuta-', need: 10 }, pack: 'pokemon' },
  { id: 'pokecen', group: 'pack', name: '寶可夢中心・寶可夢商店', hint: '去過寶可夢中心或寶可夢商店', face: { top: 'POKEMON', main: '寶可夢', sub: '中心・商店' }, rule: { kind: 'prefix', prefix: 'pokecen-', need: 1 }, pack: 'pokemon' },
  { id: 'shinise-10', group: 'pack', name: '老舖・茶屋 10 家', hint: '去過老舖・茶屋 10 家', face: { top: 'SHINISE', main: '10', sub: '老舖' }, rule: { kind: 'prefix', prefix: 'shinise-', need: 10 }, pack: 'shinise' },
  { id: 'chara-5', group: 'pack', name: '角色商店 5 家', hint: '去過角色商店 5 家', face: { top: 'CHARA SHOP', main: '5', sub: '角色商店' }, rule: { kind: 'prefix', prefix: 'chara-', need: 5 }, pack: 'chara' },
]

/** 條件要用到 achievements.json 的規則 */
export function ruleDep(rule: AchvRule): AchvDep {
  return rule.kind === 'tag' || rule.kind === 'castle' ? 'data' : 'core'
}

/** 這個成就要幾個單位（地方是縣數；其他沒有數字的規則是 1） */
export function ruleNeed(rule: AchvRule): number {
  switch (rule.kind) {
    case 'area':
      return areaPrefs(rule.area).length
    case 'seasons':
      return 4
    case 'months':
      return 12
    case 'tripShared':
    case 'revisit':
      return 1
    default:
      return rule.need
  }
}

/** 沒有進度可寫的成就（未達成時格子下方空白） */
export function hasProgress(def: AchvDef): boolean {
  return def.rule.kind !== 'tripShared' && def.rule.kind !== 'revisit'
}

export const ACHIEVEMENTS: AchvDef[] = SEEDS.map((s) => ({
  ...s,
  dep: ruleDep(s.rule),
  tickets: s.tickets ?? 0,
  rank: RANK[s.group],
}))

export const achvById = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))

/** 先 rank 大的，同組裡 need 大的在前 */
export function byRank(a: AchvDef, b: AchvDef): number {
  return b.rank - a.rank || ruleNeed(b.rule) - ruleNeed(a.rule)
}

/** 規則對話框（AchvRules.vue）的條列；抽獎券那段後面接 TicketTable */
export const ACHV_RULES: Array<{ title: string; items: string[] }> = [
  {
    title: '成就',
    items: [
      '由去過的地方、已結束的旅行與去過的日期算出來。',
      '取消去過、刪掉旅行，有關的成就跟著拿掉；標回去就回來。',
      '去過的地方包含擴充包的點（人孔蓋、老舖、角色商店）。',
      '旅行：結束日已過、至少排了一個景點。共編的旅行，每個成員都算。',
      '季節：3–5 月春、6–8 月夏、9–11 月秋、12–2 月冬。',
      '再訪、同一縣 3 次：兩個日期相隔 30 天以上才算另一次。',
      '世界遺產、國寶、特別史跡、特別名勝：景點資料上的文化指定（Wikidata）。一個景點有幾種指定，每種都算。',
      '日本100名城・続日本100名城：名城本身或所在的景點標了去過都算。',
      '關掉的擴充包，還沒達成的成就不列出。',
    ],
  },
  {
    title: '日期',
    items: ['依去過的日期推算達成那天。', '有關的地方沒有日期、算不出那天時，不寫日期。'],
  },
  {
    title: '抽獎券',
    items: ['地方、旅行、時節的成就，每個 5 張。'],
  },
  {
    title: '記號',
    items: ['NEW：新達成、還沒看過。', '虛線：還沒達成。'],
  },
]
