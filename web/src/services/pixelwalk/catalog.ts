import { AREAS } from './areas'
import { EVENTS } from './events'
import { TRANSITIONS } from './transitions'
import type { EventDef } from './types'

export { AREAS, EVENTS, TRANSITIONS }

/** 全部的腳本（共用＋各地區的），預覽與測試用 */
export function allEvents(): Array<{ def: EventDef; area: string | null }> {
  return [...EVENTS.map((def) => ({ def, area: null })), ...AREAS.flatMap((a) => (a.events ?? []).map((def) => ({ def, area: a.id })))]
}
