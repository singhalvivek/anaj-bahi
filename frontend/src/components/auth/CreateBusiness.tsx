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
 * Onboarding step 3a (Owner, decision `new`): create a new business. Only the
 * shop name is asked; the trader name defaults to the user's display name. On
 * success the AuthProvider flips `status` → `ready` and the app renders.
 */
export function CreateBusiness() {
  const { t } = useI18n()
  const { user, createOwnerBusiness } = useAuth()

  const [shopName, setShopName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = shopName.trim()
  const canSubmit = trimmed !== ''

  async function onCreate() {
    setError(null)
    if (!canSubmit) return
    setSaving(true)
    try {
      await createOwnerBusiness({
        shopName: trimmed,
        traderName: user?.displayName?.trim() || trimmed,
      })
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      data-testid="create-business"
      className="flex min-h-screen w-full flex-col items-center justify-center px-5 py-10"
    >
      <div className="flex w-full max-w-md flex-col gap-6">
        <h1 className="text-2xl font-bold text-green-800">
          {t('onboarding.createBusiness.title')}
        </h1>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-600">
            {t('onboarding.createBusiness.shopName')}
          </span>
          <input
            data-testid="create-shop-input"
            className="h-14 w-full rounded-xl border-2 border-stone-300 bg-white px-4 text-lg text-stone-800 outline-none focus:border-green-600"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            autoComplete="off"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          data-testid="create-business-submit"
          onClick={onCreate}
          disabled={!canSubmit || saving}
          className="flex min-h-[56px] w-full items-center justify-center rounded-xl bg-green-700 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-green-800"
        >
          {saving
            ? t('onboarding.createBusiness.creating')
            : t('onboarding.createBusiness.create')}
        </button>

        {!canSubmit && (
          <p className="text-xs text-stone-500">{t('onboarding.createBusiness.shopRequired')}</p>
        )}
      </div>
    </div>
  )
}
