import type { User } from 'firebase/auth'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { firebaseAvailable } from '../services/firebaseEnv'

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

  async function signIn() {
    const [{ auth, googleProvider }, { browserPopupRedirectResolver, signInWithPopup }] = await loadFirebase()
    if (auth) await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver)
  }

  async function logOut() {
    const [{ auth }, { signOut }] = await loadFirebase()
    if (auth) await signOut(auth)
  }

  return { user, ready, canSignIn, signIn, logOut }
})
