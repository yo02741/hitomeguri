import { describe, expect, it } from 'vitest'

import css from '../../styles/theme.css?raw'
import { PX, type Tokens } from '../../services/pixelwalk/palette'
import { factFromRef, FACT_IDS, renderFact } from '../content/facts'
import { ICON_IDS, iconSprite, pixelRomaji, silhouetteOf, stampLines, stampSprite } from '../content/icons'
import { GAME_ITEMS, PRICE, SIT_PRICE } from '../content/items'
import { Game, type GameOptions } from '../engine/game'
import { memoryStore, parseSave } from '../engine/save'
import kyotoJson from '../fixtures/kyoto.json'
import okinawaJson from '../fixtures/okinawa.json'
import { registerDefaultLooks } from '../sprites'
import { notebookData } from '../ui/notebook'

import { bloomOf, DataIndex, dayKey, kmText } from './data'
import { DEV_START, DEV_TOWN, DEV_TOWN_2, devMaps, devWorld } from './dev/testWorld'
import { installSystems } from './install'
import { itemCard, itemKey, priceOf, shiniseWhat } from './inventory'
import { clampFrame, crop, frameSize, type Rect, scoreShot, type ShotInput, slotOf, SNOWY_KITS, zoomFrame } from './photo'
import { memoryPhotos } from './photoStore'
import { questFor, REWARD, rewardOf } from './quests'
import { moveSlot, placeFromBag, slotIndex, takeBack } from './room'
import { rotate, shokudoPool, stationPool, stockOf } from './shop'
import { emptySystems, parseSystems, roomOf, systemsOf } from './state'
import { stampBook, stampView } from './stamps'
import { acceptsCard, CARD_FLAG, cardTotal, ensureYen, NEW_GAME_YEN, YEN_FLAG } from './wallet'
import { firstSentence, summaryLine } from './summary'
import type { PrefLike } from './types'

// 番外篇的系統（規格 §8.4–§8.7、§9、§11）：照片分數、存檔來回、商品輪換與委託的決定性、事實樣板拒絕沒出處、
// 品項卡的簡介選語言、印帳、房間擺設，以及地圖上的實體（告示牌、事實 NPC、店、印、旅館）走一遍。

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
const kyoto = kyotoJson as unknown as PrefLike
const okinawa = okinawaJson as unknown as PrefLike
const PREFS = [kyoto, okinawa]
const data = new DataIndex(PREFS, devWorld(PREFS))
registerDefaultLooks()

const run = (g: Game, n: number) => {
  for (let i = 0; i < n; i++) g.update(1 / 60)
}

function makeGame(o: Partial<GameOptions> = {}) {
  const store = memoryStore()
  const maps = devMaps()
  const game = new Game({ tokens, maps, start: DEV_START, storage: store, seed: 3, now: new Date('2026-04-02T01:00:00Z'), ...o })
  const sys = installSystems(game, { prefs: PREFS, world: devWorld(PREFS), maps, photos: memoryPhotos() })
  // 對話：say 直接往下、ask 選第一個（測試裡沒有介面）
  const said: string[] = []
  game.on('say', (e) => {
    said.push(e.text)
    e.resolve()
  })
  let answer = 0
  game.on('ask', (e) => {
    said.push(e.text)
    e.resolve(answer)
  })
  game.newGame()
  run(game, 20)
  return { game, sys, store, said, answer: (i: number) => (answer = i), maps }
}

/** 站到某一格、面向某個方向按 A */
function interact(g: Game, x: number, y: number, dir: 'up' | 'down' | 'left' | 'right') {
  g.player.place(x, y, dir)
  g.follower?.reset(x, y, dir)
  g.input.tap('A', 'test')
  run(g, 4)
}

// ---------- 照片 ----------
describe('照片的構圖分數', () => {
  const W = 240
  const H = 160
  const base: ShotInput = {
    frame: { x: 0, y: 0, w: W, h: H },
    target: null,
    people: [],
    selves: [],
    time: 'day',
    season: 'summer',
    weather: 'clear',
    festival: false,
    bloom: null,
    snowy: true,
  }
  // 佔畫面約 29%、中心在左上的三分線交點
  const good: Rect = { x: 80 - 64, y: 53 - 44, w: 128, h: 88 }

  it('地標整個在框裡、大小剛好、靠三分線：分數高', () => {
    const s = scoreShot({ ...base, target: good })
    expect(s.parts.map((p) => p.label)).toEqual(['拍照', '構圖', '大小', '三分線'])
    expect(s.score).toBe(75)
    expect(s.slot).toBe('normal')
  })

  it('切到一半、太小、太大都比較低', () => {
    const full = scoreShot({ ...base, target: good }).score
    expect(scoreShot({ ...base, target: { ...good, x: -52 } }).score).toBeLessThan(full)
    expect(scoreShot({ ...base, target: { x: 110, y: 70, w: 16, h: 16 } }).score).toBeLessThan(full)
    expect(scoreShot({ ...base, target: { x: 0, y: 0, w: W, h: H } }).score).toBeLessThan(full)
  })

  it('路人擋到扣分，自己或夥伴入鏡是合照', () => {
    const full = scoreShot({ ...base, target: good }).score
    const npc = { x: good.x + 10, y: good.y + 10, w: 16, h: 24 }
    expect(scoreShot({ ...base, target: good, people: [npc] }).score).toBe(full - 8)
    expect(scoreShot({ ...base, target: good, people: [npc, npc, npc, npc] }).score).toBe(full - 24)
    const me = scoreShot({ ...base, target: good, selves: [{ x: 200, y: 120, w: 16, h: 24 }] })
    expect(me.together).toBe(true)
    expect(me.score).toBe(full + 10)
    // 框外的不算
    expect(scoreShot({ ...base, target: good, selves: [{ x: 300, y: 120, w: 16, h: 24 }] }).together).toBe(false)
  })

  it('黃昏、夜、櫻、楓、雪、祭典加分；相簿的格照優先順序', () => {
    const plain = scoreShot({ ...base, target: good }).score
    expect(scoreShot({ ...base, target: good, time: 'dusk' }).score).toBe(plain + 8)
    expect(scoreShot({ ...base, target: good, time: 'night' }).score).toBe(plain + 10)
    expect(scoreShot({ ...base, target: good, bloom: 'sakura' }).slot).toBe('sakura')
    expect(scoreShot({ ...base, target: good, bloom: 'momiji' }).slot).toBe('momiji')
    expect(slotOf({ ...base, season: 'winter' })).toBe('snow')
    expect(slotOf({ ...base, season: 'winter', snowy: false })).toBe('normal')
    // 會積雪的 kit：近畿、北海道；關東（東京）冬天只有下雪天才算雪景、沖繩沒有雪
    expect([...SNOWY_KITS].sort()).toEqual(['hokkaido', 'kinki'])
    expect(slotOf({ ...base, season: 'winter', snowy: SNOWY_KITS.has('kanto') })).toBe('normal')
    expect(slotOf({ ...base, season: 'winter', weather: 'snow', snowy: SNOWY_KITS.has('kanto') })).toBe('snow')
    expect(slotOf({ ...base, weather: 'snow', time: 'night' })).toBe('night')
    expect(slotOf({ ...base, festival: true, time: 'night' })).toBe('festival')
    expect(scoreShot({ ...base, target: good, festival: true, time: 'night', bloom: 'sakura', selves: [good] }).score).toBeLessThanOrEqual(100)
    // 隨便拍也有分數
    expect(scoreShot(base).score).toBe(10)
  })

  it('取景框：全畫面、放大一半；移動不出界、裁切照框', () => {
    expect(frameSize(W, H, 1)).toEqual({ w: 240, h: 160 })
    expect(frameSize(W, H, 2)).toEqual({ w: 160, h: 107 })
    const z = zoomFrame({ x: 0, y: 0, w: W, h: H }, W, H, 2)
    expect(z).toEqual({ x: 40, y: 27, w: 160, h: 107 })
    expect(clampFrame({ ...z, x: -50, y: 999 }, W, H)).toEqual({ x: 0, y: 53, w: 160, h: 107 })
    const src = { w: 4, h: 3, buf: new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) }
    expect([...crop(src, { x: 1, y: 1, w: 2, h: 2 })]).toEqual([6, 7, 10, 11])
  })

  it('花季照氣象廳的平年值：京都 3/26 開花、4/4 滿開 → 3/26–4/11 是櫻', () => {
    const n = kyoto.seasons!.stations[0]!.normals
    expect(bloomOf({ y: 2026, m: 3, d: 25 }, n)).toBe(null)
    expect(bloomOf({ y: 2026, m: 3, d: 26 }, n)).toBe('sakura')
    expect(bloomOf({ y: 2026, m: 4, d: 11 }, n)).toBe('sakura')
    expect(bloomOf({ y: 2026, m: 4, d: 12 }, n)).toBe(null)
    expect(bloomOf({ y: 2026, m: 12, d: 1 }, n)).toBe('momiji')
    // 那覇：寒緋櫻
    expect(bloomOf({ y: 2026, m: 1, d: 20 }, okinawa.seasons!.stations[0]!.normals)).toBe('sakura')
  })
})

// ---------- 事實樣板 ----------
describe('事實樣板', () => {
  it('沒有出處、出處不是網址、缺參數：不說', () => {
    expect(renderFact('festival.month', { name: '祭', months: '7' }, null)).toBe(null)
    expect(renderFact('festival.month', { name: '祭', months: '7' }, { label: 'x', url: '' })).toBe(null)
    expect(renderFact('festival.month', { name: '祭' }, { label: 'x', url: 'https://example.org' })).toBe(null)
    expect(renderFact('no.such', {}, { label: 'x', url: 'https://example.org' })).toBe(null)
    expect(renderFact('festival.month', { name: '祭', months: '7' }, { label: 'x', url: 'https://example.org' })?.text).toBe('祭，每年 7 月。')
  })

  it('資料參照：祭典的月份附月份的出處（Wikidata 或維基百科），沒有月份來源的不說', () => {
    const gion = factFromRef('festival.month', { kind: 'festival', id: 'kyoto-Q979873' }, {}, data)
    expect(gion?.text).toBe('祇園祭，每年 7 月。')
    expect(gion?.source.url).toBe('https://www.wikidata.org/wiki/Q979873')
    const ayabe = factFromRef('festival.month', { kind: 'festival', id: 'kyoto-Q11258475' }, {}, data)
    expect(ayabe?.source.url).toMatch(/ja\.wikipedia\.org/)
    // 丹波の芝むくり：沒有月份
    expect(factFromRef('festival.month', { kind: 'festival', id: 'kyoto-Q100550632' }, {}, data)).toBe(null)
  })

  it('老舖的創業、名城的蓋章地點、平年的花期、郷土料理', () => {
    expect(factFromRef('shinise.founded', { kind: 'shinise', id: 'shinise-q11352421' }, {}, data)?.text).toBe('這家一保堂，創業 1717年。')
    // 沒有創業年的茶屋：不說
    expect(factFromRef('shinise.founded', { kind: 'shinise', id: 'shinise-node-4775546783' }, {}, data)).toBe(null)
    const nijo = factFromRef('castle.stamp', { kind: 'castle', id: 'castle-053' }, {}, data)
    expect(nijo?.text).toBe('日本100名城的章，放在大休憩所。')
    expect(nijo?.source.url).toMatch(/wikipedia/)
    expect(factFromRef('castle.stamp', { kind: 'castle', id: 'castle-199' }, {}, data)?.text).toBe('続日本100名城的章，放在世界遺産座喜味城跡ユンタンザミュージアム。')
    const sakura = factFromRef('sakura.normal', { kind: 'town', id: DEV_TOWN }, {}, data)
    expect(sakura?.text).toBe('京都的櫻花，平年 4 月 4 日 滿開。')
    expect(sakura?.source.url).toMatch(/jma\.go\.jp/)
    expect(factFromRef('sakura.normal', { kind: 'season', id: '宮古島' }, {}, data)?.text).toBe('宮古島的櫻花，平年 2 月 9 日 滿開。')
    // 名護市用的是那覇的平年值：寫那覇，不說「這一帶」
    expect(factFromRef('sakura.normal', { kind: 'season', id: '那覇' }, {}, data)?.text).toBe('那覇的櫻花，平年 2 月 4 日 滿開。')
    // 沖繩沒有楓的平年值
    expect(factFromRef('kaede.normal', { kind: 'season', id: '那覇' }, {}, data)).toBe(null)
    expect(factFromRef('kyodo.dish', { kind: 'specialty', id: 'kyoto-Q108799327' }, {}, data)?.text).toBe('肉豆腐是京都府的郷土料理。')
    // world 算的數字：world 給出處才說
    expect(factFromRef('straight.km', { kind: 'town', id: '1' }, { to: '那覇市', km: 1067 }, data)).toBe(null)
    expect(factFromRef('straight.km', { kind: 'town', id: '1' }, { to: '那覇市', km: 1067 }, data, undefined, { label: 'OSM', url: 'https://www.openstreetmap.org/copyright' })?.text).toBe(
      '到那覇市的直線距離約 1067 km。',
    )
  })

  it('每個樣板都沒有驚嘆號', () => {
    for (const id of FACT_IDS) expect(id).not.toMatch(/[!！]/)
  })
})

// ---------- 品項卡 ----------
describe('品項卡', () => {
  it('簡介第一句：有中文用中文，沒有就原文並標語言；有翻譯用翻譯', () => {
    const uji = itemCard('specialty:kyoto-Q11449516', data)!
    expect(uji.name).toMatchObject({ ja: '宇治茶', kana: 'うじちゃ' })
    expect(uji.kind).toBe('飲料')
    // 名字有「茶」的用茶筒（類別是飲料也一樣）
    expect(uji.icon).toBe('tea-can')
    expect(uji.summary?.lang).toBe('zh')
    expect(uji.summary?.text).toBe('宇治茶， 是日本的綠茶。')
    expect(uji.license).toBe('CC BY-SA 4.0')
    const niku = itemCard('specialty:kyoto-Q108799327', data)!
    expect(niku.summary?.lang).toBe('en')
    expect(niku.summary?.text).toMatch(/^“Niku Tofu” is a simple dish/)
    expect(niku.keep).toBe(false)
    expect(niku.license).toMatch(/農林水產省/)
    expect(summaryLine({ text: 'An English text. More.', lang: 'en', source_url: 'https://x.org', text_zh: '中文翻譯。後面。' })).toMatchObject({ text: '中文翻譯。', lang: 'zh', translated: true })
    expect(summaryLine({ text: '沒有出處。', lang: 'zh', source_url: '' })).toBe(null)
  })

  it('第一句：括號裡的句點不切、英文縮寫不切、切不到就加…', () => {
    expect(firstSentence('甲（乙。丙）丁。戊。', 'ja')).toBe('甲（乙。丙）丁。')
    expect(firstSentence('Mt. Fuji is tall. It is.', 'en')).toBe('Mt. Fuji is tall.')
    expect(firstSentence('沒有句號的一段', 'zh')).toBe('沒有句號的一段…')
  })

  it('老舖的東西只寫「這家店的和菓子／茶」，創業年附出處；遊戲自己的東西不寫事實', () => {
    const tea = itemCard('shinise:shinise-q11352421#tea', data)!
    expect(tea.name.ja).toBe('一保堂のお茶')
    expect(tea.kind).toBe('茶')
    expect(tea.summary).toBeUndefined()
    expect(tea.shop).toMatchObject({ name: '一保堂', founded: '1717年' })
    expect(tea.shop?.source?.url).toMatch(/wikipedia/)
    const tsujiri = itemCard('shinise:shinise-node-4775546783#tea', data)!
    expect(tsujiri.shop?.founded).toBeUndefined()
    expect(tsujiri.license).toBe('ODbL')
    const card = itemCard('game:postcard@p1', data)!
    expect(card).toMatchObject({ kind: '明信片', photo: 'p1', keep: true })
    expect(card.summary).toBeUndefined()
    expect(card.source).toBeUndefined()
    expect(itemCard('nope', data)).toBe(null)
  })

  it('像素小圖、印的圖案都畫得出來', () => {
    for (const id of ICON_IDS) expect(iconSprite(id).idx.some((v) => v > 0), id).toBe(true)
    for (const shape of ['station', 'sanpai', 'castle'] as const) {
      const s = stampSprite({ shape, silhouette: 'torii', romaji: 'KYOTO', no: 53 })
      expect(s.idx.some((v) => v > 0), shape).toBe(true)
      for (const k of s.keys) expect(PX).toContain(k)
    }
    expect(pixelRomaji('Nijōjō-mae')).toBe('NIJOJO-MAE')
    // 站章的羅馬字：12 字以內一行；長的在空白、「-」斷兩行，不會切掉字（KINTETSU NAR）
    expect(stampLines('KYOTO')).toEqual(['KYOTO'])
    expect(stampLines('KINTETSU NARA')).toEqual(['KINTETSU NARA'])
    expect(stampLines('MATSUO-TAISHA')).toEqual(['MATSUO-', 'TAISHA'])
    expect(stampLines('OSAKA BUSINESS PARK')).toEqual(['OSAKA', 'BUSINESS PARK'])
    expect(stampLines('TOROKKO ARASHIYAMA')).toEqual(['TOROKKO', 'ARASHIYAMA'])
    expect(stampLines('KINOSAKI-ONSEN')).toEqual(['KINOSAKI-', 'ONSEN'])
    expect(stampLines('BAMPAKUKINENKOEN')).toEqual(['BAMPAKUKINEN', 'KOEN'])
    expect(stampLines('KASHIHARAJINGU-NISHIGUCHI')).toEqual(['KASHIHARAJIN', 'GU-NISHIGUCH'])
    const two = stampSprite({ shape: 'station', silhouette: 'train', romaji: 'TOROKKO ARASHIYAMA' })
    const row = (y: number) => Array.from({ length: two.w }, (_, x) => two.idx[y * two.w + x]).some((v) => v > 0)
    expect(row(36)).toBe(true)
    expect(silhouetteOf('城', '', true)).toBe('gusuku')
    expect(silhouetteOf(undefined, '八坂神社')).toBe('torii')
    expect(silhouetteOf(undefined, '斎場御嶽', true)).toBe('utaki')
  })
})

// ---------- 店 ----------
describe('店', () => {
  const date = { y: 2026, m: 10, d: 16 }
  it('車站賣店：每天 6–8 樣（帶得走的特色＋遊戲的東西），明信片每天都有；同一天同一家一樣', () => {
    const shop = { id: 'kiosk', shopKind: 'station' as const }
    const a = stockOf(shop, 'kyoto', date, data)
    const b = stockOf(shop, 'kyoto', date, data)
    expect(a.entries.map((e) => e.key)).toEqual(b.entries.map((e) => e.key))
    expect(a.entries.length).toBeGreaterThanOrEqual(6)
    expect(a.entries.length).toBeLessThanOrEqual(8)
    expect(a.entries.some((e) => e.key === 'game:postcard')).toBe(true)
    for (const e of a.entries) expect(e.card.keep, e.key).toBe(true)
    // 一個月裡每天的組合不會都一樣
    const days = new Set(Array.from({ length: 30 }, (_, i) => stockOf(shop, 'kyoto', { y: 2026, m: 11, d: i + 1 }, data).entries.map((e) => e.key).join()))
    expect(days.size).toBeGreaterThan(1)
    // 郷土料理不在賣店
    expect(stationPool('kyoto', data).some((k) => k === 'specialty:kyoto-Q108799327')).toBe(false)
  })

  it('沖繩的賣店：只有遊戲的東西＋茶屋的茶，不編名產', () => {
    const pool = stationPool('okinawa', data)
    expect(pool.some((k) => k.startsWith('specialty:'))).toBe(false)
    expect(pool).toContain('game:okimono-shisa')
    expect(pool).not.toContain('game:okimono-tori')
    expect(pool.some((k) => k.startsWith('shinise:') && k.endsWith('#tea'))).toBe(true)
  })

  it('食堂賣郷土料理（帶不走）、老舖只有那一樣、茶屋可以坐', () => {
    const food = stockOf({ id: 'shokudo', shopKind: 'shokudo' }, 'kyoto', date, data)
    expect(food.entries.length).toBeGreaterThanOrEqual(6)
    for (const e of food.entries) expect(e.card.kind).toBe('郷土料理')
    expect(stockOf({ id: 'ippodo', shopKind: 'shinise', shiniseId: 'shinise-q11352421' }, 'kyoto', date, data).entries.map((e) => e.key)).toEqual(['shinise:shinise-q11352421#tea'])
    const tea = stockOf({ id: 'tsujiri', shopKind: 'teahouse', shiniseId: 'shinise-node-4775546783' }, 'kyoto', date, data)
    expect(tea.sit).toBeGreaterThan(0)
  })

  it('目的地的距離：鐵路約／直線約，10 km 以上取整數', () => {
    expect(kmText(3.14, 'rail')).toBe('鐵路約 3.1 km')
    expect(kmText(1067.4, 'straight')).toBe('直線約 1067 km')
    expect(kmText(0.01, 'rail')).toBe('鐵路約 0.1 km')
  })

  it('rotate：少於 6 樣就全部、順序照池子', () => {
    expect(rotate(['a', 'b', 'c'], 5)).toEqual(['a', 'b', 'c'])
    const r = rotate(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], 7, ['j'])
    expect(r).toContain('j')
    expect(r.length).toBe(6 + (7 % 3))
  })
})

// ---------- 委託 ----------
describe('委託', () => {
  const env = { data }
  it('同一個人同一天的委託一樣；換一天會換', () => {
    const d = { y: 2026, m: 10, d: 16 }
    const a = questFor('quest-1', DEV_TOWN, d, env)
    expect(a).toEqual(questFor('quest-1', DEV_TOWN, d, env))
    const week = Array.from({ length: 14 }, (_, i) => questFor('quest-1', DEV_TOWN, { y: 2026, m: 10, d: i + 1 }, env))
    expect(new Set(week.map((q) => `${q?.type}:${q?.spot}:${q?.item}:${q?.to}`)).size).toBeGreaterThan(1)
    for (const q of week) {
      expect(q).not.toBe(null)
      if (q!.type === 'deliver') {
        expect(q!.to).toBe(DEV_TOWN_2)
        expect(q!.item).toMatch(/^(specialty|shinise):/)
      } else expect(data.spot(q!.spot)).toBeTruthy()
      expect(q!.reward).toBeGreaterThan(0)
    }
  })
})

// ---------- 走一遍：地圖上的東西 ----------
describe('地圖上的東西', () => {
  it('告示牌：地名、念法、簡介第一句（附出處），記進「聽來的」', () => {
    const { game, said, sys } = makeGame()
    game.warpNow(`town:${DEV_TOWN}`, 13, 20, 'up')
    run(game, 2)
    interact(game, 13, 20, 'up')
    expect(said[0]).toBe('元離宮二条城\n二條城')
    expect(said[1]).toBe('元離宮二條城是位於日本京都府京都市中京區二條城町的城堡。')
    expect(sys.save.heard.map((h) => h.id)).toContain('spot:wd-Q1013399')
    const heard = notebookData(game, null).heard.facts
    expect(heard[0]?.text).toBe(said[1])
    expect(heard[0]?.source.url).toMatch(/wikipedia/)
  })

  it('事實 NPC：祭典的月份附出處；虛構台詞的路人每次換一句', () => {
    const { game, said } = makeGame()
    game.warpNow(`town:${DEV_TOWN}`, 5, 11, 'up')
    run(game, 2)
    interact(game, 5, 11, 'up')
    expect(said.at(-1)).toBe('祇園祭，每年 7 月。')
    interact(game, 10, 10, 'up')
    const first = said.at(-1)
    run(game, 30)
    interact(game, 10, 10, 'up')
    expect(said.at(-1)).not.toBe(first)
  })

  it('車站賣店：買東西扣現金、進行李、自動存檔；品項卡在行李頁', () => {
    const { game, sys, store } = makeGame()
    interact(game, 8, 3, 'up')
    const p = sys.ui.panel
    expect(p?.kind).toBe('shop')
    expect(game.paused).toBe(true)
    if (p?.kind !== 'shop') return
    expect(p.stock.card).toBe(true)
    const card = p.stock.entries.find((e) => e.key === 'game:postcard')!
    expect(card.price).toBe(150)
    const money = game.state.money
    expect(sys.buy(card, null, 'cash', p.stock.card)).toBe('ok')
    expect(game.state.money).toBe(money - card.price)
    expect(game.state.items['game:postcard']).toBe(1)
    expect(parseSave(Object.values(store.data)[0])?.items['game:postcard']).toBe(1)
    sys.closePanel()
    expect(game.paused).toBe(false)
    const bag = notebookData(game, null).bag as ReturnType<typeof notebookData>['bag'] & { wallet?: { cash: number; card: number } }
    expect(bag.items.find((i) => i.id === 'game:postcard')?.card?.kind).toBe('明信片')
    expect(bag.wallet).toEqual({ cash: game.state.money, card: 0 })
    // 現金不夠：現金買不了，刷卡照樣能買（沒有上限，記累計）
    game.state.money = 0
    expect(sys.buy(card, null, 'cash', true)).toBe('money')
    expect(sys.buy(card, null, 'card', true)).toBe('ok')
    expect(game.state.money).toBe(0)
    expect(cardTotal(game)).toBe(150)
    expect(game.state.items['game:postcard']).toBe(2)
    expect((notebookData(game, null).bag as { wallet?: { card: number } }).wallet?.card).toBe(150)
    // 刷卡累計跟著存檔走（flags）
    expect(parseSave(Object.values(store.data)[0])?.flags[CARD_FLAG]).toBe(150)
  })

  it('付款：車站、機場的賣店可以刷卡；老舖、茶屋、食堂只收現金（不能刷卡、現金不夠就買不了）', () => {
    expect(acceptsCard('station')).toBe(true)
    for (const k of ['shinise', 'teahouse', 'shokudo'] as const) expect(acceptsCard(k)).toBe(false)
    const { game, sys } = makeGame()
    // 老舖
    const sh = data.pref('kyoto')!.shinise!.find((x) => shiniseWhat(x) === 'wagashi')!
    const stock = stockOf({ id: 'shop:test', shopKind: 'shinise', shiniseId: sh.id }, 'kyoto', { y: 2026, m: 4, d: 2 }, data)
    expect(stock.card).toBe(false)
    const e = stock.entries[0]!
    const money = game.state.money
    expect(sys.buy(e, null, 'card', stock.card)).toBe('card')
    expect(game.state.money).toBe(money)
    expect(cardTotal(game)).toBe(0)
    game.state.money = e.price - 1
    expect(sys.buy(e, null, 'cash', stock.card)).toBe('money')
    game.state.money = e.price
    expect(sys.buy(e, null, 'cash', stock.card)).toBe('ok')
    expect(game.state.money).toBe(0)
    // 茶屋：坐下來 600 円；食堂只收現金
    expect(SIT_PRICE).toBe(600)
    const tea = stockOf({ id: 'shop:tea', shopKind: 'teahouse' }, 'kyoto', { y: 2026, m: 4, d: 2 }, data)
    expect(tea.card).toBe(false)
    const meal = stockOf({ id: 'shop:meal', shopKind: 'shokudo' }, 'kyoto', { y: 2026, m: 4, d: 2 }, data)
    expect(meal.card).toBe(false)
    expect(sys.eat(meal.entries[0]!)).toBe('money')
  })

  it('價錢（円，遊戲的規則）：明信片 150、鑰匙圈 500–800、和菓子 800–2,000、郷土料理 900–2,500；同一樣東西每次一樣', () => {
    const range = (key: string) => {
      const r = PRICE[key]!
      return [r.min, r.max]
    }
    expect(range('wagashi')).toEqual([800, 2000])
    expect(range('kyodo')).toEqual([900, 2500])
    const g = (id: string) => GAME_ITEMS.find((x) => x.id === id)!.price
    expect([g('postcard').min, g('postcard').max]).toEqual([150, 150])
    expect([g('keyholder').min, g('keyholder').max]).toEqual([500, 800])
    for (const pref of [kyoto, okinawa]) {
      for (const s of pref.specialties ?? []) {
        const c = itemCard(itemKey({ kind: 'specialty', id: s.id }), data)!
        const r = PRICE[s.category]
        if (!r) continue
        expect(c.price!, s.id).toBeGreaterThanOrEqual(r.min)
        expect(c.price!, s.id).toBeLessThanOrEqual(r.max)
        expect((c.price! - r.min) % r.step, s.id).toBe(0)
      }
    }
    // 決定性：照 key
    expect(priceOf(PRICE.sweets!, 'specialty:x')).toBe(priceOf(PRICE.sweets!, 'specialty:x'))
    const spread = new Set((kyoto.specialties ?? []).filter((s) => s.category === 'kyodo').map((s) => itemCard(`specialty:${s.id}`, data)!.price))
    expect(spread.size).toBeGreaterThan(1)
  })

  it('新遊戲現金 50,000 円：照正常路線（賣店、老舖各買一樣、茶屋坐下來）走到食堂，最貴的情況也吃得起', () => {
    const { game } = makeGame()
    expect(NEW_GAME_YEN).toBe(50000)
    expect(game.state.money).toBe(NEW_GAME_YEN)
    expect(game.state.flags[YEN_FLAG]).toBe(1)
    const price = (key: string) => itemCard(key, data)?.price ?? 0
    for (const pref of ['kyoto', 'okinawa']) {
      const kiosk = Math.max(...stationPool(pref, data).map(price))
      const shinise = (data.pref(pref)?.shinise ?? []).flatMap((s) => {
        const what = shiniseWhat(s)
        return what ? [price(itemKey({ kind: 'shinise', id: `${s.id}#${what}` }))] : []
      })
      // 食堂一天擺 6–8 樣：當天最便宜的那一樣不會比整個池子最貴的還貴
      const meal = Math.max(...shokudoPool(pref, data).map(price))
      expect(shinise.length, pref).toBeGreaterThan(0)
      expect(kiosk + Math.max(...shinise) + SIT_PRICE + meal, pref).toBeLessThanOrEqual(NEW_GAME_YEN)
    }
    // 重新開始也是 50,000 円（旗標清掉、引擎的 5000 換成円）
    game.state.money = 120
    game.newGame()
    run(game, 2)
    expect(game.state.money).toBe(NEW_GAME_YEN)
  })

  it('舊存檔（文）：現金 ×10、至少 50,000 円；進行中的委託換成円的報酬；只換一次', () => {
    const store = memoryStore()
    const { game } = makeGame({ storage: store })
    const save = { ...game.serialize(), money: 12_345, flags: {}, ext: { systems: { v: 1, quests: { active: [{ id: 'q1', type: 'photo', from: DEV_TOWN, giver: 'g', spot: 'x', when: 'night', reward: 800, d: '2026-04-02' }], done: [] } } } }
    game.restore(parseSave(JSON.stringify(save))!)
    run(game, 2)
    expect(game.state.money).toBe(123_450)
    expect(systemsOf(game).quests.active[0]?.reward).toBe(rewardOf({ type: 'photo', when: 'night' }))
    expect(rewardOf({ type: 'photo', when: 'night' })).toBe(REWARD.photo + 1000)
    // 再讀一次（記號在 flags）：不會再 ×10
    game.warpNow(DEV_START.map, DEV_START.x, DEV_START.y)
    expect(game.state.money).toBe(123_450)
    const again = parseSave(JSON.stringify(game.serialize()))!
    game.restore(again)
    expect(game.state.money).toBe(123_450)
    // 少的：3000 文 → 30,000 円 → 至少 50,000 円
    game.restore(parseSave(JSON.stringify({ ...save, money: 3000 }))!)
    expect(game.state.money).toBe(NEW_GAME_YEN)
    expect(ensureYen(game)).toBe(null)
  })

  it('食堂吃郷土料理進「吃過的」；茶屋坐下來時間往前', () => {
    const { game, sys } = makeGame()
    interact(game, 7, 4, 'down')
    const p = sys.ui.panel
    expect(p?.kind === 'shop' && p.mode).toBe('eat')
    if (p?.kind !== 'shop') return
    const t0 = game.clock.minutes
    expect(sys.eat(p.stock.entries[0]!)).toBe('ok')
    expect(game.clock.minutes).toBeGreaterThan(t0)
    sys.closePanel()
    expect(notebookData(game, null).bag.eaten.length).toBe(1)
    interact(game, 1, 3, 'up')
    expect(sys.ui.panel?.kind).toBe('shop')
    const t1 = game.clock.minutes
    sys.closePanel('sit')
    run(game, 80)
    expect(game.clock.minutes).toBeGreaterThanOrEqual(t1 + 30)
  })

  it('印：名城的章（印面「日本100名城 No.53」、蓋章地點），只蓋一次，進印帳，存檔', () => {
    const { game, sys, said } = makeGame()
    game.warpNow(`town:${DEV_TOWN}`, 20, 21, 'up')
    run(game, 2)
    interact(game, 20, 21, 'up')
    expect(said).toContain('日本100名城的章，放在大休憩所。')
    expect(sys.ui.panel?.kind).toBe('stamp')
    sys.closePanel()
    run(game, 2)
    expect(game.state.stamps).toEqual(['castle-053'])
    interact(game, 20, 21, 'up')
    expect(said.at(-1)).toMatch(/已經蓋過了/)
    expect(game.state.stamps).toEqual(['castle-053'])
    const book = notebookData(game, null).stamps.books
    expect(book[0]?.title.ja).toBe('京都府')
    expect(book[0]?.stamps[0]).toMatchObject({ kind: 'castle', face: '日本100名城 No.53', where: '大休憩所' })
    expect(book[0]?.stamps[0]?.date).toEqual(game.clock.date)
    // 站章：站名的羅馬字（rail bundle 的英文名）
    const v = stampView({ stampId: 's', stampKind: 'station', pref: 'kyoto', name: '京都', stationId: 'node-267316272', spotId: 'wd-Q1013399' }, data)
    expect(v.art).toMatchObject({ shape: 'station', silhouette: 'castle' })
    expect(v.face).toBe(v.art.romaji)
    expect(stampBook(game, data, ['kyoto', 'okinawa']).map((b) => b.title.ja)).toEqual(['京都府', '沖縄県'])
  })

  it('旅館：拿到鑰匙、睡到隔天早上、進你的房間；房間擺設', () => {
    const { game, sys, answer, maps } = makeGame()
    game.warpNow(`town:${DEV_TOWN}`, 23, 21, 'right')
    run(game, 2)
    const day = dayKey(game.clock.date)
    answer(0)
    interact(game, 23, 21, 'right')
    run(game, 120)
    expect(game.state.items['game:room-key']).toBe(1)
    expect(dayKey(game.clock.date)).not.toBe(day)
    expect(game.clock.hhmm).toBe('07:00')
    answer(1)
    interact(game, 23, 21, 'right')
    run(game, 80)
    expect(game.map?.id).toBe('room')
    // 架子：放一樣、交換、收回
    game.state.items['game:tenugui'] = 2
    expect(placeFromBag(game, { area: 'shelf', i: 0 }, 'game:tenugui')).toBe(true)
    expect(game.state.items['game:tenugui']).toBe(1)
    expect(moveSlot(game, { area: 'shelf', i: 0 }, { area: 'shelf', i: 5 })).toBe(true)
    expect(roomOf(game).shelf[5]).toBe('game:tenugui')
    sys.refreshRoom()
    const shelf5 = game.npcs.find((a) => a.id === 'shelf-0-5')
    expect(shelf5?.hidden).toBe(false)
    expect(takeBack(game, { area: 'shelf', i: 5 })).toBe(true)
    expect(game.state.items['game:tenugui']).toBe(2)
    expect(slotIndex({ col: 2, row: 1 }, 'shelf')).toBe(8)
    expect(slotIndex({ index: 9 }, 'frame')).toBe(null)
    // 出房間：回到旅館前面
    const room = maps('room')!
    game.player.place(4, 8, 'down')
    game.follower?.reset(4, 7, 'down')
    game.input.press('down', 'test')
    run(game, 40)
    game.input.release('down', 'test')
    run(game, 60)
    expect(game.map?.id).toBe(`town:${DEV_TOWN}`)
    expect(room.entities.some((e) => e.kind === 'roomDoor')).toBe(true)
  })

  it('委託：接下、做完給旅費；拍照的委託要拍到那個地標', () => {
    const { game, sys, answer } = makeGame({ now: new Date('2026-10-16T01:00:00Z') })
    game.warpNow(`town:${DEV_TOWN}`, 8, 20, 'down')
    run(game, 2)
    answer(0)
    interact(game, 8, 20, 'down')
    const q = systemsOf(game).quests.active[0]
    expect(q).toBeTruthy()
    expect(notebookData(game, null).quests.quests[0]?.text).not.toMatch(/\{/)
    if (q!.type === 'deliver') expect(game.state.items[`quest:${q!.id}`]).toBe(1)
    // 假裝做完了
    q!.ready = true
    const money = game.state.money
    if (q!.type === 'deliver') {
      game.warpNow(`town:${DEV_TOWN_2}`, 10, 10, 'up')
      run(game, 2)
      interact(game, 10, 10, 'up')
    } else interact(game, 8, 20, 'down')
    run(game, 10)
    expect(systemsOf(game).quests.active.length).toBe(0)
    expect(game.state.money).toBe(money + q!.reward)
    expect(q!.reward).toBe(rewardOf(q!))
    expect(systemsOf(game).quests.done).toContain(q!.id)
    void sys
  })

  it('相機：取景框停住世界、A 拍、照片進相簿的那一格', async () => {
    const { game, sys } = makeGame()
    game.warpNow(`town:${DEV_TOWN}`, 21, 18, 'up')
    run(game, 2)
    game.input.tap('CAMERA', 'test')
    run(game, 2)
    expect(sys.ui.panel?.kind).toBe('viewfinder')
    expect(game.paused).toBe(true)
    game.input.tap('CAMERA', 'test')
    run(game, 1)
    expect(sys.camera.zoom).toBe(2)
    game.input.tap('A', 'test')
    run(game, 1)
    await new Promise((r) => setTimeout(r, 0))
    const p = sys.ui.panel
    expect(p?.kind).toBe('photo')
    if (p?.kind !== 'photo') return
    expect(p.result.name.ja).toBe('元離宮二条城')
    expect(p.result.score.score).toBeGreaterThan(10)
    expect(game.state.album).toEqual([p.result.id])
    const album = notebookData(game, null).album
    expect(album.pages?.[0]?.key).toBe('spot:wd-Q1013399')
    expect(album.pages?.[0]?.slots.map((s) => s.label)).toEqual(['平常', '春櫻', '秋楓', '雪', '夜', '祭典'])
    // 4/2 是京都的櫻（平年）
    expect(album.pages?.[0]?.slots.find((s) => s.photo)?.slot).toBe('sakura')
    sys.closePanel()
    expect(game.paused).toBe(false)
  })
})

// ---------- 存檔 ----------
describe('systems 的存檔', () => {
  it('存了再讀回來一樣（照片說明、印的日期、聽來的、委託、房間）', () => {
    const { game, store, maps } = makeGame()
    const s = systemsOf(game)
    s.photos.p1 = { id: 'p1', page: 'spot:x', name: { ja: 'x' }, slot: 'night', d: '2026-04-02', t: 'night', s: 'spring', score: 40, w: 240, h: 160 }
    s.album['spot:x'] = { night: 'p1' }
    game.state.album.push('p1')
    s.eaten['kyoto-Q108799327'] = { d: '2026-04-02', n: 2 }
    s.heard.push({ k: 'sign', id: 'spot:wd-Q1013399', d: '2026-04-02' })
    s.quests.active.push({ id: 'q1', type: 'photo', from: DEV_TOWN, giver: 'quest-1', spot: 'wd-Q1013399', reward: 600, d: '2026-04-02' })
    roomOf(game).shelf[3] = 'game:tenugui'
    expect(game.save().ok).toBe(true)
    const raw = Object.values(store.data)[0]!
    expect(raw.length).toBeLessThan(50 * 1024)
    const g2 = new Game({ tokens, maps, start: DEV_START, storage: store, seed: 3 })
    installSystems(g2, { prefs: PREFS, maps })
    expect(g2.continueGame()).toBe(true)
    const s2 = systemsOf(g2)
    expect(s2.photos.p1).toEqual(s.photos.p1)
    expect(s2.album).toEqual(s.album)
    expect(s2.eaten).toEqual(s.eaten)
    expect(s2.heard).toEqual(s.heard)
    expect(s2.quests.active).toEqual(s.quests.active)
    expect(s2.v).toBe(1)
    expect(roomOf(g2).shelf[3]).toBe('game:tenugui')
  })

  it('壞掉的、以後版本的、型別不對的：換成乾淨的', () => {
    expect(parseSystems(null)).toEqual(emptySystems())
    expect(parseSystems({ v: 99, photos: { a: {} } })).toEqual(emptySystems())
    const p = parseSystems({ v: 1, photos: { a: { page: 1 } }, heard: [{ k: 'x' }, { k: 'sign', id: 'spot:1', d: '2026-01-01' }], quests: { active: [{ id: 1 }], done: [3, 'q'] }, visited: ['1', '1', 2] })
    expect(p.photos).toEqual({})
    expect(p.heard.length).toBe(1)
    expect(p.quests).toEqual({ active: [], done: ['q'] })
    expect(p.visited).toEqual(['1'])
  })
})
