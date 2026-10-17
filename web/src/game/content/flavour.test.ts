import { describe, expect, it } from 'vitest'

import hokkaido from '../fixtures/hokkaido.json'
import hyogo from '../fixtures/hyogo.json'
import kyoto from '../fixtures/kyoto.json'
import nara from '../fixtures/nara.json'
import okinawa from '../fixtures/okinawa.json'
import osaka from '../fixtures/osaka.json'
import tokyo from '../fixtures/tokyo.json'

import { FLAVOUR, flavourFor, pickFlavour, QUEST_LINES, QUEST_MISC } from './flavour'
import { GAME_ITEMS, LOST_THINGS } from './items'

// 虛構台詞的 lint（規格 §0、§8.7）：遊戲自己寫的話裡不准有 fixture 的任何地名、店名、祭典名、站名、特色名；
// 不准有數字＋年／月／km（乾脆不准有阿拉伯數字）、驚嘆號、emoji；也要過 PLAN.md §6a 的禁用詞。

type Named = { n?: string; z?: string; name?: { ja?: string; zh_tw?: string; kana?: string } }
/** fixture 的形狀（只看名字） */
interface Fixture {
  spots: Named[]
  festivals: Named[]
  specialties: Named[]
  shinise: Named[]
  castles: Named[]
  stations: Named[]
  municipalities: Array<{ n: string; c?: string | null }>
  lines: Array<{ n: string }>
  kix?: { n: string; z?: string }
}
function namesOf(p: Fixture): string[] {
  const out: string[] = []
  const push = (...xs: Array<string | undefined>) => {
    for (const x of xs) if (x && x.trim()) out.push(x.trim())
  }
  const named = (list: readonly Named[]) => list.forEach((x) => push(x.n, x.z, x.name?.ja, x.name?.zh_tw, x.name?.kana))
  named(p.spots as Named[])
  named(p.festivals as Named[])
  named(p.specialties as Named[])
  named(p.shinise as Named[])
  named(p.castles as Named[])
  named(p.stations as Named[])
  for (const m of p.municipalities as Array<{ n: string; c?: string | null }>) push(m.n, m.c ?? undefined)
  for (const l of p.lines as Array<{ n: string }>) push(l.n)
  if (p.kix) push(p.kix.n, p.kix.z)
  return out
}
/**
 * 名字的詞幹：「・」、空白、括號分開的每一段，再拿掉字尾的区市町村、駅、祭、寺、神社、城、島…（剩 2 字以上的）。
 * 「祇園四条」「清水寺」「宮古島」「那覇市」→「祇園」「清水」「宮古」「那覇」也擋得到。
 */
const SUFFIX = /(区|市|町|村|駅|祭り|祭|まつり|寺|神社|大社|神宮|宮|城跡|城|島|公園|川|山|橋|岬|浜|ビーチ|空港|通り|通|線)$/
function stemsOf(name: string): string[] {
  const out: string[] = []
  for (const part of name.split(/[・\s（）()「」『』〔〕、,]+/)) {
    const p = part.trim()
    if (!p) continue
    const s = p.replace(SUFFIX, '')
    if (s !== p && s.length >= 2) out.push(s)
  }
  return out
}
/** 常見的通稱（fixture 裡沒有獨立的名字）、別的縣、大城市 */
const COMMON_NAMES = [
  ...['祇園', '清水', '嵯峨野', '嵯峨', '金閣', '銀閣', '嵐山', '鴨川', '先斗町', '宮古', '石垣', '那覇', '首里', '琉球', '伏見', '宇治', '奈良', '東京', '大阪', '神戸', '北海道', '富士山', '富士'],
  ...['九州', '本州', '四国', '関西', '関東', '京都', '京都府', '沖縄', '沖繩', '沖縄県', '関西国際空港'],
  // P3：東京、北海道的通稱（fixture 只有一部分的景點）
  ...['新宿', '渋谷', '澀谷', '銀座', '浅草', '淺草', '秋葉原', '池袋', '原宿', '上野', '六本木', '札幌', '函館', '小樽', '旭川', '釧路', '富良野', '美瑛', '知床', '大雪', '蝦夷', '道東', '道央'],
]
/**
 * 詞幹撞到一般的詞的（不是在講那個地方）：大家（景點「大家」）、本部（本部町）；
 * P3：天都（天都山，台詞是「每天都」）、東西（東西線，台詞是「東西」＝物品）、太陽（景點名的一段，台詞是天上的太陽）
 */
const ORDINARY = new Set(['大家', '本部', '天都', '東西', '太陽'])
const BASE_NAMES = [kyoto, okinawa, nara, osaka, hyogo, tokyo, hokkaido].flatMap((f) => namesOf(f as unknown as Fixture))
const NAMES = [...new Set([...BASE_NAMES, ...BASE_NAMES.flatMap(stemsOf), ...COMMON_NAMES])].filter((n) => !ORDINARY.has(n))

/** §6a 的禁用詞（pipeline/translate.py 的 BANNED＋PLAN.md §6a 的句型與口吻） */
const BANNED = /不僅.{0,20}更是|值得一提|絕對不能錯過|必訪|宛如|流連忘返|完美融合|無論你是|讓我們|您|推薦大家|\bAI\b|[!！]/
const EMOJI = /\p{Extended_Pictographic}/u
const DIGIT = /[0-9０-９]/
const NUM_UNIT = /[一二三四五六七八九十百千萬兩]\s*(年|月|km|ｋｍ|公里|キロ)/i

function lint(text: string): string[] {
  const t = text.replace(/\{\w+\}/g, '')
  const errs: string[] = []
  if (BANNED.test(t)) errs.push(`禁用詞：${t.match(BANNED)![0]}`)
  if (EMOJI.test(t)) errs.push('emoji')
  if (DIGIT.test(t)) errs.push('數字')
  if (NUM_UNIT.test(t)) errs.push(`數字＋單位：${t.match(NUM_UNIT)![0]}`)
  for (const n of NAMES) if (t.includes(n)) errs.push(`名字：${n}`)
  return errs
}

describe('虛構台詞', () => {
  it('至少 120 句，id 不重複', () => {
    expect(FLAVOUR.length).toBeGreaterThanOrEqual(120)
    expect(new Set(FLAVOUR.map((l) => l.id)).size).toBe(FLAVOUR.length)
    // 路人分得出地方
    expect(FLAVOUR.filter((l) => l.who === 'passer' && l.region === 'kinki').length).toBeGreaterThan(20)
    expect(FLAVOUR.filter((l) => l.who === 'passer' && l.region === 'okinawa').length).toBeGreaterThan(20)
    expect(FLAVOUR.filter((l) => l.who === 'passer' && l.region === 'kanto').length).toBeGreaterThan(20)
    expect(FLAVOUR.filter((l) => l.who === 'passer' && l.region === 'hokkaido').length).toBeGreaterThan(20)
  })

  it('fixture 的名字收得到（lint 本身沒有壞）', () => {
    expect(NAMES.length).toBeGreaterThan(500)
    expect(lint('去二条城看看。')).not.toEqual([])
    expect(lint('明天見！')).not.toEqual([])
    expect(lint('等了三年。')).not.toEqual([])
    expect(lint('走了 3 km')).not.toEqual([])
    // 名字的一部分、通稱也擋得到
    expect(lint('去祇園走走。')).not.toEqual([])
    expect(lint('清水的舞台好高。')).not.toEqual([])
    expect(lint('宮古的海很藍。')).not.toEqual([])
    expect(lint('那覇的路好塞。')).not.toEqual([])
    expect(lint('下次想去奈良。')).not.toEqual([])
  })

  it.each(FLAVOUR.map((l) => [l.id, l.text]))('%s 過 lint', (_id, text) => {
    expect(lint(text)).toEqual([])
  })

  it('委託的說法、掉的東西、遊戲自己的東西的名字也過 lint', () => {
    const texts = [
      ...Object.values(QUEST_LINES).flatMap((q) => Object.values(q)),
      ...Object.values(QUEST_MISC),
      ...LOST_THINGS.map((x) => x.zh),
      ...GAME_ITEMS.flatMap((x) => [x.name.ja, x.name.zh, x.kind]),
    ]
    for (const t of texts) expect(lint(t), t).toEqual([])
  })

  it('每種情況都挑得到一句，同一個人同一天先說同一句', () => {
    for (const region of ['kinki', 'okinawa', 'kanto', 'hokkaido'] as const)
      for (const season of ['spring', 'summer', 'autumn', 'winter'] as const)
        for (const time of ['day', 'dusk', 'night'] as const)
          for (const weather of ['clear', 'rain', 'snow'] as const) {
            const c = { who: 'passer' as const, region, season, time, weather }
            expect(flavourFor(c).length, `${region} ${season} ${time} ${weather}`).toBeGreaterThan(3)
            expect(pickFlavour(c, 'npc-1')?.id).toBe(pickFlavour(c, 'npc-1')?.id)
          }
    const c = { who: 'passer' as const, region: 'kinki' as const, season: 'winter' as const, time: 'day' as const, weather: 'snow' as const }
    // 有寫天氣、季節的優先
    expect(pickFlavour(c, 'x')?.when).toBeTruthy()
    expect(pickFlavour(c, 'x', 1)?.id).not.toBe(pickFlavour(c, 'x', 0)?.id)
    // 沖繩的路人不說近畿的話
    expect(flavourFor({ ...c, region: 'okinawa', weather: 'clear' }).some((l) => l.region === 'kinki')).toBe(false)
    for (const who of ['station', 'shinise', 'shokudo', 'inn', 'festival'] as const) expect(flavourFor({ ...c, who }).length, who).toBeGreaterThan(0)
    expect(flavourFor({ ...c, who: 'teahouse' }).length).toBeGreaterThan(3)
    expect(flavourFor({ ...c, who: 'teahouse', region: 'okinawa' }).length).toBeGreaterThan(3)
    for (const region of ['kanto', 'hokkaido'] as const) {
      expect(flavourFor({ ...c, who: 'teahouse', region }).length, region).toBeGreaterThan(3)
      // 關東、北海道的路人不說別的地方的話
      expect(flavourFor({ ...c, region, weather: 'clear' }).every((l) => l.region === 'any' || l.region === region), region).toBe(true)
    }
  })

  it('街上不講田、牛、拖拉機、矢羽根；郊外不講大樓、高架；北海道的茶屋夏天不講雪、天黑得早、暖爐', () => {
    const RURAL_WORDS = /田|牛|拖拉機|紅白的箭頭|村子|地平線|彩色/
    const URBAN_WORDS = /大樓|高架|紅綠燈|人行道/
    for (const region of ['kinki', 'okinawa', 'kanto', 'hokkaido'] as const)
      for (const setting of ['urban', 'rural'] as const)
        for (const season of ['spring', 'summer', 'autumn', 'winter'] as const)
          for (const time of ['day', 'dusk', 'night'] as const)
            for (const weather of ['clear', 'rain', 'snow'] as const) {
              const c = { who: 'passer' as const, region, season, time, weather, setting }
              const got = flavourFor(c)
              expect(got.length, `${region} ${setting} ${season} ${time} ${weather}`).toBeGreaterThan(3)
              for (const l of got) expect(!l.when?.setting || l.when.setting.includes(setting), l.id).toBe(true)
              if (region === 'kanto' || region === 'hokkaido') {
                const bad = setting === 'urban' ? RURAL_WORDS : URBAN_WORDS
                expect(
                  got.filter((l) => bad.test(l.text)).map((l) => l.text),
                  `${region} ${setting}`,
                ).toEqual([])
              }
            }
    // 關東、北海道講田、大樓的台詞都標了街上或郊外
    for (const l of FLAVOUR.filter((x) => x.region === 'kanto' || x.region === 'hokkaido')) {
      if (RURAL_WORDS.test(l.text) && l.who === 'passer') expect(l.when?.setting, l.text).toEqual(['rural'])
      if (URBAN_WORDS.test(l.text)) expect(l.when?.setting, l.text).toEqual(['urban'])
    }
    for (const season of ['spring', 'summer'] as const) {
      const tea = flavourFor({ who: 'teahouse', region: 'hokkaido', season, time: 'day', weather: 'clear', setting: 'urban' }).map((l) => l.text)
      expect(tea.length, season).toBeGreaterThan(3)
      expect(tea.filter((t) => /雪|一片白|天黑得早|暖爐/.test(t)), season).toEqual([])
    }
    const winterTea = flavourFor({ who: 'teahouse', region: 'hokkaido', season: 'winter', time: 'day', weather: 'clear' }).map((l) => l.text)
    expect(winterTea).toContain('窗外一片白，看著看著就發起呆。')
  })

  it('講開花的話只在那花開著的時候說（平年值）：五月的京都不說花瓣、八月不說紫陽花、四月的沖繩不說粉紅色的花', () => {
    const say = (region: 'kinki' | 'okinawa', season: 'spring' | 'summer' | 'autumn', bloom: string[]) =>
      flavourFor({ who: 'passer', region, season, time: 'day', weather: 'clear', bloom: new Set(bloom as never[]) }).map((l) => l.text)
    expect(say('kinki', 'spring', [])).not.toContain('風一吹，地上都是粉紅色的。')
    expect(say('kinki', 'spring', ['sakura'])).toContain('風一吹，地上都是粉紅色的。')
    expect(say('kinki', 'summer', [])).not.toContain('紫陽花開了，下雨天也不覺得悶。')
    expect(say('kinki', 'summer', ['ajisai'])).toContain('紫陽花開了，下雨天也不覺得悶。')
    expect(say('okinawa', 'spring', [])).not.toContain('粉紅色的花開在山邊。')
    expect(say('okinawa', 'spring', ['kanhi'])).toContain('粉紅色的花開在山邊。')
    // 寫了開花的台詞一定有 bloom 的條件
    for (const l of FLAVOUR) if (/花瓣|開了|粉紅色|紫陽花|櫻|楓/.test(l.text)) expect(l.when?.bloom, l.text).toBeTruthy()
  })

  it('「浴衣的腰帶綁歪了。」只在近畿的夏天說（沖繩五月的祭典已經算夏天，也不說）', () => {
    const YUKATA = '浴衣的腰帶綁歪了。'
    const say = (region: 'kinki' | 'okinawa', season: 'spring' | 'summer' | 'autumn' | 'winter') =>
      (['day', 'dusk', 'night'] as const).flatMap((time) => flavourFor({ who: 'festival', region, season, time, weather: 'clear' }).map((l) => l.text))
    expect(say('kinki', 'summer')).toContain(YUKATA)
    for (const season of ['spring', 'autumn', 'winter'] as const) expect(say('kinki', season), season).not.toContain(YUKATA)
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) expect(say('okinawa', season), season).not.toContain(YUKATA)
    expect(FLAVOUR.filter((l) => l.text.includes('浴衣')).every((l) => l.region === 'kinki' && l.when?.season?.join() === 'summer')).toBe(true)
  })

  it('同一鎮的路人第一句不會兩兩一樣（passer:k 跟 walker:k 的 key 只差幾個字）', () => {
    const c = { who: 'passer' as const, region: 'kinki' as const, season: 'autumn' as const, time: 'day' as const, weather: 'clear' as const }
    const first = (id: string) => pickFlavour(c, `${id}:2026-10-17`)!.text
    const same = [0, 1, 2, 3].filter((k) => first(`npc:261068:passer:${k}`) === first(`npc:261068:walker:${k}`))
    expect(same.length).toBeLessThan(3)
    const all = [...Array.from({ length: 7 }, (_, k) => `npc:261068:passer:${k}`), ...Array.from({ length: 4 }, (_, k) => `npc:261068:walker:${k}`)]
    expect(new Set(all.map(first)).size).toBeGreaterThanOrEqual(5)
  })
})
