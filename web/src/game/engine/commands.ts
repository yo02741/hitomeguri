import { registerCommand } from './script'
import { parsePath, type Script } from './types'

/**
 * 腳本的內建指令（規格 §4）。每個都是 generator：yield* s.say(…)。
 * P2 的 stamp、shop、photo 用同一個 registerCommand 加（先 declare module 擴充 ScriptCommands）。
 */

registerCommand('say', function* (ctx, text, opts = {}): Script {
  const done = ctx.game.openSay(text, opts)
  yield done
})

registerCommand('ask', function* (ctx, text, options, opts = {}): Script<number> {
  const a = ctx.game.openAsk(text, options, opts)
  yield a.done
  return a.value()
})

registerCommand('walk', function* (ctx, who, path, opts = {}): Script {
  const g = ctx.game
  const a = g.actorOf(who)
  if (!a) return
  for (const d of parsePath(path)) {
    yield () => !a.moving
    // 被擋住：等一下再試，2 秒還過不去就轉向那邊、跳過這一步
    let tries = 0
    while (g.walkStep(a, d, opts.run) === 'blocked' && tries++ < 8) yield 0.25
  }
  yield () => !a.moving
})

registerCommand('face', function* (ctx, who, to): Script {
  const g = ctx.game
  const a = g.actorOf(who)
  if (!a) return
  if (to === 'up' || to === 'down' || to === 'left' || to === 'right') {
    a.dir = to
    return
  }
  const b = g.actorOf(to)
  if (!b) return
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) a.dir = dx > 0 ? 'right' : 'left'
  else if (dy !== 0) a.dir = dy > 0 ? 'down' : 'up'
})

registerCommand('wait', function* (_ctx, sec): Script {
  yield sec
})

registerCommand('give', function* (ctx, item, n = 1): Script {
  const s = ctx.game.state
  s.items[item] = (s.items[item] ?? 0) + Math.max(1, Math.round(n))
  ctx.game.changed('items')
})

registerCommand('take', function* (ctx, item, n = 1): Script<boolean> {
  const s = ctx.game.state
  const have = s.items[item] ?? 0
  const k = Math.max(1, Math.round(n))
  if (have < k) return false
  if (have === k) delete s.items[item]
  else s.items[item] = have - k
  ctx.game.changed('items')
  return true
})

registerCommand('money', function* (ctx, delta): Script<boolean> {
  const s = ctx.game.state
  const d = Math.round(delta)
  // 錢不夠就不扣，回傳 false
  if (s.money + d < 0) return false
  s.money += d
  ctx.game.changed('money')
  return true
})

registerCommand('flag', function* (ctx, name, value): Script<string | number | boolean | undefined> {
  const f = ctx.game.state.flags
  if (value === undefined) return f[name]
  if (value === null || value === false) delete f[name]
  else f[name] = value
  ctx.game.changed('flags')
  return f[name]
})

registerCommand('fade', function* (ctx, dir): Script {
  ctx.game.fadeTo(dir)
  yield () => ctx.game.fadeDone
})

registerCommand('warp', function* (ctx, map, x, y, dir): Script {
  ctx.game.warpNow(map, x, y, dir)
})

registerCommand('sfx', function* (ctx, name): Script {
  ctx.game.emit('sfx', { name })
})

registerCommand('bgm', function* (ctx, name): Script {
  ctx.game.emit('bgm', { name })
})

registerCommand('hop', function* (ctx, who): Script {
  const a = ctx.game.actorOf(who)
  if (a) a.hop = 10
  yield () => !a || a.hop === 0
})
