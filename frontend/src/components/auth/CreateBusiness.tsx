'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import { PhoneField, isValidIndianPhone } from '@/components/PhoneField'

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
 * Onboarding (Owner, route `create`): create a new business. A single form with
 * three fields — name (prefilled from the Google displayName, editable), shop
 * name, and mobile (India-only PhoneField, stored as profile data). On submit, if
 * the name was edited we persist it first (setDisplayName) so attribution
 * snapshots the trader's chosen name, then create the business. On success the
 * AuthProvider flips `status` → `ready` and the app renders.
 */
export function CreateBusiness() {
  const { t } = useI18n()
  const { user, setDisplayName, createOwnerBusiness } = useAuth()

  const [name, setName] = useState(user?.displayName ?? '')
  const [shopName, setShopName] = useState('')
  const [mobile, setMobile] = useState('') // canonical E.164 from PhoneField
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const trimmedShop = shopName.trim()
  const mobileValid = isValidIndianPhone(mobile)
  const canSubmit = trimmedName !== '' && trimmedShop !== '' && mobileValid

  async function onCreate() {
    setError(null)
    if (!canSubmit) return
    setSaving(true)
    try {
      // Persist an edited name first so the owner's attribution snapshot uses it.
      if (trimmedName !== (user?.displayName ?? '')) {
        await setDisplayName(trimmedName)
      }
      await createOwnerBusiness({
        shopName: trimmedShop,
        traderName: trimmedName,
        phone: mobile,
      })
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'h-14 w-full rounded-xl border-2 border-stone-300 bg-white px-4 text-lg text-stone-800 outline-none focus:border-green-600'
  const fieldBox = 'h-14 rounded-xl border-2 border-stone-300 bg-white text-lg text-stone-800 focus-within:border-green-600'

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
            {t('onboarding.createBusiness.nameLabel')}
          </span>
          <input
            data-testid="create-name-input"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-600">
            {t('onboarding.createBusiness.shopName')}
          </span>
          <input
            data-testid="create-shop-input"
            className={inputClass}
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-stone-600">
            {t('onboarding.createBusiness.mobile')}
          </span>
          <PhoneField
            testId="create-mobile-input"
            value={mobile}
            onChange={setMobile}
            ariaLabel={t('onboarding.createBusiness.mobile')}
            className={fieldBox}
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
          <p className="text-xs text-stone-500">
            {trimmedName === ''
              ? t('onboarding.createBusiness.nameRequired')
              : trimmedShop === ''
                ? t('onboarding.createBusiness.shopRequired')
                : t('onboarding.createBusiness.mobileRequired')}
          </p>
        )}
      </div>
    </div>
  )
}
