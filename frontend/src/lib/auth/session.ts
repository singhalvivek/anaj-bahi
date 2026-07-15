// Thin, non-React wrappers over firebase/auth for Anaj Bahi Google sign-in.
// The React surface (AuthProvider / useAuth) is in ./context.tsx.
//
// Contract: architecture.md § Auth / session contract — lib/auth.
//
// Google sign-in (GoogleAuthProvider + signInWithPopup) with LOCAL persistence.
// Identity is the Firebase `uid` (stable per Google account, same on every device).
// There is NO phone/SMS factor and NO reCAPTCHA anywhere — all removed.

import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase/app'

export interface AppUser {
  uid: string
  email: string | null // from Google; stored on users/{uid}
  phone: string | null // E.164, captured at onboarding — PROFILE DATA, not an auth factor
  displayName: string | null
  bizId: string | null
  role: 'owner' | 'partner' | 'employee' | null
}

/**
 * A translatable auth failure. `messageKey` is an i18n key (see dictionary.ts
 * `auth.error.*`) the UI passes to `t(...)`, so errors render bilingually.
 */
export class AuthError extends Error {
  readonly code: string
  readonly messageKey: string
  constructor(code: string, messageKey: string) {
    super(messageKey)
    this.name = 'AuthError'
    this.code = code
    this.messageKey = messageKey
  }
}

const AUTH_ERROR_KEYS: Record<string, string> = {
  // The user dismissed / cancelled the Google popup — a benign, retryable action.
  'auth/popup-closed-by-user': 'auth.error.popupClosed',
  'auth/cancelled-popup-request': 'auth.error.popupClosed',
  // The web app's domain is not in the Firebase project's Authorized domains list.
  'auth/unauthorized-domain': 'auth.error.unauthorizedDomain',
  'auth/network-request-failed': 'auth.error.network',
}

/** Map any thrown Firebase Auth error to a translatable `AuthError`. */
export function mapAuthError(err: unknown): AuthError {
  if (err instanceof AuthError) return err
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  return new AuthError(code, AUTH_ERROR_KEYS[code] ?? 'auth.error.generic')
}

/**
 * Sign in with Google via a popup, using LOCAL persistence (set at init in
 * lib/firebase/app.ts) so the session survives reloads. Throws a mapped,
 * translatable `AuthError` on failure (popup closed / network / unauthorized
 * domain / generic). Under the Auth emulator the popup is the emulator's built-in
 * test-IdP page, so E2E is deterministic with no real Google account.
 */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, provider)
    // The onFirebaseAuthChange listener now loads/creates users/{uid} and
    // transitions status (onboarding | ready).
  } catch (err) {
    throw mapAuthError(err)
  }
}

/** Sign the current user out (clears the LOCAL-persisted session). */
export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

/**
 * Subscribe to Firebase auth state. `cb` receives the Google identity fields
 * `{ uid, email, displayName }` on sign-in and `null` on sign-out. Returns an
 * unsubscribe function.
 */
export function onFirebaseAuthChange(
  cb: (u: { uid: string; email: string | null; displayName: string | null } | null) => void,
): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cb(null)
      return
    }
    cb({ uid: user.uid, email: user.email ?? null, displayName: user.displayName ?? null })
  })
}
