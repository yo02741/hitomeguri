import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

// 只用 Spark 方案內的服務：Auth（Google 登入）與 Firestore。不引入 Functions / Storage。
const env = import.meta.env
const useEmulators = env.VITE_USE_EMULATORS === '1' || (env.DEV && env.VITE_USE_EMULATORS !== '0')

// Emulator 不驗證 apiKey；正式環境由 .env.local / CI secrets 提供。
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || (useEmulators ? 'emulator' : ''),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'hitomeguri.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-hitomeguri',
  appId: env.VITE_FIREBASE_APP_ID || '',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

export { useEmulators }
