'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { ComingSoon } from '@/components/ComingSoon'
import {
  getProfile,
  saveProfile,
  DEFAULT_PROFILE,
  type BusinessProfile,
} from '@/lib/settings/profile'

export default function SettingsPage() {
  const { t } = useI18n()
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_PROFILE)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    getProfile()
      .then((p) => {
        if (active) {
          setProfile(p)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (active) {
          setError(true)
          setLoaded(true)
        }
      })
    return () => {
      active = false
    }
  }, [])

  function update(field: keyof BusinessProfile, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function onSave() {
    setSaving(true)
    setSaved(false)
    setError(false)
    try {
      await saveProfile(profile)
      // Reflect the normalised (trimmed, default-filled) value back into the form.
      const fresh = await getProfile()
      setProfile(fresh)
      setSaved(true)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-base text-stone-800 outline-none focus:border-emerald-500'
  const labelClass = 'text-sm font-medium text-stone-600'

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8">
      <h2 className="text-2xl font-semibold text-stone-800">{t('settings.title')}</h2>

      {/* Business profile — the real Phase-3 form */}
      <section
        data-testid="business-profile"
        className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-stone-800">{t('settings.business')}</h3>
          <p className="text-sm text-stone-500">{t('settings.businessHint')}</p>
        </div>

        {error && (
          <p role="alert" data-testid="settings-error" className="text-sm font-medium text-red-600">
            {t('error.storage')}
          </p>
        )}

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('settings.shopName')}</span>
          <input
            data-testid="settings-shop"
            className={inputClass}
            value={profile.shopName}
            onChange={(e) => update('shopName', e.target.value)}
            disabled={!loaded}
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('settings.traderName')}</span>
          <input
            data-testid="settings-trader"
            className={inputClass}
            value={profile.traderName}
            onChange={(e) => update('traderName', e.target.value)}
            disabled={!loaded}
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('settings.phone')}</span>
          <input
            data-testid="settings-phone"
            className={inputClass}
            type="tel"
            inputMode="tel"
            value={profile.phone}
            onChange={(e) => update('phone', e.target.value)}
            disabled={!loaded}
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('settings.address')}</span>
          <input
            data-testid="settings-address"
            className={inputClass}
            value={profile.address ?? ''}
            onChange={(e) => update('address', e.target.value)}
            disabled={!loaded}
            autoComplete="off"
          />
        </label>

        <button
          data-testid="settings-save"
          onClick={onSave}
          disabled={saving || !loaded}
          className="min-h-[56px] w-full rounded-xl bg-emerald-600 px-4 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-emerald-700"
        >
          {saving ? t('action.saving') : t('settings.save')}
        </button>

        {saved && (
          <p
            data-testid="settings-saved"
            role="status"
            className="text-center text-sm font-medium text-emerald-700"
          >
            ✓ {t('settings.saved')}
          </p>
        )}
      </section>

      {/* Cloud sync — deferred to Phase 4, remains a labelled stub */}
      <ComingSoon feature={t('stub.sync')} testid="stub-sync" />
    </div>
  )
}
