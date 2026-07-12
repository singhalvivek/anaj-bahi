'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { updateApp } from '@/lib/pwa'

/**
 * "Update app" control for Settings. Fetches the latest deployed app-shell and
 * reloads. Data-safe: only the app shell is refreshed — saved bills and any
 * offline-unsynced writes live in IndexedDB and are never touched.
 */
// Inlined at build time by `build:pages` (git short hash + date); 'dev' locally.
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev'

export function UpdateAppButton() {
  const { t } = useI18n()
  const [updating, setUpdating] = useState(false)

  async function onUpdate() {
    setUpdating(true)
    await updateApp() // triggers a reload on success
    // If the reload somehow doesn't happen, clear the spinner.
    setUpdating(false)
  }

  return (
    <section
      data-testid="update-app"
      className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-stone-800">{t('settings.updateApp')}</h3>
        <p className="text-sm text-stone-500">{t('settings.updateAppHint')}</p>
      </div>
      <button
        data-testid="update-app-btn"
        onClick={onUpdate}
        disabled={updating}
        className="min-h-[52px] w-full rounded-xl border-2 border-emerald-600 px-4 text-base font-semibold text-emerald-700 transition-colors disabled:opacity-60 active:bg-emerald-50"
      >
        {updating ? t('settings.updating') : t('settings.updateApp')}
      </button>
      <p data-testid="app-version" className="text-center text-xs text-stone-400">
        {t('settings.version')}: {APP_VERSION}
      </p>
    </section>
  )
}
