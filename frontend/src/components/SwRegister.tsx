'use client'

import { useEffect } from 'react'
import { ensureSeeded } from '@/lib/db/repo'
import { startAutoSync } from '@/lib/sync'

/**
 * Boot component (renders nothing):
 *  - registers the hand-written service worker at /app/sw.js (scope /app/),
 *    guarded so unsupported browsers just run online with no crash;
 *  - seeds the starter grain-type list once on first launch;
 *  - starts opportunistic auto-sync (flushes on the `online` event). Safe when
 *    sync is unconfigured (a no-op) and never blocks the local write path.
 */
export function SwRegister() {
  useEffect(() => {
    // Seed grain types (idempotent). Never let a storage error crash the app.
    ensureSeeded().catch((err) => {
      console.error('[anajbahi] seed failed', err)
    })

    // Opportunistic cloud backup when connectivity returns. Offline-safe no-op
    // when unconfigured; returns an unsubscribe fn we clean up on unmount.
    const stopAutoSync = startAutoSync()

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return () => {
        stopAutoSync()
      }
    }
    // Register from the basePath scope so the exported shell is cached.
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch((err) => {
      console.warn('[anajbahi] service worker registration skipped', err)
    })

    return () => {
      stopAutoSync()
    }
  }, [])

  return null
}
