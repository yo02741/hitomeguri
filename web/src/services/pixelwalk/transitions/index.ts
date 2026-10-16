import type { TransitionDef } from '../types'
import { FADE } from './gate'
import { MORE_TRANSITIONS } from './more'

/** 地區之間的轉場 */
export const TRANSITIONS: TransitionDef[] = [FADE, ...MORE_TRANSITIONS]
