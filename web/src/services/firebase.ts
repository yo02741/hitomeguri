import { initializeApp } from 'firebase/app'
import { type Auth, browserLocalPersistence, connectAuthEmulator, GoogleAuthProvider, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth'

import { firebaseAvailable, firebaseConfig, useEmulators } from './firebaseEnv'

// 只用 Spark 方案內的服務：Auth（Google 登入）與 Firestore。不引入 Functions / Storage。
// 這個模組只在 firebaseAvailable 時以動態 import 載入（見 stores/user.ts）。
// 這裡只有 Auth：沒登入的訪客不下載 Firestore（約 160 KB gzip）；Firestore 在 services/firestoreDb.ts，登入後才載入。
// initializeAuth 不帶 popupRedirectResolver：每次載入不必先下載 Google 的 gapi script 與 iframe，按「登入」時才帶入（stores/user.ts）。
export const firebaseApp = initializeApp(firebaseConfig)
export const auth: Auth | null = firebaseAvailable
  ? initializeAuth(firebaseApp, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })
  : null
export const googleProvider = new GoogleAuthProvider()

if (useEmulators && auth) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })

export { useEmulators }
