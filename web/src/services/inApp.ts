/**
 * App 內建的瀏覽器（決定事項 J3）：Google 不讓內嵌的 WebView 登入，從 LINE 等 App 打開共編邀請時登入不了。
 *
 * LINE 官方文件（https://developers.line.biz/en/docs/line-login/using-line-url-scheme/）：
 * 網址加上 `openExternalBrowser=1`，從 LINE 打開時改用外部瀏覽器（LIFF 網址除外）。
 * 邀請連結本身就帶這個參數；在 LINE 裡打開了沒有參數的舊連結時，JoinView 的「用瀏覽器開啟」導到帶參數的網址。
 * 網址已經帶參數還停在 LINE 裡（LINE 沒有照參數開外部瀏覽器）時，再導一次沒有用，只給複製連結。
 * 其他 App（Facebook、Instagram、Android WebView…）沒有公開的參數，只給複製連結。
 */
export const LINE_EXTERNAL_PARAM = 'openExternalBrowser'

export type InAppBrowser = 'line' | 'other'

/** 依 User-Agent 判斷；不是 App 內建的瀏覽器時回傳 null */
export function inAppBrowser(ua: string): InAppBrowser | null {
  if (/\bLine\/\d/.test(ua)) return 'line'
  if (/FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|KAKAOTALK|; wv\)/.test(ua)) return 'other'
  return null
}

/** 從 LINE 打開時改用外部瀏覽器的網址 */
export function withLineExternal(href: string): string {
  const u = new URL(href)
  u.searchParams.set(LINE_EXTERNAL_PARAM, '1')
  return u.href
}
