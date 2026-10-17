import { describe, expect, it } from 'vitest'

import css from '../../../styles/theme.css?raw'
import { Gfx } from '../../../services/pixelwalk/gfx'
import { PX, type Tokens } from '../../../services/pixelwalk/palette'

import worldRaw from '../../fixtures/_world.json'
import hokkaidoRaw from '../../fixtures/hokkaido.json'
import hyogoRaw from '../../fixtures/hyogo.json'
import kyotoRaw from '../../fixtures/kyoto.json'
import naraRaw from '../../fixtures/nara.json'
import okinawaRaw from '../../fixtures/okinawa.json'
import osakaRaw from '../../fixtures/osaka.json'
import tokyoRaw from '../../fixtures/tokyo.json'

import { SONG_IDS } from '../../audio/songs'
import { emptyMap, MapView } from '../../engine/map'
import { TileCache, tileDef, tileId } from '../../engine/tiles'
import type { GameMap } from '../../engine/types'
import { registerDefaultLooks } from '../../sprites'
import { songOf } from '../../ui/sound'

import { parseWorldIndex, prefData } from '../data'
import { renderMap } from '../preview'
import { rideOverlay } from '../ride'
import type { PrefRaw } from '../types'
import { createWorld } from '../world'
import { landmarkBlueprint } from './blueprints'
import { classify } from './classify'
import { HOKKAIDO_SNOW_OBJECTS } from '../kits/snowcover'
import { rolesOf } from './roles'
import { flood, hutName, targetsOf } from './town'
// 關東、北海道的 kit 在 /play 是到那一縣才讀（play/world.ts 的 loadKitModule）；測試一次全部註冊
import '../kits'

/**
 * P3 的地方 kit（規格 §12）：關東（東京）、北海道的鎮。只讀 fixture。
 * 鎮曲照 kit、資料沒寫的不畫（塔、運河、倉庫、時計台照名字；薰衣草只在有花田的鎮）、街上有斑馬線與高架、
 * 路人照 kit 挑、每個門與拍攝點都走得到、同一份資料每次一樣；車窗都畫得出來。
 */
const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
const all = () => [kyotoRaw, okinawaRaw, naraRaw, osakaRaw, hyogoRaw, tokyoRaw, hokkaidoRaw].map((x) => prefData(x as unknown as PrefRaw))
const world = createWorld(all(), { index: parseWorldIndex(worldRaw) })
const p3Towns = world.towns.filter((t) => t.pref === 'tokyo' || t.pref === 'hokkaido')

const names = (m: GameMap) => {
  const out = new Set<string>()
  for (const layer of [m.ground, m.lower, m.over]) for (const id of layer) if (id) out.add(tileDef(id)?.name ?? '')
  return out
}
const has = (m: GameMap, re: RegExp) => [...names(m)].some((n) => re.test(n))

describe('P3 的 kit：東京、北海道', () => {
  it('東京 9 鎮是關東 kit、北海道 9 鎮是北海道 kit', () => {
    expect(p3Towns.filter((t) => t.pref === 'tokyo').every((t) => t.kit === 'kanto')).toBe(true)
    expect(p3Towns.filter((t) => t.pref === 'hokkaido').every((t) => t.kit === 'hokkaido')).toBe(true)
    expect(p3Towns.length).toBeGreaterThanOrEqual(12)
  })

  it('鎮曲：關東放東京、北海道放北海道、近畿（奈良、大阪、兵庫）放京都那首；都是有的曲子', () => {
    const want: Record<string, string> = { kanto: 'tokyo', hokkaido: 'hokkaido', kinki: 'kyoto', okinawa: 'okinawa' }
    for (const pref of ['tokyo', 'hokkaido', 'nara', 'osaka', 'hyogo']) {
      const t = world.towns.find((x) => x.pref === pref)!
      const m = world.generate(t.id)!.map
      expect(m.bgm, pref).toBe(want[t.kit])
      expect(SONG_IDS, pref).toContain(songOf(m.bgm))
    }
  })

  it('每個鎮：門、拍攝點、告示牌、NPC 都走得到；生成兩次一樣', () => {
    const other = createWorld(all(), { index: parseWorldIndex(worldRaw) })
    for (const t of p3Towns) {
      const g = world.generate(t.id)!
      const view = new MapView(g.map)
      const start = g.map.start!
      const reach = flood(view, start)
      for (const target of targetsOf({ w: g.map.w, h: g.map.h, map: g.map }, view)) expect(target.cells.some((c) => reach[c.y * g.map.w + c.x]), `${t.name.ja} ${target.what}`).toBe(true)
      const b = other.generate(t.id)!.map
      expect(Array.from(b.ground), t.id).toEqual(Array.from(g.map.ground))
      expect(Array.from(b.lower), t.id).toEqual(Array.from(g.map.lower))
      expect(JSON.stringify(b.entities), t.id).toBe(JSON.stringify(g.map.entities))
    }
  })

  it('地面、房子、樹用的是自己那一套 kit 的（寺社、城、攤子可以沿用近畿）', () => {
    for (const t of p3Towns) {
      const m = world.generate(t.id)!.map
      const ns = names(m)
      // 近畿的町家、民家、田、竹不出現在東京與北海道
      expect([...ns].filter((n) => /^kinki\/(machiya|minka|nagaya|field|bamboo|grass|road|stone\b)/.test(n)), t.name.ja).toEqual([])
      expect([...ns].some((n) => n.startsWith(`${t.kit}/`)), t.name.ja).toBe(true)
    }
  })

  it('東京的街上：柏油路與人行道、路口有斑馬線與紅綠燈；有鐵路的車站北邊有高架', () => {
    const urban = p3Towns.filter((t) => t.pref === 'tokyo' && t.urban)
    expect(urban.length).toBeGreaterThan(4)
    for (const t of urban) {
      const m = world.generate(t.id)!.map
      expect(has(m, /^kanto\/street$/), t.name.ja).toBe(true)
      expect(has(m, /^kanto\/zebra-[hv]$/), t.name.ja).toBe(true)
    }
    expect(urban.some((t) => has(world.generate(t.id)!.map, /^kanto\/viaduct$/))).toBe(true)
    expect(urban.some((t) => has(world.generate(t.id)!.map, /^kanto\/signal\//))).toBe(true)
  })

  it('塔只在名字（或中文名）有「塔」、或類型是展望的「…タワー」；運河、紅磚倉庫、時計台只在名字有寫的鎮', () => {
    for (const t of p3Towns) {
      const g = world.generate(t.id)!
      const pref = world.prefOf(t.id)!
      const spots = g.landmarks.map((l) => pref.spotById(l.spotId)!).filter(Boolean)
      const m = g.map
      const towerOk = spots.some((s) => /塔/.test(`${s.n} ${s.z ?? ''}`) || (s.c === '展望' && /タワー|展望塔|瞭望塔|観光塔|觀光塔|電波塔/.test(`${s.n} ${s.summary?.text ?? ''} ${s.summary?.text_zh ?? ''}`)))
      if (has(m, /\/tower-(lattice|tall)\//)) expect(towerOk, t.name.ja).toBe(true)
      if (has(m, /^hokkaido\/warehouse\//)) expect(spots.some((s) => /倉庫/.test(s.n)), t.name.ja).toBe(true)
      if (has(m, /^hokkaido\/clocktower\//)) expect(spots.some((s) => /時計台/.test(s.n)), t.name.ja).toBe(true)
      if (g.landmarks.some((l) => l.kind === 'canal')) expect(spots.some((s) => /運河/.test(s.n)), t.name.ja).toBe(true)
      // 沒有天守、五重塔
      expect([...names(m)].filter((n) => /tenshu|pagoda|gojuno/.test(n))).toEqual([])
    }
    const sapporo = world.generate('011011')
    if (sapporo) {
      expect(has(sapporo.map, /^hokkaido\/clocktower\//)).toBe(true)
      expect(has(sapporo.map, /^hokkaido\/tower-lattice\//)).toBe(true)
    }
  })

  it('薰衣草田只在有花田（ラベンダー、ファーム、ガーデン…）的北海道的鎮', () => {
    for (const t of p3Towns.filter((x) => x.kit === 'hokkaido')) {
      const g = world.generate(t.id)!
      const flower = g.landmarks.some((l) => l.kind === 'flowerfield')
      if (has(g.map, /^hokkaido\/lavender$/)) expect(flower, t.name.ja).toBe(true)
    }
    expect(p3Towns.some((t) => t.kit === 'hokkaido' && has(world.generate(t.id)!.map, /^hokkaido\/lavender$/))).toBe(true)
  })

  it('路人照 kit 挑（東京多是上班的人與學生、北海道多是農家與觀光客）', () => {
    for (const t of p3Towns) {
      const folks = rolesOf(t.kit).folks!
      for (const e of world.generate(t.id)!.map.entities)
        if (e.kind === 'npc' && /^folk-/.test(String(e.data?.look))) expect(folks, `${t.name.ja} ${e.id}`).toContain(e.data!.look)
    }
  })

  it('分類：名字補判斷（塔、鐵塔、高樓、十字路口、教堂、時計台、山、湖、瀑布、溫泉、花田、河）；近畿、沖繩照舊', () => {
    expect(classify({ n: '東京タワー', z: '東京鐵塔' }, 'kanto')).toBe('lattice')
    expect(classify({ n: '東京スカイツリー', z: '東京晴空塔' }, 'kanto')).toBe('tower')
    expect(classify({ n: '六本木ヒルズ' }, 'kanto')).toBe('building')
    expect(classify({ n: 'モード学園コクーンタワー', z: 'Mode學園蟲繭大廈' }, 'kanto')).toBe('building')
    expect(classify({ n: '渋谷スクランブル交差点' }, 'kanto')).toBe('crossing')
    expect(classify({ n: '国会議事堂' }, 'kanto')).toBe('generic')
    expect(classify({ n: '高尾山' }, 'kanto')).toBe('mountain')
    expect(classify({ n: '神田川' }, 'kanto')).toBe('river')
    expect(classify({ n: '札幌市時計台', c: '博物館' }, 'hokkaido')).toBe('clocktower')
    expect(classify({ n: 'トラピスチヌ修道院', c: '寺院' }, 'hokkaido')).toBe('church')
    expect(classify({ n: '小樽運河' }, 'hokkaido')).toBe('canal')
    expect(classify({ n: '金森赤レンガ倉庫' }, 'hokkaido')).toBe('warehouse')
    expect(classify({ n: '五稜郭タワー', z: '五稜郭塔', c: '展望' }, 'hokkaido')).toBe('tower')
    expect(classify({ n: 'さっぽろテレビ塔', z: '札幌電視塔' }, 'hokkaido')).toBe('lattice')
    expect(classify({ n: '摩周湖' }, 'hokkaido')).toBe('lake')
    expect(classify({ n: '青い池' }, 'hokkaido')).toBe('lake')
    expect(classify({ n: 'オシンコシンの滝' }, 'hokkaido')).toBe('falls')
    expect(classify({ n: '登別温泉' }, 'hokkaido')).toBe('onsen')
    // 花田：名字只有「ファーム」的要在富良野、美瑛一帶（中富良野町 014613）或簡介寫了花田
    expect(classify({ n: 'ファーム富田', m: '014613' }, 'hokkaido')).toBe('flowerfield')
    expect(classify({ n: '四季彩の丘', c: '庭園' }, 'hokkaido')).toBe('flowerfield')
    expect(classify({ n: '上野ファーム', c: '庭園', m: '012041', summary: { text: '北海道旭川市にある観光庭園。' } }, 'hokkaido')).toBe('garden')
    expect(classify({ n: '某ファーム', m: '012041', summary: { text: 'ラベンダーの花畑が広がる。' } }, 'hokkaido')).toBe('flowerfield')
    // 塔：中文名翻成「塔」的「…タワー」是高樓（東京スカイツリーの中文名「晴空塔」、名字沒有タワー：塔）
    expect(classify({ n: '新宿パークタワー', z: '新宿公園塔' }, 'kanto')).toBe('building')
    expect(classify({ n: '東急歌舞伎町タワー', z: '東急歌舞伎町塔' }, 'kanto')).toBe('building')
    // 離宮：名字結尾的才是一般的大建築；名字中間有「離宮」的庭園照類型
    expect(classify({ n: '迎賓館赤坂離宮' }, 'kanto')).toBe('generic')
    expect(classify({ n: '浜離宮恩賜庭園', c: '公園' }, 'kanto')).toBe('park')
    expect(classify({ n: '旧芝離宮恩賜庭園', c: '公園' }, 'kanto')).toBe('park')
    // 外苑不是神社
    expect(classify({ n: '明治神宮外苑' }, 'kanto')).toBe('park')
    expect(classify({ n: '明治神宮', c: '神社' }, 'kanto')).toBe('shrine')
    expect(classify({ n: '宗谷岬', c: '岬' }, 'hokkaido')).toBe('view')
    expect(classify({ n: '旭岳' }, 'hokkaido')).toBe('mountain')
    expect(classify({ n: '函館山', c: '公園' }, 'hokkaido')).toBe('park')
    // 近畿、沖繩照舊（京都、沖繩的縣、沒給縣：P2 的規則）
    expect(classify({ n: '京都タワー' }, 'kinki')).toBe('tower')
    expect(classify({ n: '京都タワー', c: '展望' }, 'kinki', 'kyoto')).toBe('tower')
    expect(classify({ n: '小樽運河' }, 'kinki')).toBe('generic')
    expect(classify({ n: '東京タワー', z: '東京鐵塔' }, 'kinki')).toBe('tower')
    expect(classify({ n: '三宮' }, 'kinki', 'kyoto')).toBe('shrine')
  })

  it('街上的棋盤小路沒有通到地圖邊的死巷（5 格以上、1 格寬、盡頭沒有門或人）', () => {
    for (const t of p3Towns) {
      const g = world.generate(t.id)!
      const m = g.map
      if (m.setting !== 'urban') continue
      const v = new MapView(m)
      const W = m.w
      const H = m.h
      const ok = new Set([0, 7, 10, 11])
      const pass = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && ok.has(v.beh(x, y)) && v.beh(x, y) !== 7
      const near = new Set<string>()
      for (const e of m.entities) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) near.add(`${e.x + dx!},${e.y + dy!}`)
      for (const w of m.warps) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) near.add(`${w.x + dx!},${w.y + dy!}`)
      const nb = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => pass(x + dx!, y + dy!)).map(([dx, dy]) => [x + dx!, y + dy!] as [number, number])
      const bad: string[] = []
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (!pass(x, y) || near.has(`${x},${y}`) || nb(x, y).length !== 1) continue
          if (!(x <= 3 || x >= W - 4 || y <= 3 || y >= H - 4)) continue
          if (!/street/.test(tileDef(m.ground[y * W + x]!)?.name ?? '')) continue
          let len = 1
          let [px, py] = [x, y]
          let [cx, cy] = nb(x, y)[0]!
          while (len < 80) {
            const n = nb(cx, cy)
            if (n.length !== 2 || near.has(`${cx},${cy}`)) break
            const next = n.find(([a, b]) => !(a === px && b === py))!
            ;[px, py] = [cx, cy]
            ;[cx, cy] = next
            len++
          }
          if (len >= 5) bad.push(`(${x},${y})L${len}`)
        }
      expect(bad, `${t.name.ja}`).toEqual([])
    }
  })

  it('高架的橋面下的人整個看不到（頭不會冒到鐵軌上）；橋面南邊一格的人照畫', () => {
    registerDefaultLooks()
    const tid = (n: string) => tileId(n)
    const make = (people: Array<[number, number]>) => {
      const m = emptyMap({ id: 't', name: { ja: 't', romaji: '', zh: 't' }, w: 8, h: 7, outdoor: true, border: { ground: tid('kanto/street') }, ground: tid('kanto/street') })
      for (let x = 0; x < 8; x++) m.over[3 * 8 + x] = tid('kanto/viaduct')
      m.entities = people.map(([x, y], i) => ({ id: `p${i}`, kind: 'npc', x, y, facing: 'down', data: { look: 'folk-a' } }))
      return renderMap(m, tokens, 'summer', 'day')
    }
    const empty = make([])
    const under = make([[2, 3]])
    const south = make([[5, 4]])
    const same = (a: Gfx, b: Gfx, x0: number, y0: number, w: number, h: number) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (a.buf[y * a.w + x] !== b.buf[y * b.w + x]) return false
      return true
    }
    // 橋面下（第 3 列）的人：橋面以上、橋面本身都跟沒有人一樣
    expect(same(under, empty, 0, 0, 8 * 16, 4 * 16)).toBe(true)
    // 南邊一格的人：畫出來了（頭被橋面的大樑擋到一點沒關係）
    expect(same(south, empty, 5 * 16 - 8, 4 * 16, 32, 16)).toBe(false)
  })

  it('北海道的鎮：近畿的寺社、茶屋、展館換成冬天厚雪的那一份；庭園、公園的池冬天結冰（湖的 tile）；京都照舊', () => {
    const snowy = new Set(Object.keys(HOKKAIDO_SNOW_OBJECTS))
    const cache = new TileCache(tokens)
    for (const t of p3Towns.filter((x) => x.kit === 'hokkaido')) {
      const m = world.generate(t.id)!.map
      const left = [...names(m)].filter((n) => snowy.has(n.replace(/\/\d+,\d+$/, '')) || n === 'kinki/arcade')
      expect(left, t.name.ja).toEqual([])
    }
    expect(p3Towns.some((t) => t.kit === 'hokkaido' && has(world.generate(t.id)!.map, /^hokkaido\/kinki-/))).toBe(true)
    // 冬天的版本比近畿的白（上緣多了雪）；夏天一樣
    const px = (name: string, season: 'summer' | 'winter') => Array.from(cache.draw(tileDef(tileId(name))!, { season, time: 'day', frame: 0, variant: 0, mask: 0, x: 0, y: 0 }).buf)
    expect(px('hokkaido/kinki-haiden/2,0', 'summer')).toEqual(px('kinki/haiden/2,0', 'summer'))
    expect(px('hokkaido/kinki-haiden/2,0', 'winter')).not.toEqual(px('kinki/haiden/2,0', 'winter'))
    expect(px('hokkaido/kinki-torii/1,0', 'winter')).not.toEqual(px('kinki/torii/1,0', 'winter'))
    // 池：北海道是湖的 tile（冬天結冰），京都、東京照舊是水
    expect(rolesOf('hokkaido').pond).toBe('hokkaido/lake')
    expect(rolesOf('kinki').pond).toBe('kinki/water')
    expect(rolesOf('okinawa').pond).toBe(rolesOf('okinawa').water)
    expect(rolesOf('kinki').objSub).toBeUndefined()
  })

  it('名城的章一定蓋得到：說蓋章地點的 NPC 在的鎮，地圖或室內有那個章（五稜郭也是）；授与所只在神社、寺院', () => {
    let castles = 0
    for (const t of world.towns) {
      const g = world.generate(t.id)!
      const maps = [g.map, ...g.interiors.values()]
      const stamps = maps.flatMap((m) => m.entities.filter((e) => e.kind === 'stamp').map((e) => e.data as { stampKind?: string; castleId?: string; spotId?: string }))
      for (const e of g.map.entities) {
        const f = (e.data as { fact?: { template?: string; ref?: { id?: string } } } | undefined)?.fact
        if (e.kind !== 'npc' || f?.template !== 'castle.stamp') continue
        castles++
        expect(stamps.some((x) => x.stampKind === 'castle' && x.castleId === f.ref?.id), `${t.name.ja} ${f.ref?.id}`).toBe(true)
      }
      const pd = world.prefOf(t.id)!
      for (const x of stamps.filter((s) => s.stampKind === 'sanpai')) {
        const sp = pd.spotById(x.spotId!)!
        expect(sp.c === '神社' || sp.c === '寺院' || /神社|大社|神宮|天満宮|八幡宮|稲荷|宮$|寺|院|堂$/.test(sp.n), `${t.name.ja} ${sp.n}`).toBe(true)
      }
    }
    expect(castles).toBeGreaterThan(10)
    // 五稜郭（史跡）：城的藍圖，章在城門邊的蓋章台（資料寫的是屋外）
    const hk = world.generate('012025')!
    expect(hk.landmarks.find((l) => l.spotId === 'wd-Q1196357')?.kind).toBe('castle')
    const table = hk.map.entities.find((e) => e.kind === 'stamp' && (e.data as { castleId?: string }).castleId === 'castle-002')
    expect(table).toBeTruthy()
    expect(tileDef(hk.map.lower[table!.y * hk.map.w + table!.x]!)?.name).toBe('world/stamp-table')
    expect([...hk.interiors.keys()].some((k) => k.includes(':castle:'))).toBe(false)
  })

  it('城的蓋章處的名字：括號裡的開館時間拿掉、不寫天守閣（P3）', () => {
    expect(hutName('高槻市立しろあと歴史館 (日曜日のみ開館)', '芥川山城')).toBe('高槻市立しろあと歴史館')
    expect(hutName('天守閣1階インフォメーションカウンター', '大阪城')).toBe('大阪城　インフォメーションカウンター')
    expect(hutName('岸和田城天守閣受付', '岸和田城')).toBe('岸和田城受付')
    expect(hutName('明石公園サービスセンター受付窓口', '明石城')).toBe('明石公園サービスセンター受付窓口')
  })

  it('分類：近畿 kit 的 P3 的縣（奈良、大阪、兵庫）：寺社收緊、山、河、教堂、高樓、塔；京都不變', () => {
    const k = (spot: Parameters<typeof classify>[0], pref = 'osaka') => classify(spot, 'kinki', pref)
    // 不是寺社的不畫鳥居、山門（也就沒有授与所、參拜印）
    expect(k({ n: '平城宮', c: '史跡' }, 'nara')).toBe('monument')
    expect(k({ n: '難波宮', c: '史跡' })).toBe('monument')
    expect(k({ n: '三宮' }, 'hyogo')).toBe('generic')
    expect(k({ n: '大阪市中央公会堂' })).toBe('generic')
    expect(k({ n: '敷津松之宮' })).toBe('shrine')
    expect(k({ n: '東大寺大仏殿' }, 'nara')).toBe('temple')
    expect(k({ n: '慈光院 (大和郡山市)' }, 'nara')).toBe('temple')
    expect(k({ n: '小泉城 (大和国)' }, 'nara')).toBe('castle')
    // 山、河、溫泉、教堂、墓地
    expect(k({ n: '摩耶山', summary: { text: '摩耶山是位於日本兵庫縣神戶市灘區六甲山地中央的一座標高702米的山峰。' } }, 'hyogo')).toBe('mountain')
    expect(k({ n: '富岳', summary: { text: '富嶽是富士通與日本理化學研究所共同發明的超級電腦。' } }, 'hyogo')).toBe('generic')
    expect(k({ n: 'イオンモール大和郡山' }, 'nara')).toBe('generic')
    expect(k({ n: '佐保川' }, 'nara')).toBe('river')
    expect(k({ n: '有馬温泉' }, 'hyogo')).toBe('onsen')
    expect(k({ n: '風の教会', z: '風之教會' }, 'hyogo')).toBe('church')
    expect(k({ n: '神戸市立外国人墓地', c: '名勝' }, 'hyogo')).toBe('grove')
    expect(k({ n: 'キッザニア甲子園' }, 'hyogo')).toBe('generic')
    // 塔：「…タワー」類型不是展望的是高樓；展望的是細長的塔；「…の塔」的雕塑不是塔
    expect(k({ n: '中之島フェスティバルタワー' })).toBe('building')
    expect(k({ n: 'SiSりんくうタワー', z: '臨空門大廈' })).toBe('building')
    expect(k({ n: '神戸ポートタワー', z: '神戶港塔', c: '展望' }, 'hyogo')).toBe('tower')
    expect(k({ n: '太陽の塔', z: '太陽之塔' })).toBe('monument')
    // 名字沒有塔的展望塔：類型是展望、簡介寫「瞭望塔」才畫塔（湊町リバープレイス、掬星台這種展望的地方不是）
    expect(k({ n: '通天閣', z: '通天閣', c: '展望', summary: { text: '通天閣是位於日本大阪府大阪市浪速區新世界商業街的一個瞭望塔，為登錄有形文化財。' } })).toBe('tower')
    expect(k({ n: '湊町リバープレイス', z: '湊町PA', c: '展望', summary: { text: '湊町リバープレイスは、大阪市浪速区湊町一丁目にある、多目的複合イベントスペースである。' } })).toBe('view')
    expect(k({ n: '掬星台', c: '展望', summary: { text: '掬星臺是兵庫縣神戶市六甲山地摩耶山山頂附近的一個廣場。' } }, 'hyogo')).toBe('view')
    expect(k({ n: '梅田スカイビル' })).toBe('building')
    // 藍圖：P3 的近畿的塔是細長的塔（不是京都塔），分不出來的是小小的石碑
    expect(landmarkBlueprint('tower', 'M', 'kinki', { p3: true }).legend?.T?.obj).toMatchObject({ kinki: 'kanto/tower-tall' })
    expect(landmarkBlueprint('tower', 'M', 'kinki').legend?.T?.obj).toBe('kinki/tower')
    expect(landmarkBlueprint('generic', 'M', 'kinki', { p3: true }).legend?.M?.obj).toBe('kinki/monument')
    expect(landmarkBlueprint('generic', 'M', 'kinki').legend?.H?.obj).toBe('kinki/hall')
  })

  it('車窗：關東、北海道的電車、巴士、飛機、新幹線，三個時段、四季都畫得出來（窗外不是空的）', () => {
    const cache = new TileCache(tokens)
    for (const kit of ['kanto', 'hokkaido'] as const)
      for (const mode of ['rail', 'bus', 'plane'] as const)
        for (const time of ['day', 'dusk', 'night'] as const)
          for (const season of ['spring', 'summer', 'autumn', 'winter'] as const)
            for (const shinkansen of mode === 'rail' ? [false, true] : [false])
              for (const h of [160, 256]) {
                const g = new Gfx(240, h, cache.palette(time))
                const draw = rideOverlay({ mode, kit, time, season, shinkansen })
                draw(g, 0)
                draw(g, 1.7)
                // 窗的中間一列不是全部同一個顏色（有風景）
                const y = Math.floor(h / 2) - 10
                const row = new Set(Array.from({ length: 160 }, (_, i) => g.buf[y * g.w + 40 + i]))
                expect(row.size, `${kit} ${mode} ${time} ${season} ${shinkansen} ${h}`).toBeGreaterThan(2)
                expect(g.buf.every((v) => v !== 0), `${kit} ${mode} 沒有透明的洞`).toBe(true)
              }
  })
})
