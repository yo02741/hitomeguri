import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { auth, googleProvider } from '../services/firebase'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const ready = ref(false)

  onAuthStateChanged(auth, (u) => {
    user.value = u
    ready.value = true
  })

  async function signIn() {
    await signInWithPopup(auth, googleProvider)
  }

  async function logOut() {
    await signOut(auth)
  }

  return { user, ready, signIn, logOut }
})
