import type { TransitionDef } from '../types'

/** 最基本的轉場：走著走著畫面抖色暗下去，換區，再亮回來（像 GBA 走出路口） */
export const FADE: TransitionDef = {
  id: 'fade',
  *run(s) {
    let level = 0
    s.paint('over', (g) => g.cover('ink', level))
    for (let i = 0; i <= 16; i++) {
      level = i
      yield 0.035
    }
    s.swap()
    s.hero.stop()
    yield 0.4
    s.hero.walk()
    // 開始亮回來
    s.reveal()
    for (let i = 16; i >= 0; i--) {
      level = i
      yield 0.035
    }
  },
}
