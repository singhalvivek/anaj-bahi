// Firebase Web SDK singletons for Anaj Bahi (Phase 6+ — Google sign-in).
//
// Initializes the app from the 6 PUBLIC `NEXT_PUBLIC_FIREBASE_*` values (these are
// build-time-inlined web config, NOT secrets — real security is Firestore Rules).
//
// SSR / static-export safety: the app is `output: 'export'`, so `pnpm build`
// prerenders pages in Node where there is no `window`/IndexedDB. Auth LOCAL
// persistence and Firestore `persistentLocalCache` are therefore applied ONLY in
// the browser; on the server we fall back to a plain instance so the build never
// crashes. All real usage happens client-side.
//
// Emulators (E2E / optional dev): when NEXT_PUBLIC_FIREBASE_USE_EMULATORS is on
// and we are in the browser, Auth and Firestore are pointed at the local Firebase
// emulators (Auth 9099, Firestore 8080) so tests run deterministically with no
// real Google account and no external network. Google sign-in is simulated by the
// Auth emulator's built-in test-IdP popup. No reCAPTCHA / SMS / service-account.

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  type Auth,
} from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  connectFirestoreEmulator,
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

// Connect to the local emulators when the flag is on. Accept `'true'` (the
// .env.example default form) or `'1'` (the shorthand used by the Playwright
// webServer), so both dev and E2E wiring resolve the same way.
const useEmulators =
  isBrowser &&
  (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === 'true' ||
    process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === '1')

// Single app instance across HMR / multiple imports.
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(readConfig())

function makeAuth(): Auth {
  if (!isBrowser) return getAuth(app)
  // Set LOCAL persistence synchronously at init so the session survives reloads.
  // `initializeAuth` throws if auth was already initialized (HMR) — fall back.
  let instance: Auth
  try {
    // `popupRedirectResolver` is REQUIRED for signInWithPopup to work: unlike
    // getAuth (which registers it by default), initializeAuth only wires a popup/
    // redirect resolver when one is passed here. Without it signInWithPopup rejects
    // with `auth/argument-error` before a popup ever opens — in production AND under
    // the emulator. (browserPopupRedirectResolver is DOM-only, so this branch is
    // browser-only; the SSR/build path above uses getAuth.)
    instance = initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    instance = getAuth(app)
  }
  if (useEmulators) {
    // Idempotent-safe: connecting an already-connected emulator is a no-op; wrap
    // to survive HMR re-runs. Google sign-in resolves through the Auth emulator's
    // test-IdP popup — no reCAPTCHA, no SMS.
    try {
      connectAuthEmulator(instance, 'http://127.0.0.1:9099', { disableWarnings: true })
    } catch {
      // already connected — ignore
    }
  }
  return instance
}

function makeFirestore(): Firestore {
  if (useEmulators) {
    // E2E path: no persistent offline cache (deterministic reads straight from the
    // emulator, cleared before each run), then point at the Firestore emulator.
    let db: Firestore
    try {
      db = initializeFirestore(app, { ignoreUndefinedProperties: true })
    } catch {
      db = getFirestore(app)
    }
    try {
      connectFirestoreEmulator(db, '127.0.0.1', 8080)
    } catch {
      // already connected — ignore
    }
    return db
  }
  // In the (real) browser, IndexedDB offline persistence IS the store. On the
  // server (build prerender) use a plain instance — never touched at runtime.
  try {
    return initializeFirestore(
      app,
      isBrowser
        ? {
            // Firestore rejects `undefined` field values by default; the Bill/Farmer
            // shapes carry optional fields (dueDate, note, phone, summary) that are
            // often undefined. Silently drop them instead of throwing on every write.
            ignoreUndefinedProperties: true,
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
          }
        : { ignoreUndefinedProperties: true },
    )
  } catch {
    // `initializeFirestore` throws if already called for this app (HMR) — reuse it.
    return getFirestore(app)
  }
}

export const auth: Auth = makeAuth()
export const firestore: Firestore = makeFirestore()
