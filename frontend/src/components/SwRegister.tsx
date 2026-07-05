'use client'

import { useEffect } from 'react'
import { ensureSeeded } from '@/lib/db/repo'

/**
 * Boot component (renders nothing):
 *  - registers the hand-written service worker at /app/sw.js (scope /app/),
 *    guarded so unsupported browsers just run online with no crash;
 *  - seeds the starter grain-type list once on first launch.
 */
export function SwRegister() {
  useEffect(() => {
    // Seed grain types (idempotent). Never let a storage error crash the app.
    ensureSeeded().catch((err) => {
      console.error('[anajbahi] seed failed', err)
    })

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    // Register from the basePath scope so the exported shell is cached.
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch((err) => {
      console.warn('[anajbahi] service worker registration skipped', err)
    })
  }, [])

  return null
}
