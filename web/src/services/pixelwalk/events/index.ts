import type { EventDef } from '../types'
import { COMMON_EVENTS } from './common'
import { EXTRA_EVENTS } from './extra'

/** 共用的腳本（地區自己的在 areas/*.ts 的 events） */
export const EVENTS: EventDef[] = [...COMMON_EVENTS, ...EXTRA_EVENTS]
