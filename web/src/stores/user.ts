import type { User } from 'firebase/auth'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { firebaseAvailable } from '../services/firebaseEnv'
import { showToast } from '../services/toast'

// Firebase SDK 以動態 import 載入：沒有設定 Firebase 時完全不下載，也不擋住首頁載入。
const loadFirebase = () => Promise.all([import('../services/firebase'), import('firebase/auth')])

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
      })
    })
  }

  // 自己關掉登入視窗（或連按兩次）不算失敗；跳出視窗被擋、網路不通等就在底部提示一行（services/toast.ts），
  // 不然按了收藏、清單之後什麼都沒發生。錯誤照樣丟回去，呼叫端自己決定要不要繼續。
  const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'])
  async function signIn() {
    try {
      const [{ auth, googleProvider }, { browserPopupRedirectResolver, signInWithPopup }] = await loadFirebase()
      if (auth) await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver)
    } catch (e) {
      const code = (e as { code?: unknown } | null)?.code
      if (typeof code !== 'string' || !CANCELLED.has(code)) showToast('登入沒有完成')
      throw e
    }
  }

  async function logOut() {
    const [{ auth }, { signOut }] = await loadFirebase()
    if (auth) await signOut(auth)
  }

  return { user, ready, canSignIn, signIn, logOut }
})
