// Firebase 設定（不 import firebase SDK）：讓沒有設定 Firebase 的部署完全不下載 SDK。
const env = import.meta.env
export const useEmulators = env.VITE_USE_EMULATORS === '1' || (env.DEV && env.VITE_USE_EMULATORS !== '0')

// Emulator 不驗證 apiKey；正式環境由 .env.local / CI variables 提供。
const apiKey = env.VITE_FIREBASE_API_KEY || (useEmulators ? 'emulator' : '')

export const firebaseConfig = {
  apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'hitomeguri.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-hitomeguri',
  appId: env.VITE_FIREBASE_APP_ID || '',
}

// 沒有 apiKey（例如尚未設定 Firebase 專案的靜態部署）時，不初始化 Auth / Firestore；
// 探索頁照常可用，登入按鈕停用。
export const firebaseAvailable = apiKey !== ''
