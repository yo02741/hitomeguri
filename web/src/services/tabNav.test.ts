import { describe, expect, it } from 'vitest'

import { atRoot, tabAction, tabOf } from './tabNav'

const explore = { to: '/', match: ['home', 'explore', 'map', 'region'] }
const trips = { to: '/trips', match: ['trips', 'trip', 'prep', 'practice', 'book'] }
const tabs = [explore, trips]

describe('tabOf', () => {
  it('依路由名稱找分頁', () => {
    expect(tabOf(tabs, 'region')).toBe(explore)
    expect(tabOf(tabs, 'prep')).toBe(trips)
    expect(tabOf(tabs, 'me')).toBeUndefined()
    expect(tabOf(tabs, undefined)).toBeUndefined()
  })
})

describe('atRoot', () => {
  it('探索的根包含 /explore', () => {
    expect(atRoot(explore, '/')).toBe(true)
    expect(atRoot(explore, '/explore')).toBe(true)
    expect(atRoot(explore, '/map/kyoto')).toBe(false)
    expect(atRoot(trips, '/trips')).toBe(true)
    expect(atRoot(trips, '/trips/abc')).toBe(false)
  })
})

describe('tabAction', () => {
  it('點別的分頁：回到記住的位置，沒有就到根', () => {
    expect(tabAction(trips, explore, '/map/kyoto', '/trips/abc/prep', false)).toEqual({ kind: 'go', to: '/trips/abc/prep' })
    expect(tabAction(trips, explore, '/map/kyoto', undefined, true)).toEqual({ kind: 'go', to: '/trips' })
    expect(tabAction(explore, undefined, '/me', '/map/kyoto?spot=x', false)).toEqual({ kind: 'go', to: '/map/kyoto?spot=x' })
  })
  it('點目前的分頁：捲過了先回頂端', () => {
    expect(tabAction(explore, explore, '/region/kyoto', '/region/kyoto', true)).toEqual({ kind: 'top' })
    expect(tabAction(trips, trips, '/trips', '/trips', true)).toEqual({ kind: 'top' })
  })
  it('點目前的分頁：已在頂端就回到根，已在根就不動', () => {
    expect(tabAction(explore, explore, '/region/kyoto', '/region/kyoto', false)).toEqual({ kind: 'go', to: '/' })
    expect(tabAction(trips, trips, '/trips/abc', '/trips/abc', false)).toEqual({ kind: 'go', to: '/trips' })
    expect(tabAction(trips, trips, '/trips', '/trips', false)).toEqual({ kind: 'none' })
    expect(tabAction(explore, explore, '/explore', '/explore', false)).toEqual({ kind: 'none' })
  })
})
