'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { subscribePendingWrites, waitForSync } from '@/lib/db/sync-status'

/**
 * Local-first sync indicator (Phase 7) — replaces the retired Phase-4 backend-URL /
 * device-token `SyncSettings` box. Firestore's `persistentLocalCache` IS the store:
 * every write lands locally and flushes to the cloud automatically on reconnect, so
 * this section only SURFACES that state; it never drives sync.
 *
 * Shows:
 *  - an ONLINE / OFFLINE dot from `navigator.onLine` + the window `online`/`offline`
 *    events (green when connected, amber when offline — the ledger keeps working);
 *  - a PENDING vs SYNCED line from `subscribePendingWrites` (Firestore's
 *    `metadata.hasPendingWrites` — true while a local write is not yet acknowledged);
 *  - a "Sync now" button that awaits `waitForSync()` (resolves once the queued writes
 *    flush). It spins while awaiting and shows a "Synced" confirmation on resolve.
 *
 * There is no URL or token — the user is identified by their phone (Firebase Auth).
 */
export function SyncStatus() {
  const { t } = useI18n()

  // navigator.onLine is unavailable during static-export prerender (no `window`),
  // so we default to online and correct it in the effect once mounted client-side.
  const [online, setOnline] = useState(true)
  const [hasPending, setHasPending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)

  // Connectivity dot — reflect the live browser online/offline state.
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Pending vs synced — subscribe to the active business's pending-write signal.
  useEffect(() => {
    const unsubscribe = subscribePendingWrites((pending) => {
      setHasPending(pending)
      // A fresh local write invalidates the "just synced" confirmation.
      if (pending) setJustSynced(false)
    })
    return unsubscribe
  }, [])

  async function onSyncNow() {
    setSyncing(true)
    setJustSynced(false)
    try {
      // Never rejects for offline — it stays pending and resolves on reconnect once
      // the queue drains. The button simply reflects that wait.
      await waitForSync()
      setJustSynced(true)
    } finally {
      setSyncing(false)
    }
  }

  const dotClass = online ? 'bg-emerald-500' : 'bg-amber-500'
  const connectivityLabel = online ? t('syncStatus.online') : t('syncStatus.offline')
  const stateLabel = hasPending ? t('syncStatus.pending') : t('syncStatus.synced')

  return (
    <section
      data-testid="sync-status"
      className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-stone-800">{t('syncStatus.title')}</h3>
        <p className="text-sm text-stone-500">{t('syncStatus.hint')}</p>
      </div>

      {/* Connectivity + pending/synced state */}
      <div className="flex flex-col gap-2 rounded-xl bg-stone-50 px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-stone-500">{connectivityLabel}</span>
          <span
            data-testid="sync-online-indicator"
            data-online={online ? 'true' : 'false'}
            aria-label={connectivityLabel}
            className={`inline-block h-3 w-3 shrink-0 rounded-full ${dotClass}`}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span
            data-testid="sync-pending-indicator"
            data-pending={hasPending ? 'true' : 'false'}
            className={`font-medium ${hasPending ? 'text-amber-700' : 'text-emerald-700'}`}
          >
            {stateLabel}
          </span>
        </div>
      </div>

      <button
        data-testid="sync-now-btn"
        onClick={onSyncNow}
        disabled={syncing}
        className="min-h-[56px] w-full rounded-xl bg-emerald-600 px-4 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-emerald-700"
      >
        {syncing ? t('syncStatus.syncing') : t('syncStatus.syncNow')}
      </button>

      {justSynced && !syncing && (
        <p
          data-testid="sync-synced-message"
          role="status"
          className="text-center text-sm font-medium text-emerald-700"
        >
          ✓ {t('syncStatus.syncedNow')}
        </p>
      )}
    </section>
  )
}
