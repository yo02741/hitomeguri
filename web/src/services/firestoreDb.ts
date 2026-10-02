import { connectFirestoreEmulator, type Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

import { firebaseApp } from './firebase'
import { firebaseAvailable, useEmulators } from './firebaseEnv'

// Firestore：登入後才由 services/userdb.ts 動態載入（沒登入不下載）。
// 離線：收藏、去過、行程存在本機（IndexedDB），沒有網路也看得到；離線時的修改連上網後自動送出
export const db: Firestore | null = firebaseAvailable
  ? initializeFirestore(firebaseApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  : null

if (useEmulators && db) connectFirestoreEmulator(db, '127.0.0.1', 8080)
