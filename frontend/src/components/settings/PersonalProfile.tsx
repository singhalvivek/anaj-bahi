'use client'

// Personal profile (Phase 8 · slice-c) — the signed-in user's OWN identity, shown at
// the top of Settings above the business profile.
//
//  - display name  → editable, saved via useAuth().setDisplayName → users/{uid}.displayName
//                     (also refreshes the attribution snapshot for future bills)
//  - email         → read-only; the Google account IS the login identity
//  - mobile        → editable PROFILE data (not an auth factor). Persisted directly to
//                     users/{uid}.phone via Firestore (setDoc merge) — we must NOT edit
//                     the auth context here (owned by another slice), so we write the
//                     doc directly and optimistically reflect the saved value locally.

import { useEffect, useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import { firestore } from '@/lib/firebase/app'
import { PhoneField, isValidIndianPhone } from '@/components/PhoneField'

export function PersonalProfile() {
  const { t } = useI18n()
  const { user, setDisplayName } = useAuth()

  // Display name — prefill from the current value; resync if it changes elsewhere.
  const [name, setName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setName(user?.displayName ?? '')
  }, [user?.displayName])

  // Mobile — editable profile data, seeded from the stored E.164 value.
  const [mobile, setMobile] = useState(user?.phone ?? '')
  const [mobileSaving, setMobileSaving] = useState(false)
  const [mobileSaved, setMobileSaved] = useState(false)
  const [mobileError, setMobileError] = useState(false)

  useEffect(() => {
    setMobile(user?.phone ?? '')
  }, [user?.phone])

  const trimmed = name.trim()

  async function onSave() {
    if (!trimmed) return
    setSaving(true)
    setSaved(false)
    setError(false)
    try {
      await setDisplayName(trimmed)
      setSaved(true)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const canSaveMobile = isValidIndianPhone(mobile) && !mobileSaving

  async function onSaveMobile() {
    if (!user || !canSaveMobile) return
    setMobileSaving(true)
    setMobileSaved(false)
    setMobileError(false)
    try {
      await setDoc(
        doc(firestore, 'users', user.uid),
        { phone: mobile, updatedAt: Date.now() },
        { merge: true },
      )
      // Optimistically reflect the saved value; the auth context (another slice)
      // will pick up the change on its next users/{uid} read.
      setMobile(mobile)
      setMobileSaved(true)
    } catch {
      setMobileError(true)
    } finally {
      setMobileSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-base text-stone-800 outline-none focus:border-emerald-500'
  const labelClass = 'text-sm font-medium text-stone-600'

  return (
    <section
      data-testid="personal-profile"
      className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      {/* No role badge — roles are shown only in the Members roster (managers-only). */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-stone-800">{t('personal.title')}</h3>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {t('error.generic')}
        </p>
      )}

      {/* Display name — editable */}
      <label className="flex flex-col gap-1">
        <span className={labelClass}>{t('personal.nameLabel')}</span>
        <input
          data-testid="personal-name-input"
          className={inputClass}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
          autoComplete="name"
        />
      </label>

      <button
        type="button"
        data-testid="personal-save-btn"
        onClick={onSave}
        disabled={saving || !trimmed}
        className="min-h-[56px] w-full rounded-xl bg-emerald-600 px-4 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-emerald-700"
      >
        {saving ? t('personal.saving') : t('personal.save')}
      </button>

      {saved && !saving && (
        <p
          data-testid="personal-saved"
          role="status"
          className="text-center text-sm font-medium text-emerald-700"
        >
          ✓ {t('personal.saved')}
        </p>
      )}

      {/* Email — read-only Google identity */}
      <div className="flex flex-col gap-1">
        <span className={labelClass}>{t('personal.emailLabel')}</span>
        <p
          data-testid="profile-email"
          className="rounded-xl bg-stone-50 px-4 py-3 text-base font-medium text-stone-700"
        >
          {user?.email ?? '—'}
        </p>
        <span className="text-xs text-stone-400">{t('personal.emailReadonly')}</span>
      </div>

      {/* Mobile — editable profile data (not an auth factor) */}
      <div className="flex flex-col gap-1">
        <span className={labelClass}>{t('personal.mobileLabel')}</span>
        <PhoneField
          testId="profile-mobile-input"
          value={mobile}
          onChange={(next) => {
            setMobile(next)
            setMobileSaved(false)
            setMobileError(false)
          }}
          ariaLabel={t('personal.mobileLabel')}
          className="min-h-[48px] rounded-xl border-2 border-stone-300 bg-white text-base text-stone-800 focus-within:border-emerald-500"
        />
        <span className="text-xs text-stone-400">{t('personal.mobileHint')}</span>
      </div>

      {mobileError && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {t('error.generic')}
        </p>
      )}

      <button
        type="button"
        data-testid="profile-mobile-save"
        onClick={() => void onSaveMobile()}
        disabled={!canSaveMobile}
        className="min-h-[56px] w-full rounded-xl bg-emerald-600 px-4 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-emerald-700"
      >
        {mobileSaving ? t('action.saving') : t('action.save')}
      </button>

      {mobileSaved && !mobileSaving && (
        <p
          data-testid="profile-mobile-saved"
          role="status"
          className="text-center text-sm font-medium text-emerald-700"
        >
          ✓ {t('settings.saved')}
        </p>
      )}
    </section>
  )
}
