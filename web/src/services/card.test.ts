import { describe, expect, it } from 'vitest'

import type { MapSpot } from './bundles'
import { cardFromMapSpot, cardPhoto, cardPhotoSources, photoTry, type CardFace } from './card'
import { BASE_VARIANT, decodeVariant, seasonVariant, type Variant } from './cardVariants'

const T = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/'
const v = (code: string): Variant => decodeVariant(code)!

const face: CardFace = {
  id: 'wd-Q1',
  pref: 'kyoto',
  name: { ja: '円山公園' },
  image: { url: `${T}a/ab/Main.jpg/960px-Main.jpg` },
  seasonImages: { night: { url: `${T}c/cd/Night.jpg/960px-Night.jpg` } },
}

describe('cardPhoto', () => {
  it('基本卡用主照片，夜景卡用夜景照片', () => {
    expect(cardPhoto(face, BASE_VARIANT)?.url).toContain('Main.jpg')
    expect(cardPhoto(face, v('night'))?.url).toContain('Night.jpg')
  })

  it('知道沒有那個季節的照片時才用主照片', () => {
    expect(cardPhoto(face, seasonVariant('autumn'))?.url).toContain('Main.jpg')
    expect(cardPhoto({ ...face, seasonImages: {} }, v('full@spring'))?.url).toContain('Main.jpg')
  })

  it('季節照片還不知道有沒有時不先拿主照片頂替', () => {
    const loading = { ...face, seasonImages: undefined }
    expect(cardPhoto(loading, v('night'))).toBeUndefined()
    expect(cardPhoto(loading, seasonVariant('spring'))).toBeUndefined()
    // 全景卡沒有指定季節：本來就用主照片
    expect(cardPhoto(loading, v('full'))?.url).toContain('Main.jpg')
    expect(cardPhoto(loading, BASE_VARIANT)?.url).toContain('Main.jpg')
  })

  it('地圖 bundle 沒有季節照片時是「知道沒有」（{}）', () => {
    const s: MapSpot = { id: 'wd-Q2', n: '東寺', lat: 0, lng: 0, k: 'major', f: 0, s: 1, i: 'a/ab/Toji.jpg/250px-Toji.jpg' } as MapSpot
    const f = cardFromMapSpot(s, 'kyoto')
    expect(f.seasonImages).toEqual({})
    expect(cardPhoto(f, seasonVariant('winter'))?.url).toContain('Toji.jpg')
  })
})

describe('photoTry', () => {
  it('失敗次數跟著照片：換照片就從第一個網址試', () => {
    const fail = { key: 'A', n: 2 }
    expect(photoTry(fail, 'A')).toBe(2)
    expect(photoTry(fail, 'B')).toBe(0)
  })

  it('換照片後的第一個網址是新照片的大縮圖', () => {
    const fail = { key: face.image!.url, n: 1 }
    const night = cardPhoto(face, v('night'))!.url
    const list = cardPhotoSources(night, 'lg', true)
    expect(list[photoTry(fail, night)]).toBe(`${T}c/cd/Night.jpg/1280px-Night.jpg`)
  })
})
