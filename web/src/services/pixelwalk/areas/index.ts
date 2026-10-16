import type { AreaDef } from '../types'
import { FUJI } from './fuji'
import { HOKKAIDO } from './hokkaido'
import { KAMAKURA } from './kamakura'
import { KYOTO } from './kyoto'
import { MIYAJIMA } from './miyajima'
import { NARA } from './nara'
import { OKINAWA } from './okinawa'
import { OSAKA } from './osaka'
import { SHIRAKAWAGO } from './shirakawago'
import { TOKYO } from './tokyo'

/** 走得到的地區，北到南（第一區是京都，之後隨機） */
export const AREAS: AreaDef[] = [HOKKAIDO, SHIRAKAWAGO, TOKYO, KAMAKURA, FUJI, KYOTO, NARA, OSAKA, MIYAJIMA, OKINAWA].filter((a): a is AreaDef => a !== null)
