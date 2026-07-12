'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'

/**
 * Onboarding step 3b (Employee, decision `employee-unadded`): the phone is not
 * yet on any owner's roster. This is an INTENTIONAL, calm, helpful screen — NOT
 * an error — telling the user to have their owner add the phone number shown,
 * then a Sign out button. (Owner-adds-employee round-trips fully in Phase 8.)
 */
export function AskOwner() {
  const { t } = useI18n()
  const { user, signOut } = useAuth()

  const [signingOut, setSigningOut] = useState(false)

  async function onSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      // Even if sign-out rejects, keep the screen usable; nothing to surface.
      setSigningOut(false)
    }
  }

  return (
    <div
      data-testid="ask-owner"
      className="flex min-h-screen w-full flex-col items-center justify-center px-5 py-10"
    >
      <div className="flex w-full max-w-md flex-col gap-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl" aria-hidden>
            👋
          </span>
          <h1 className="text-2xl font-bold text-green-800">{t('onboarding.askOwner.title')}</h1>
          <p className="text-base text-stone-600">{t('onboarding.askOwner.explain')}</p>
        </div>

        {/* The user's own number, prominent so they can read it out to the owner. */}
        <div className="flex flex-col gap-1 rounded-2xl border-2 border-dashed border-green-300 bg-green-50 px-5 py-5">
          <span className="text-sm font-medium text-stone-500">
            {t('onboarding.askOwner.yourPhone')}
          </span>
          <span className="text-2xl font-bold tracking-wide text-green-800">
            {user?.phone ?? '—'}
          </span>
        </div>

        <button
          type="button"
          data-testid="ask-owner-signout"
          onClick={onSignOut}
          disabled={signingOut}
          className="flex min-h-[56px] w-full items-center justify-center rounded-xl border-2 border-stone-300 bg-white text-lg font-semibold text-stone-700 transition-colors disabled:opacity-60 active:bg-stone-100"
        >
          {t('onboarding.askOwner.signOut')}
        </button>
      </div>
    </div>
  )
}
