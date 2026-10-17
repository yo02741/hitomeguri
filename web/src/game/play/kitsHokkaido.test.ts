import { describe, expect, it } from 'vitest'

import worldRaw from '../fixtures/_world.json'
import hokkaidoRaw from '../fixtures/hokkaido.json'
import kyotoRaw from '../fixtures/kyoto.json'
import { hasTile } from '../engine/tiles'
import { parseWorldIndex, prefData } from '../world/data'
import type { PrefRaw } from '../world/types'
import { createWorld } from '../world/world'
import '../world/kits/hokkaido'

/**
 * 北海道的 kit 自己就夠生成北海道的鎮（不靠關東的 kit 先讀進來）：街上的自動販賣機、郵筒是關東的零件，
 * hokkaido.ts 自己 import kanto.ts。這一檔沒有 import kits/index.ts、kanto.ts（模組的註冊是一個測試檔一份）。
 */
describe('只讀北海道的 kit', () => {
  it('新千歳空港（千歳市）、札幌中央区生成得出來', () => {
    expect(hasTile('hokkaido/grass')).toBe(true)
    expect(hasTile('kanto/vending-a')).toBe(true)
    const index = parseWorldIndex(worldRaw)!
    const w = createWorld([prefData(kyotoRaw as unknown as PrefRaw)], { index })
    w.addPref(prefData(hokkaidoRaw as unknown as PrefRaw))
    for (const id of ['012246', '011011']) {
      const g = w.generate(id)
      expect(g, id).toBeTruthy()
      expect(g!.map.w, id).toBeGreaterThan(0)
    }
  })
})
