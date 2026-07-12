// PWA update helper.
//
// DATA SAFETY: updating only refreshes the app SHELL (HTML/JS/CSS via the service
// worker's Cache API). The trader's data — bills, farmers, and any offline-queued
// writes not yet synced — lives in IndexedDB (Firestore's persistentLocalCache) and
// is NEVER touched here, so updating cannot lose data.

/**
 * Update the installed PWA to the latest deployed version: ask the service worker to
 * check for a new build, activate a waiting worker if there is one, then reload. With
 * the worker's network-first navigation strategy the reload fetches the freshest page
 * and assets. No-ops gracefully where service workers are unsupported/unregistered
 * (e.g. local dev), where it simply reloads.
 */
export async function updateApp(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.update().catch(() => {})
        // If a fresh worker is already waiting, tell it to take over immediately.
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING')
      }
    }
  } catch {
    // Ignore — fall through to a plain reload, which (network-first) still refreshes.
  }
  if (typeof window !== 'undefined') window.location.reload()
}
