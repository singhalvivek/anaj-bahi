'use client'

// Personal profile (Phase 8 slice-c) — the signed-in user's OWN identity, shown at
// the top of Settings above the business profile. The display name is editable
// (saved via useAuth().setDisplayName → users/{uid}.displayName, which also refreshes
// the attribution snapshot for future bills). The phone is read-only (it is the
// login identity) and the role is a badge. Distinct from the BUSINESS profile below,
// which is owner-only.

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'

export function PersonalProfile() {
  const { t } = useI18n()
  const { user, setDisplayName } = useAuth()

  // Prefill from the current display name; keep in sync if it changes elsewhere
  // (e.g. after a save the AuthProvider updates user.displayName) but only when the
  // field is not mid-edit against a stale value.
  const [name, setName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setName(user?.displayName ?? '')
  }, [user?.displayName])

  const trimmed = name.trim()
  const isEmployee = user?.role === 'employee'
  const roleLabel = isEmployee ? t('personal.roleEmployee') : t('personal.roleOwner')

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

  const inputClass =
    'w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-base text-stone-800 outline-none focus:border-emerald-500'
  const labelClass = 'text-sm font-medium text-stone-600'

  return (
    <section
      data-testid="personal-profile"
      className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-stone-800">{t('personal.title')}</h3>
        <span
          data-testid="personal-role"
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            isEmployee ? 'bg-sky-100 text-sky-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {roleLabel}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {t('error.generic')}
        </p>
      )}

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

      <div className="flex flex-col gap-1">
        <span className={labelClass}>{t('personal.phoneLabel')}</span>
        <p
          data-testid="personal-phone"
          className="rounded-xl bg-stone-50 px-4 py-3 text-base font-medium text-stone-700"
        >
          {user?.phone ?? '—'}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <span className={labelClass}>{t('personal.roleLabel')}</span>
        <p className="rounded-xl bg-stone-50 px-4 py-3 text-base font-medium text-stone-700">
          {roleLabel}
        </p>
      </div>

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
    </section>
  )
}
