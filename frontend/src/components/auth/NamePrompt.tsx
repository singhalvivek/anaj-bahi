'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'

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

/**
 * Onboarding step 1: capture the user's display name (a phone carries no name).
 * Continue is disabled until non-blank. On success the AuthProvider updates
 * `user.displayName`, and OnboardingFlow advances to the role chooser.
 */
export function NamePrompt() {
  const { t } = useI18n()
  const { setDisplayName } = useAuth()

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim()

  async function onContinue() {
    if (!trimmed) return
    setError(null)
    setSaving(true)
    try {
      await setDisplayName(trimmed)
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      data-testid="onboarding-name"
      className="flex min-h-screen w-full flex-col items-center justify-center px-5 py-10"
    >
      <div className="flex w-full max-w-md flex-col gap-6">
        <h1 className="text-2xl font-bold text-green-800">{t('onboarding.name.title')}</h1>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-600">{t('onboarding.name.label')}</span>
          <input
            data-testid="name-input"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-14 w-full rounded-xl border-2 border-stone-300 bg-white px-4 text-lg text-stone-800 outline-none focus:border-green-600"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          data-testid="name-continue"
          onClick={onContinue}
          disabled={!trimmed || saving}
          className="flex min-h-[56px] w-full items-center justify-center rounded-xl bg-green-700 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-green-800"
        >
          {t('onboarding.name.continue')}
        </button>
      </div>
    </div>
  )
}
