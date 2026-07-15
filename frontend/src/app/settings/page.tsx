'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import { SyncStatus } from '@/components/SyncStatus'
import { PersonalProfile } from '@/components/settings/PersonalProfile'
import { UpdateAppButton } from '@/components/settings/UpdateAppButton'
import { PhoneField } from '@/components/PhoneField'
import {
  getProfile,
  saveProfile,
  DEFAULT_PROFILE,
  type BusinessProfile,
} from '@/lib/settings/profile'

export default function SettingsPage() {
  const { t } = useI18n()
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_PROFILE)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  // The business profile is owner-only editable (Phase 8). Partners AND employees
  // alike see it read-only, with the Save button hidden and a small note; Security
  // Rules are the real boundary (owner-only business writes) — this UI gate is the
  // friendly first line. (Editing the business profile is the one manager power a
  // partner does NOT share.)
  const isOwner = user?.role === 'owner'
  const isPartner = user?.role === 'partner'
  // Managers (owner or partner) see the Members + Activity nav entries. Business-
  // profile editing stays OWNER-only (a partner does NOT get it).
  const canManage = isOwner || isPartner
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

      {/* Account strip — greeting + business + Sign out. This used to sit above every
          screen; it now lives HERE only, so the bill list gets the full viewport.
          NO role badge is shown (for anyone) — roles appear only in the Members
          roster. `home-*` / `sign-out-btn` testids are unchanged. */}
      <section
        data-testid="account-strip"
        className="flex items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
      >
        <div className="min-w-0">
          <p className="truncate text-sm text-stone-500">
            {t('home.greeting')}{' '}
            <span data-testid="home-user-name" className="font-semibold text-stone-800">
              {user?.displayName ?? '—'}
            </span>
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span
              data-testid="home-business-name"
              className="truncate text-base font-bold text-stone-900"
            >
              {profile.shopName || '—'}
            </span>
          </div>
        </div>
        <button
          type="button"
          data-testid="sign-out-btn"
          onClick={() => {
            void signOut()
          }}
          className="shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 active:bg-stone-100"
        >
          {t('home.signOut')}
        </button>
      </section>

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
          <PhoneField
            testId="settings-phone"
            value={profile.phone}
            onChange={(next) => update('phone', next)}
            ariaLabel={t('settings.phone')}
            disabled={!canEditBusiness}
            readOnly={!isOwner}
            className="rounded-xl border-2 border-stone-300 bg-white py-3 text-base text-stone-800 focus-within:border-emerald-500"
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

      {/* Members entry — owners + partners (the screen itself is manager-gated too) */}
      {canManage && (
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

      {/* Activity log entry — owners + partners (the screen itself is manager-gated too) */}
      {canManage && (
        <Link
          href="/activity"
          data-testid="activity-entry"
          className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm active:bg-stone-50"
        >
          <span className="flex items-center gap-3 text-base font-semibold text-stone-800">
            <span aria-hidden className="text-xl">
              📜
            </span>
            {t('settings.activityEntry')}
          </span>
          <span aria-hidden className="text-stone-400">
            ›
          </span>
        </Link>
      )}

      {/* Local-first sync status — Phase-7 Firestore offline persistence */}
      <SyncStatus />

      {/* Update the installed app to the latest version (data-safe: shell only) */}
      <UpdateAppButton />
    </div>
  )
}
