import { watch } from 'vue'

import type { useUserStore } from '../stores/user'

// 使用者資料（Firestore users/{uid}/**）的共用工具：收藏、清單（stores/marks.ts）、行程（stores/trips.ts）。

type Firestore = typeof import('firebase/firestore')

/** Firestore SDK 與資料庫（動態載入：沒登入不下載） */
export async function firestore(): Promise<{ fs: Firestore; db: import('firebase/firestore').Firestore }> {
  const [{ db }, fs] = await Promise.all([import('./firebase'), import('firebase/firestore')])
  if (!db) throw new Error('Firebase 未設定')
  return { fs, db }
}

/** 等到 cond 成立（最多 ms 毫秒） */
export function waitFor(cond: () => boolean, ms = 10000): Promise<void> {
  if (cond()) return Promise.resolve()
  return new Promise((resolve) => {
    const stop = watch(cond, (ok) => {
      if (ok) done()
    })
    const timer = setTimeout(done, ms)
    function done() {
      stop()
      clearTimeout(timer)
      resolve()
    }
  })
}

/** 未登入時先登入（UX-FLOW.md B4）；回傳 uid，取消登入或無法登入時為 undefined */
export async function ensureSignedIn(userStore: ReturnType<typeof useUserStore>): Promise<string | undefined> {
  if (!userStore.user) {
    if (!userStore.canSignIn) return undefined
    try {
      await userStore.signIn()
    } catch {
      return undefined
    }
    await waitFor(() => Boolean(userStore.user))
  }
  return userStore.user?.uid
}

/** YYYY-MM-DD 的今天（使用者的時區） */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
