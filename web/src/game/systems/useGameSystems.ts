import { onBeforeUnmount, shallowRef } from 'vue'

import type { Game } from '../engine/game'

import { type GameSystems, installSystems, type SystemsDeps } from './install'

/**
 * PlayView 用的 composable：Game 建好之後 install(game)，SystemsLayer 拿 systems.value；頁面拆掉時自動 uninstall。
 *
 *   const systems = useGameSystems(() => ({ prefs, world, maps, travel, jingle: (n) => audio.jingle(n) }))
 *   // boot()：offs.push(systems.install(game))
 *   // 模板（.play-screen 裡）：<SystemsLayer v-if="systems.value" :systems="systems.value" :scale="scale" :width="width" />
 *   // 祭典的鎮曲：moodOf(time, systems.value?.festivalNow() ?? false)
 */
export function useGameSystems(deps: () => SystemsDeps) {
  const systems = shallowRef<GameSystems | null>(null)
  function install(game: Game): () => void {
    systems.value?.uninstall()
    const s = installSystems(game, deps())
    systems.value = s
    return () => {
      s.uninstall()
      if (systems.value === s) systems.value = null
    }
  }
  onBeforeUnmount(() => {
    systems.value?.uninstall()
    systems.value = null
  })
  return { systems, install }
}
