'use client'

import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useI18n } from '@/lib/i18n/context'
import {
  getSyncConfig,
  saveSyncConfig,
  syncNow,
  restoreFromCloud,
  getSyncState,
  SyncAuthError,
  SyncNetworkError,
  type SyncErrorKind,
} from '@/lib/sync'

/**
 * Cloud backup section of the Settings screen (Phase 4).
 *
 * Lets the trader (1) enter + save the backend URL and device token, (2) see the
 * live sync status (last backed up, pending count, last error), (3) back up now,
 * and (4) restore from the cloud onto this device. Every network path degrades
 * gracefully — the frozen `lib/sync` engine never throws to `syncNow`, and restore
 * surfaces a precise, mapped message. The local Dexie store is never blocked or
 * corrupted by anything here (offline-first).
 */
export function SyncSettings() {
  const { t } = useI18n()

  // Reactive status: re-reads whenever the `meta` table changes (a sync writes it).
  const state = useLiveQuery(() => getSyncState(), [])

  const [baseUrl, setBaseUrl] = useState('')
  const [token, setToken] = useState('')
  const [configLoaded, setConfigLoaded] = useState(false)

  const [savingConfig, setSavingConfig] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [restoring, setRestoring] = useState(false)

  // A single positive-confirmation line (synced / restored). Errors go to `errorMsg`.
  const [message, setMessage] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getSyncConfig()
      .then((cfg) => {
        if (!active) return
        if (cfg) {
          setBaseUrl(cfg.baseUrl)
          setToken(cfg.token)
        }
        setConfigLoaded(true)
      })
      .catch(() => {
        if (active) setConfigLoaded(true)
      })
    return () => {
      active = false
    }
  }, [])

  /** Map a stored/known error kind to a user-facing, translated message. */
  function messageForKind(kind: SyncErrorKind | 'unknown' | null): string | null {
    switch (kind) {
      case 'auth':
        return t('sync.error.auth')
      case 'network':
        return t('sync.error.network')
      case 'config':
        return t('sync.error.config')
      case 'unknown':
        return t('error.generic')
      default:
        return null
    }
  }

  function clearFeedback() {
    setMessage(null)
    setErrorMsg(null)
  }

  async function onSaveConfig() {
    setSavingConfig(true)
    setConfigSaved(false)
    clearFeedback()
    try {
      await saveSyncConfig({ baseUrl, token })
      // Reflect the normalised (trimmed / trailing-slash-stripped) values back.
      const fresh = await getSyncConfig()
      if (fresh) {
        setBaseUrl(fresh.baseUrl)
        setToken(fresh.token)
      }
      setConfigSaved(true)
    } catch {
      setErrorMsg(t('error.storage'))
    } finally {
      setSavingConfig(false)
    }
  }

  async function onSyncNow() {
    setSyncing(true)
    setConfigSaved(false)
    clearFeedback()
    try {
      const result = await syncNow() // never throws — always resolves
      if (result.ok) {
        setMessage(t('sync.synced'))
      } else {
        setErrorMsg(messageForKind(result.error ?? 'unknown'))
      }
    } finally {
      setSyncing(false)
    }
  }

  async function onRestore() {
    if (!window.confirm(t('sync.restoreConfirm'))) return
    setRestoring(true)
    setConfigSaved(false)
    clearFeedback()
    try {
      await restoreFromCloud()
      // Dexie liveQueries elsewhere (bill list/detail) update automatically.
      setMessage(t('sync.restored'))
    } catch (e) {
      if (e instanceof SyncAuthError) {
        setErrorMsg(messageForKind('auth'))
      } else if (e instanceof SyncNetworkError) {
        setErrorMsg(messageForKind('network'))
      } else {
        // Plain Error from the engine == not configured.
        setErrorMsg(messageForKind('config'))
      }
    } finally {
      setRestoring(false)
    }
  }

  const lastSyncedLabel =
    state && state.lastSyncedAt
      ? new Date(state.lastSyncedAt).toLocaleString()
      : t('sync.never')

  // The persisted last-error (a SyncErrorKind string), mapped for display.
  const persistedError = state?.lastError
    ? messageForKind(state.lastError as SyncErrorKind)
    : null

  const inputClass =
    'w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-base text-stone-800 outline-none focus:border-emerald-500'
  const labelClass = 'text-sm font-medium text-stone-600'

  return (
    <section
      data-testid="sync-settings"
      className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-stone-800">{t('sync.title')}</h3>
        <p className="text-sm text-stone-500">{t('sync.offlineOk')}</p>
      </div>

      {/* --- Connection config --- */}
      <label className="flex flex-col gap-1">
        <span className={labelClass}>{t('sync.baseUrl')}</span>
        <input
          data-testid="sync-url"
          className={inputClass}
          value={baseUrl}
          onChange={(e) => {
            setBaseUrl(e.target.value)
            setConfigSaved(false)
          }}
          disabled={!configLoaded}
          placeholder="http://localhost:8000"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>{t('sync.token')}</span>
        <input
          data-testid="sync-token"
          className={inputClass}
          value={token}
          onChange={(e) => {
            setToken(e.target.value)
            setConfigSaved(false)
          }}
          disabled={!configLoaded}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>

      <button
        data-testid="sync-save-config"
        onClick={onSaveConfig}
        disabled={savingConfig || !configLoaded}
        className="min-h-[56px] w-full rounded-xl bg-stone-700 px-4 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-stone-800"
      >
        {t('sync.saveConfig')}
      </button>

      {configSaved && (
        <p
          data-testid="sync-config-saved"
          role="status"
          className="text-center text-sm font-medium text-emerald-700"
        >
          ✓ {t('sync.configSaved')}
        </p>
      )}

      {/* --- Live status --- */}
      <div
        data-testid="sync-status"
        className="flex flex-col gap-1 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-700"
      >
        <div className="flex justify-between gap-3">
          <span className="text-stone-500">{t('sync.lastSynced')}</span>
          <span data-testid="sync-last-synced" className="font-medium text-stone-800">
            {lastSyncedLabel}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-stone-500">{t('sync.pending')}</span>
          <span data-testid="sync-pending" className="font-medium text-stone-800">
            {state ? state.pendingCount : 0}
          </span>
        </div>
        {persistedError && (
          <p data-testid="sync-status-error" className="pt-1 font-medium text-amber-700">
            {persistedError}
          </p>
        )}
      </div>

      {/* --- Actions --- */}
      <button
        data-testid="sync-now"
        onClick={onSyncNow}
        disabled={syncing || restoring}
        className="min-h-[56px] w-full rounded-xl bg-emerald-600 px-4 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-emerald-700"
      >
        {syncing ? t('sync.syncing') : t('sync.now')}
      </button>

      <button
        data-testid="sync-restore"
        onClick={onRestore}
        disabled={syncing || restoring}
        className="min-h-[56px] w-full rounded-xl border-2 border-emerald-600 px-4 text-lg font-semibold text-emerald-700 transition-colors disabled:opacity-60 active:bg-emerald-50"
      >
        {restoring ? t('sync.restoring') : t('sync.restore')}
      </button>

      {/* --- Feedback --- */}
      {message && (
        <p
          data-testid="sync-message"
          role="status"
          className="text-center text-sm font-medium text-emerald-700"
        >
          ✓ {message}
        </p>
      )}

      {errorMsg && (
        <p
          data-testid="sync-error"
          role="alert"
          className="text-center text-sm font-medium text-red-600"
        >
          {errorMsg}
        </p>
      )}
    </section>
  )
}
