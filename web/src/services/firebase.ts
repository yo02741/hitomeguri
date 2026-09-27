import { initializeApp } from 'firebase/app'
import { type Auth, connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import { connectFirestoreEmulator, type Firestore, getFirestore } from 'firebase/firestore'

// 只用 Spark 方案內的服務：Auth（Google 登入）與 Firestore。不引入 Functions / Storage。
const env = import.meta.env
const useEmulators = env.VITE_USE_EMULATORS === '1' || (env.DEV && env.VITE_USE_EMULATORS !== '0')

// Emulator 不驗證 apiKey；正式環境由 .env.local / CI variables 提供。
const apiKey = env.VITE_FIREBASE_API_KEY || (useEmulators ? 'emulator' : '')

const firebaseConfig = {
  apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'hitomeguri.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-hitomeguri',
  appId: env.VITE_FIREBASE_APP_ID || '',
}

// 沒有 apiKey（例如尚未設定 Firebase 專案的靜態部署）時，不初始化 Auth / Firestore；
// 探索頁照常可用，登入按鈕停用。
export const firebaseAvailable = apiKey !== ''

export const firebaseApp = initializeApp(firebaseConfig)
export const auth: Auth | null = firebaseAvailable ? getAuth(firebaseApp) : null
export const db: Firestore | null = firebaseAvailable ? getFirestore(firebaseApp) : null
export const googleProvider = new GoogleAuthProvider()

if (useEmulators && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

export { useEmulators }
