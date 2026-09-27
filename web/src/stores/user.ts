import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { auth, firebaseAvailable, googleProvider } from '../services/firebase'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  // Auth 狀態已確定（或 Firebase 未設定）時為 true；登入按鈕在此之前停用。
  const ready = ref(!firebaseAvailable)
  const canSignIn = firebaseAvailable

  if (auth) {
    onAuthStateChanged(auth, (u) => {
      user.value = u
      ready.value = true
    })
  }

  async function signIn() {
    if (!auth) return
    await signInWithPopup(auth, googleProvider)
  }

  async function logOut() {
    if (!auth) return
    await signOut(auth)
  }

  return { user, ready, canSignIn, signIn, logOut }
})
