// Firebase Web SDK singletons for Anaj Bahi (Phase 6+).
//
// Initializes the app from the 6 PUBLIC `NEXT_PUBLIC_FIREBASE_*` values (these are
// build-time-inlined web config, NOT secrets — real security is Firestore Rules).
//
// SSR / static-export safety: the app is `output: 'export'`, so `pnpm build`
// prerenders pages in Node where there is no `window`/IndexedDB. Auth LOCAL
// persistence and Firestore `persistentLocalCache` are therefore applied ONLY in
// the browser; on the server we fall back to a plain instance so the build never
// crashes. All real usage happens client-side.

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

/** Read + validate the public web config; throws a clear error if a var is missing. */
function readConfig(): FirebaseWebConfig {
  const raw = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  const missing = Object.entries(raw)
    .filter(([, v]) => !v)
    .map(([k]) => `NEXT_PUBLIC_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`)
  if (missing.length > 0) {
    throw new Error(
      `Firebase web config is incomplete — missing ${missing.join(', ')}. ` +
        'Set the NEXT_PUBLIC_FIREBASE_* values in frontend/.env.local (see .env.example).',
    )
  }
  return raw as FirebaseWebConfig
}

const isBrowser = typeof window !== 'undefined'

// Single app instance across HMR / multiple imports.
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(readConfig())

function makeAuth(): Auth {
  if (!isBrowser) return getAuth(app)
  // Set LOCAL persistence synchronously at init so the session survives reloads.
  // `initializeAuth` throws if auth was already initialized (HMR) — fall back.
  let instance: Auth
  try {
    instance = initializeAuth(app, { persistence: browserLocalPersistence })
  } catch {
    instance = getAuth(app)
  }
  // On localhost (local dev + Playwright E2E) disable reCAPTCHA app verification so
  // Firebase **test phone numbers** resolve instantly without a reCAPTCHA challenge —
  // an automated/headless browser can never complete invisible reCAPTCHA, so
  // signInWithPhoneNumber would otherwise hang. Scoped to localhost ONLY: the
  // deployed GitHub Pages domain keeps full reCAPTCHA protection for real users.
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    instance.settings.appVerificationDisabledForTesting = true
  }
  return instance
}

function makeFirestore(): Firestore {
  // In the browser, IndexedDB offline persistence IS the store. On the server
  // (build prerender) use a plain instance — no persistence, never touched at runtime.
  try {
    return initializeFirestore(
      app,
      isBrowser
        ? { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }
        : {},
    )
  } catch {
    // `initializeFirestore` throws if already called for this app (HMR) — reuse it.
    return getFirestore(app)
  }
}

export const auth: Auth = makeAuth()
export const firestore: Firestore = makeFirestore()
