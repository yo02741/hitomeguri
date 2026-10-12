import type { PopupRedirectResolver, User } from 'firebase/auth'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { firebaseAvailable } from '../services/firebaseEnv'
import { showToast } from '../services/toast'

// Firebase SDK 以動態 import 載入：沒有設定 Firebase 時完全不下載，也不擋住首頁載入。
const loadFirebase = () => Promise.all([import('../services/firebase'), import('firebase/auth')])
// 登入視窗用的 resolver 只建一份：Firebase 用 new 建它（每個 class 一份），warmUp 用 new 拿到的也是同一個
type Ctor = new () => object
let Resolver: Ctor | null = null
let resolverInstance: object | null = null
function popupResolver(base: PopupRedirectResolver): Ctor {
  if (!Resolver)
    Resolver = class extends (base as unknown as Ctor) {
      constructor() {
        super()
        if (resolverInstance) return resolverInstance
        resolverInstance = this
      }
    }
  return Resolver
}
const whenIdle = (fn: () => void) => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => fn(), { timeout: 4000 })
  else setTimeout(fn, 1500)
}

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  // Auth 狀態已確定（或 Firebase 未設定）時為 true；登入按鈕在此之前停用。
  const ready = ref(!firebaseAvailable)
  const canSignIn = firebaseAvailable

  if (firebaseAvailable) {
    void loadFirebase().then(([{ auth }, { onAuthStateChanged }]) => {
      if (!auth) return
      onAuthStateChanged(auth, (u) => {
        user.value = u
        ready.value = true
        // 沒登入的訪客：閒下來時先把登入視窗要用的東西載好（見 warmUp）
        if (!u) whenIdle(warmUp)
      })
    })
  }

  // 登入視窗（signInWithPopup）第一次用時，Firebase 要先下載 Google 的 gapi 與 iframe 才開視窗；
  // 等它下載完，瀏覽器已經不當這是「按了按鈕」，把視窗擋掉（第一次按出現「登入沒有完成」，第二次才開得了；2026-10-12 回報）。
  // Firebase 自己在手機與 Safari 也是先載好（_shouldInitProactively），但那是在判斷登入狀態之前、每次打開都載，
  // 會讓登入狀態晚出來（services/firebase.ts 因此不帶 popupRedirectResolver）。這裡改成：登入狀態確定、沒登入的人閒下來時
  // 先載；滑到、聚焦登入鈕時也載。warmUp 與 signInWithPopup 用同一個 resolver（PopupResolver 只建一份），按下去時已經載好，
  // 視窗在按鈕的事件裡就開出來。
  let warming: Promise<unknown> | null = null
  function warmUp() {
    if (warming || !firebaseAvailable) return
    warming = loadFirebase()
      .then(([{ auth }, { browserPopupRedirectResolver }]) => {
        const r = new (popupResolver(browserPopupRedirectResolver))() as { _initialize?: (a: unknown) => Promise<unknown> }
        return auth && r._initialize ? r._initialize(auth) : null
      })
      .catch(() => (warming = null))
  }

  // 自己關掉登入視窗（或連按兩次）不算失敗；跳出視窗被擋、網路不通等就在底部提示一行（services/toast.ts），
  // 不然按了收藏、清單之後什麼都沒發生。錯誤照樣丟回去，呼叫端自己決定要不要繼續。
  const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'])
  async function signIn() {
    warmUp()
    try {
      const [{ auth, googleProvider }, { browserPopupRedirectResolver, signInWithPopup }] = await loadFirebase()
      if (auth) await signInWithPopup(auth, googleProvider, popupResolver(browserPopupRedirectResolver) as unknown as PopupRedirectResolver)
    } catch (e) {
      const code = (e as { code?: unknown } | null)?.code
      // 視窗被擋：這時已經載好，再按一次就開得了
      if (code === 'auth/popup-blocked') showToast('登入視窗被擋下來，請再按一次登入')
      else if (typeof code !== 'string' || !CANCELLED.has(code)) showToast('登入沒有完成')
      throw e
    }
  }

  async function logOut() {
    const [{ auth }, { signOut }] = await loadFirebase()
    if (auth) await signOut(auth)
  }

  return { user, ready, canSignIn, signIn, logOut, warmUp }
})
