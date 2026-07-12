'use client'

import { useEffect } from 'react'

// Base path for the static export; defaults to `/app` (local dev + E2E). The
// Pages production build sets NEXT_PUBLIC_BASE_PATH (e.g. `/anaj-bahi`) so the
// service worker registers/scopes under the deployed sub-path.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '/app'

/**
 * Boot component (renders nothing): registers the hand-written service worker at
 * /app/sw.js (scope /app/), guarded so unsupported browsers just run online with
 * no crash.
 *
 * No auto-sync and no seeding happen here anymore:
 *  - Sync is now NATIVE to Firestore's `persistentLocalCache` (writes flush on
 *    reconnect automatically) — there is no `lib/sync` engine to start.
 *  - Grain-type seeding runs on business activation in `AuthProvider` (it needs an
 *    active business scope); calling it here would run before a business is active
 *    and throw.
 */
export function SwRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    if (process.env.NODE_ENV === 'production') {
      // Register from the basePath scope so the exported shell is cached.
      navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch((err) => {
        console.warn('[anajbahi] service worker registration skipped', err)
      })
    } else {
      // Dev only: never register the cache-first shell SW — it would serve stale
      // pages/chunks during local iteration (and break HMR across branch switches).
      // Also proactively unregister any SW left from a production visit or an
      // earlier dev session so `pnpm dev` always serves fresh code.
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {})
    }
  }, [])

  return null
}
