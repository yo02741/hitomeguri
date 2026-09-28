import { initializeApp } from 'firebase/app'
import { type Auth, connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import { connectFirestoreEmulator, type Firestore, getFirestore } from 'firebase/firestore'

import { firebaseAvailable, firebaseConfig, useEmulators } from './firebaseEnv'

// 只用 Spark 方案內的服務：Auth（Google 登入）與 Firestore。不引入 Functions / Storage。
// 這個模組只在 firebaseAvailable 時以動態 import 載入（見 stores/user.ts）。
export const firebaseApp = initializeApp(firebaseConfig)
export const auth: Auth | null = firebaseAvailable ? getAuth(firebaseApp) : null
export const db: Firestore | null = firebaseAvailable ? getFirestore(firebaseApp) : null
export const googleProvider = new GoogleAuthProvider()

if (useEmulators && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

export { useEmulators }
