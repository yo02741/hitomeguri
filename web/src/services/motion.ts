/**
 * 動態曲線（DESIGN.md §9）：WAAPI 的 easing 不能寫 var()，從 theme.css 的 --ease-* token 讀出字面值。
 * ease('out-soft')、ease('stamp')、ease('flip')
 */
export const ease = (name: 'out-soft' | 'stamp' | 'flip'): string =>
  getComputedStyle(document.documentElement).getPropertyValue(`--ease-${name}`).trim()
