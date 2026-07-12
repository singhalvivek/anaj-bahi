'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import { SyncStatus } from '@/components/SyncStatus'
import { PersonalProfile } from '@/components/settings/PersonalProfile'
import {
  getProfile,
  saveProfile,
  DEFAULT_PROFILE,
  type BusinessProfile,
} from '@/lib/settings/profile'

export default function SettingsPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_PROFILE)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  // The business profile is owner-only editable (Phase 8). Employees see it
  // read-only, with the Save button hidden and a small note; Security Rules are
  // the real boundary (owner-only business writes) — this UI gate is the friendly
  // first line.
  const isOwner = user?.role === 'owner'
  const canEditBusiness = isOwner && loaded

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
    'w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-base text-stone-800 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500'
  const labelClass = 'text-sm font-medium text-stone-600'

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8">
      <h2 className="text-2xl font-semibold text-stone-800">{t('settings.title')}</h2>

      {/* Personal profile — the signed-in user's own identity (editable name) */}
      <PersonalProfile />

      {/* Business profile — owner-only editable; read-only for employees */}
      <section
        data-testid="business-profile"
        className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-stone-800">{t('settings.business')}</h3>
          <p className="text-sm text-stone-500">{t('settings.businessHint')}</p>
        </div>

        {!isOwner && (
          <p
            data-testid="business-readonly-note"
            className="rounded-xl bg-stone-50 px-4 py-3 text-sm font-medium text-stone-500"
          >
            {t('settings.businessReadonly')}
          </p>
        )}

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
            disabled={!canEditBusiness}
            readOnly={!isOwner}
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
            disabled={!canEditBusiness}
            readOnly={!isOwner}
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
            disabled={!canEditBusiness}
            readOnly={!isOwner}
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
            disabled={!canEditBusiness}
            readOnly={!isOwner}
            autoComplete="off"
          />
        </label>

        {isOwner && (
          <>
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
          </>
        )}
      </section>

      {/* Employees entry — owners only (the screen itself is owner-gated too) */}
      {isOwner && (
        <Link
          href="/employees"
          data-testid="employees-entry"
          className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm active:bg-stone-50"
        >
          <span className="flex items-center gap-3 text-base font-semibold text-stone-800">
            <span aria-hidden className="text-xl">
              👥
            </span>
            {t('settings.employeesEntry')}
          </span>
          <span aria-hidden className="text-stone-400">
            ›
          </span>
        </Link>
      )}

      {/* Activity log — labelled Phase-9 stub (clearly not a link) */}
      <div
        data-testid="activity-stub"
        aria-disabled="true"
        className="flex select-none items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/70 px-5 py-4"
      >
        <span className="flex items-center gap-3 text-base font-medium text-stone-500">
          <span aria-hidden className="text-xl">
            📜
          </span>
          {t('settings.activityComingSoon')}
        </span>
        <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-500">
          {t('stub.comingSoon')}
        </span>
      </div>

      {/* Local-first sync status — Phase-7 Firestore offline persistence */}
      <SyncStatus />
    </div>
  )
}
