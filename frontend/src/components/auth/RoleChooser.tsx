'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import type { MembershipDecision } from '@/lib/auth/membership'

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
   * Called after `chooseRole` resolves, lifting the MembershipDecision to the
   * parent (OnboardingFlow). For `'owner'` / `'employee-joined'` the AuthProvider
   * has already flipped status to `ready`, so the parent unmounts — passing the
   * decision up is harmless. For `'new'` / `'employee-unadded'` the parent shows
   * the next sub-screen.
   */
  onDecision: (decision: MembershipDecision) => void
}

/**
 * Onboarding step 2: pick Owner or Employee. Runs the pure membership decision
 * (via `chooseRole`) which — critically — lets an EXISTING membership win over
 * the fresh choice (one-person-one-business).
 */
export function RoleChooser({ onDecision }: RoleChooserProps) {
  const { t } = useI18n()
  const { chooseRole } = useAuth()

  const [busy, setBusy] = useState<'owner' | 'employee' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(role: 'owner' | 'employee') {
    if (busy) return
    setError(null)
    setBusy(role)
    try {
      const decision = await chooseRole(role)
      onDecision(decision)
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
            data-testid="role-owner"
            onClick={() => pick('owner')}
            disabled={busy !== null}
            className={cardClass}
          >
            {t('onboarding.role.owner')}
          </button>

          <button
            type="button"
            data-testid="role-employee"
            onClick={() => pick('employee')}
            disabled={busy !== null}
            className={cardClass}
          >
            {t('onboarding.role.employee')}
          </button>
        </div>
      </div>
    </div>
  )
}
