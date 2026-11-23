/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string
declare const __BUILD_COMMIT__: string

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_USE_EMULATORS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
