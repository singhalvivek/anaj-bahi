'use client'

import { useEffect, useState, type ReactNode, type FormEvent } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { isPinSet, setPin, verifyPin, resetPin } from '@/lib/auth/pin'

/**
 * App-wide access gate. Wraps the page content so every route is locked until the
 * correct 4-digit PIN is entered.
 *
 *  - First run (no PIN set) → set + confirm a PIN, then unlock.
 *  - PIN set, not yet unlocked → unlock screen (verify PIN); a "forgot PIN" escape
 *    resets the PIN (data untouched, per data.md) and returns to first-run setup.
 *  - Unlocked → render {children}.
 *
 * The unlocked flag is IN-MEMORY React state living in the layout, so it survives
 * client-side navigation but a full reload/return re-locks the app (re-shows the
 * unlock screen) — the PIN itself is the only thing persisted (hashed, in Dexie).
 */
export function PinGate({ children }: { children: ReactNode }) {
  const { t } = useI18n()

  // undefined → still checking; true/false → whether a PIN exists.
  const [pinExists, setPinExists] = useState<boolean | undefined>(undefined)
  const [unlocked, setUnlocked] = useState(false)

  // Setup form
  const [setupPin, setSetupPin] = useState('')
  const [setupConfirm, setSetupConfirm] = useState('')
  const [setupError, setSetupError] = useState('')

  // Unlock form
  const [unlockPin, setUnlockPin] = useState('')
  const [unlockError, setUnlockError] = useState('')

  useEffect(() => {
    let cancelled = false
    isPinSet()
      .then((exists) => {
        if (!cancelled) setPinExists(exists)
      })
      .catch(() => {
        // If storage can't be read, treat as first-run setup rather than crashing.
        if (!cancelled) setPinExists(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Keep only digits, max 4 — numeric-only PIN entry.
  const onlyDigits = (raw: string): string => raw.replace(/\D/g, '').slice(0, 4)

  async function handleSetup(e: FormEvent) {
    e.preventDefault()
    setSetupError('')
    if (setupPin.length !== 4) {
      setSetupError(t('pin.hint'))
      return
    }
    if (setupPin !== setupConfirm) {
      setSetupError(t('pin.mismatch'))
      return
    }
    try {
      await setPin(setupPin)
      setSetupPin('')
      setSetupConfirm('')
      setUnlocked(true)
      setPinExists(true)
    } catch {
      setSetupError(t('pin.hint'))
    }
  }

  async function handleUnlock(e: FormEvent) {
    e.preventDefault()
    setUnlockError('')
    const ok = await verifyPin(unlockPin)
    if (ok) {
      setUnlockPin('')
      setUnlocked(true)
    } else {
      setUnlockError(t('pin.wrong'))
    }
  }

  async function handleForgot() {
    if (typeof window !== 'undefined' && !window.confirm(t('pin.resetWarn'))) return
    await resetPin()
    setUnlockPin('')
    setUnlockError('')
    setPinExists(false)
  }

  // Still checking storage — brief neutral placeholder (IndexedDB reads are instant).
  if (pinExists === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="h-10 w-10 animate-pulse rounded-full bg-stone-200" aria-hidden />
      </div>
    )
  }

  if (unlocked) return <>{children}</>

  const inputClass =
    'h-14 w-full rounded-xl border border-stone-300 bg-white px-4 text-center text-2xl tracking-[0.5em] focus:border-green-600 focus:outline-none'
  const buttonClass =
    'h-14 w-full rounded-xl bg-green-700 text-lg font-semibold text-white shadow active:bg-green-800 disabled:opacity-50'

  // First-run: set + confirm a PIN.
  if (!pinExists) {
    return (
      <div
        data-testid="lock-screen"
        className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-5xl" aria-hidden>
            🔒
          </span>
          <h2 className="text-xl font-bold text-stone-800">{t('pin.setTitle')}</h2>
          <p className="text-sm text-stone-500">{t('pin.hint')}</p>
        </div>
        <form onSubmit={handleSetup} className="flex w-full max-w-xs flex-col gap-4">
          <input
            data-testid="pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label={t('pin.setTitle')}
            value={setupPin}
            onChange={(e) => setSetupPin(onlyDigits(e.target.value))}
            className={inputClass}
          />
          <input
            data-testid="pin-confirm"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label={t('pin.confirmTitle')}
            placeholder={t('pin.confirmTitle')}
            value={setupConfirm}
            onChange={(e) => setSetupConfirm(onlyDigits(e.target.value))}
            className={inputClass}
          />
          {setupError ? (
            <p data-testid="pin-error" className="text-center text-sm font-medium text-red-600">
              {setupError}
            </p>
          ) : null}
          <button data-testid="pin-submit" type="submit" className={buttonClass}>
            {t('pin.set')}
          </button>
        </form>
      </div>
    )
  }

  // PIN set, locked: unlock screen.
  return (
    <div
      data-testid="lock-screen"
      className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-5xl" aria-hidden>
          🔒
        </span>
        <h2 className="text-xl font-bold text-stone-800">{t('pin.enterTitle')}</h2>
      </div>
      <form onSubmit={handleUnlock} className="flex w-full max-w-xs flex-col gap-4">
        <input
          data-testid="pin-unlock"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          aria-label={t('pin.enterTitle')}
          value={unlockPin}
          onChange={(e) => setUnlockPin(onlyDigits(e.target.value))}
          className={inputClass}
        />
        {unlockError ? (
          <p data-testid="pin-error" className="text-center text-sm font-medium text-red-600">
            {unlockError}
          </p>
        ) : null}
        <button data-testid="pin-unlock-submit" type="submit" className={buttonClass}>
          {t('pin.unlock')}
        </button>
        <button
          data-testid="pin-forgot"
          type="button"
          onClick={handleForgot}
          className="h-11 text-sm font-medium text-stone-500 underline underline-offset-2 active:text-stone-700"
        >
          {t('pin.forgot')}
        </button>
      </form>
    </div>
  )
}
