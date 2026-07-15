'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import type { RoleRoute } from '@/lib/auth/membership'

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

interface RoleChooserProps {
  /**
   * Called after `chooseOnboardingPath` resolves, lifting the pure RoleRoute to the
   * parent (OnboardingFlow): `{ kind:'create' }` (New business → CreateBusiness) or
   * `{ kind:'join' }` (Business already registered → JoinByCode).
   */
  onDecision: (route: RoleRoute) => void
}

/**
 * Onboarding-path step — ROLE-FREE. Two choices: 'New business' (create path, the
 * creator becomes owner) or 'Business already registered' (join path, the joiner's
 * role — employee or partner — comes from the invite). `chooseOnboardingPath` is a
 * pure local route (no phone→business lookup); one-person-one-business is enforced
 * upstream. The words owner/partner/employee appear NOWHERE in onboarding.
 */
export function RoleChooser({ onDecision }: RoleChooserProps) {
  const { t } = useI18n()
  const { chooseOnboardingPath } = useAuth()

  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(choice: 'create' | 'join') {
    if (busy) return
    setError(null)
    setBusy(choice)
    try {
      const route = await chooseOnboardingPath(choice)
      onDecision(route)
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(null)
    }
  }

  const cardClass =
    'flex min-h-[96px] w-full items-center justify-center rounded-2xl border-2 border-stone-300 bg-white px-5 py-4 text-center text-xl font-semibold text-stone-800 transition-colors disabled:opacity-60 active:border-green-600 active:bg-green-50'

  return (
    <div
      data-testid="role-chooser"
      className="flex min-h-screen w-full flex-col items-center justify-center px-5 py-10"
    >
      <div className="flex w-full max-w-md flex-col gap-6">
        <h1 className="text-2xl font-bold text-green-800">{t('onboarding.role.title')}</h1>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-4">
          <button
            type="button"
            data-testid="choose-new-business"
            onClick={() => pick('create')}
            disabled={busy !== null}
            className={cardClass}
          >
            {t('onboarding.path.newBusiness')}
          </button>

          <button
            type="button"
            data-testid="choose-existing-business"
            onClick={() => pick('join')}
            disabled={busy !== null}
            className={cardClass}
          >
            {t('onboarding.path.existingBusiness')}
          </button>
        </div>
      </div>
    </div>
  )
}
