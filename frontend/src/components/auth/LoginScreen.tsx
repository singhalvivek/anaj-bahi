'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'

/**
 * Full-screen Google sign-in (shown by the AuthGate when `status === 'signed-out'`).
 *
 * A single primary "Continue with Google" button → `signInWithGoogle()`
 * (`signInWithPopup(GoogleAuthProvider)`). There is NO phone field, NO OTP input
 * and NO reCAPTCHA container anywhere — Google is the only sign-in factor. Popup
 * failures (popup closed / network / unauthorized-domain) surface as an inline,
 * bilingual, retryable error; the button stays tappable.
 *
 * i18n: keys live in slice-a's shipped dictionary under `auth.*`.
 */

/** Pull a translatable i18n key off an AuthError, else a generic fallback. */
function errorKey(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'messageKey' in err &&
    typeof (err as { messageKey: unknown }).messageKey === 'string'
  ) {
    return (err as { messageKey: string }).messageKey
  }
  return 'auth.error.generic'
}

export function LoginScreen() {
  const { t, setLang, lang } = useI18n()
  const { signInWithGoogle } = useAuth()

  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSignIn() {
    setError(null)
    setSigningIn(true)
    try {
      // On success the AuthProvider's auth listener loads/creates users/{uid} and
      // flips `status` → onboarding|ready, so the AuthGate unmounts this screen.
      await signInWithGoogle()
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setSigningIn(false)
    }
  }

  const primaryBtn =
    'flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl bg-green-700 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-green-800'

  return (
    <div
      data-testid="auth-login"
      className="flex min-h-screen w-full flex-col items-center justify-center px-5 py-10"
    >
      <div className="flex w-full max-w-md flex-col gap-6">
        {/* Language toggle so a first-time user can pick Hindi/English up front. */}
        <div className="flex justify-end">
          <div
            role="group"
            aria-label={t('lang.toggle')}
            className="flex h-11 items-center overflow-hidden rounded-full border-2 border-stone-300 bg-white text-sm font-semibold"
          >
            <button
              type="button"
              aria-pressed={lang === 'hi'}
              onClick={() => setLang('hi')}
              className={`h-full min-w-[48px] px-3 transition-colors ${
                lang === 'hi' ? 'bg-green-700 text-white' : 'text-stone-600'
              }`}
            >
              {t('lang.hi')}
            </button>
            <button
              type="button"
              aria-pressed={lang === 'en'}
              onClick={() => setLang('en')}
              className={`h-full min-w-[48px] px-3 transition-colors ${
                lang === 'en' ? 'bg-green-700 text-white' : 'text-stone-600'
              }`}
            >
              {t('lang.en')}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-green-800">{t('app.title')}</h1>
          <p className="text-base text-stone-600">{t('auth.login.title')}</p>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          data-testid="login-google"
          onClick={onSignIn}
          disabled={signingIn}
          className={primaryBtn}
        >
          {signingIn ? t('auth.google.signingIn') : t('auth.google.button')}
        </button>
      </div>
    </div>
  )
}
