'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'

/**
 * Full-screen phone + SMS-OTP login (shown by the AuthGate when
 * `status === 'signed-out'`). Two internal phases: enter phone → enter OTP.
 *
 * The phone is captured/submitted in E.164 (default prefill `+91`). The invisible
 * reCAPTCHA target (`#recaptcha-container`) is mounted by the AuthProvider — this
 * component deliberately does NOT render its own.
 *
 * i18n: keys live in slice-a's shipped dictionary under `auth.*`.
 */

/** Accepts an E.164 number: leading `+` then 8–15 digits. */
function isValidE164(value: string): boolean {
  return /^\+\d{8,15}$/.test(value.trim())
}

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
  const { startPhoneSignIn, confirmOtp } = useAuth()

  const [phase, setPhase] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('+91')
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedPhone = phone.trim()

  async function onSendCode() {
    setError(null)
    if (!isValidE164(trimmedPhone)) {
      setError(t('auth.error.invalidPhone'))
      return
    }
    setSending(true)
    try {
      await startPhoneSignIn(trimmedPhone)
      setPhase('otp')
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setSending(false)
    }
  }

  async function onVerify() {
    setError(null)
    const code = otp.replace(/\D/g, '')
    if (code.length !== 6) {
      setError(t('auth.error.invalidOtp'))
      return
    }
    setVerifying(true)
    try {
      // On success the AuthProvider flips `status` → onboarding|ready and the
      // AuthGate unmounts this screen; nothing more to do here.
      await confirmOtp(code)
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setVerifying(false)
    }
  }

  function changeNumber() {
    setPhase('phone')
    setOtp('')
    setError(null)
  }

  const inputClass =
    'h-14 w-full rounded-xl border-2 border-stone-300 bg-white px-4 text-lg text-stone-800 outline-none focus:border-green-600'
  const primaryBtn =
    'flex min-h-[56px] w-full items-center justify-center rounded-xl bg-green-700 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-green-800'

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

        {phase === 'phone' ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-600">{t('auth.phone.label')}</span>
              <input
                data-testid="login-phone-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.phone.placeholder')}
                className={inputClass}
              />
            </label>

            {error && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              data-testid="login-send-code"
              onClick={onSendCode}
              disabled={sending}
              className={primaryBtn}
            >
              {sending ? t('auth.sending') : t('auth.sendCode')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-stone-500">
              <span className="font-semibold text-stone-700">{trimmedPhone}</span>
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-600">{t('auth.otp.label')}</span>
              <input
                data-testid="login-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('auth.otp.placeholder')}
                className={`${inputClass} tracking-[0.4em]`}
              />
            </label>

            {error && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              data-testid="login-verify"
              onClick={onVerify}
              disabled={verifying}
              className={primaryBtn}
            >
              {verifying ? t('auth.verifying') : t('auth.verify')}
            </button>

            <button
              type="button"
              onClick={changeNumber}
              className="text-sm font-medium text-green-700 underline underline-offset-2"
            >
              {t('auth.changeNumber')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
