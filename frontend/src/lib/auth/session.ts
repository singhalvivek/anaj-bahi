// Thin, non-React wrappers over firebase/auth for Anaj Bahi phone sign-in.
// The React surface (AuthProvider / useAuth) is in ./context.tsx.
//
// Contract: architecture.md § Auth / session contract — lib/auth.

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '@/lib/firebase/app'

/** The id of the `<div>` where slice-b mounts the invisible reCAPTCHA. */
export const RECAPTCHA_CONTAINER_ID = 'recaptcha-container'

export interface AppUser {
  uid: string
  phone: string // E.164
  displayName: string | null
  bizId: string | null
  role: 'owner' | 'employee' | null
}

/** Wraps a Firebase `ConfirmationResult` so callers verify without touching the SDK. */
export interface ConfirmationHandle {
  confirm(code: string): Promise<void>
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
  'auth/invalid-phone-number': 'auth.error.invalidPhone',
  'auth/missing-phone-number': 'auth.error.invalidPhone',
  'auth/invalid-verification-code': 'auth.error.invalidOtp',
  'auth/code-expired': 'auth.error.invalidOtp',
  'auth/missing-verification-code': 'auth.error.invalidOtp',
  'auth/too-many-requests': 'auth.error.tooManyRequests',
  'auth/quota-exceeded': 'auth.error.tooManyRequests',
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
 * Send an SMS OTP to `phoneE164`, mounting an invisible reCAPTCHA in the element
 * with id `recaptchaContainerId`. Returns a handle whose `confirm(code)` verifies
 * the OTP. For a Firebase **test phone number** the verifier is still constructed
 * but never challenged (no SMS, no reCAPTCHA prompt). Throws a mapped `AuthError`.
 */
export async function startPhoneSignIn(
  phoneE164: string,
  recaptchaContainerId: string,
): Promise<ConfirmationHandle> {
  let verifier: RecaptchaVerifier
  try {
    verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' })
  } catch (err) {
    throw mapAuthError(err)
  }
  try {
    const result = await signInWithPhoneNumber(auth, phoneE164, verifier)
    return {
      async confirm(code: string): Promise<void> {
        try {
          await result.confirm(code)
        } catch (err) {
          throw mapAuthError(err)
        }
      },
    }
  } catch (err) {
    // Free the reCAPTCHA widget so a retry can re-mount cleanly.
    try {
      verifier.clear()
    } catch {
      // ignore — clearing is best-effort
    }
    throw mapAuthError(err)
  }
}

/** Sign the current user out (clears the LOCAL-persisted session). */
export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

/**
 * Subscribe to Firebase auth state. `cb` receives `(uid, phone)` on sign-in
 * and `(null, null)` on sign-out. Returns an unsubscribe function.
 */
export function onFirebaseAuthChange(
  cb: (uid: string | null, phone: string | null) => void,
): () => void {
  return onAuthStateChanged(auth, (user) => {
    cb(user?.uid ?? null, user?.phoneNumber ?? null)
  })
}
