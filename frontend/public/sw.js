/* Anaj Bahi — hand-written app-shell service worker.
 * Static export lives under basePath /app.
 *
 * DATA SAFETY: this worker only ever touches the Cache API (the app SHELL —
 * HTML/JS/CSS/icons). The trader's data — bills, farmers, and any offline-queued
 * writes not yet synced — lives in IndexedDB (Firestore's persistentLocalCache),
 * which this file NEVER reads, writes, or clears. Updating the app cannot lose data.
 *
 * UPDATE STRATEGY:
 *  - Page navigations are NETWORK-FIRST: when online we always fetch the latest
 *    HTML (which references the latest hashed JS), so a new deploy shows up on the
 *    next online open. We fall back to the cached shell only when offline.
 *  - Static assets are CACHE-FIRST: Next emits content-hashed filenames, so a cached
 *    asset is immutable and safe to serve instantly; a new deploy has new filenames
 *    that miss the cache and are fetched fresh.
 *  - On activate we delete ONLY our own older shell caches (prefix-scoped) and take
 *    control immediately (skipWaiting + clients.claim).
 *
 * Bump CACHE_VERSION whenever the shell changes to retire the previous cache.
 */
const CACHE_PREFIX = 'anajbahi-shell-'
const CACHE_VERSION = `${CACHE_PREFIX}v4`
const BASE = '/app'

// Core shell URLs to precache (navigable entry points + PWA assets). Best-effort.
const SHELL_URLS = [
  `${BASE}/`,
  `${BASE}/bill/`,
  `${BASE}/bills/new/`,
  `${BASE}/bills/quick/`,
  `${BASE}/bills/choose/`,
  `${BASE}/due/`,
  `${BASE}/settings/`,
  `${BASE}/employees/`,
  `${BASE}/activity/`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // A single missing URL must not fail the whole install.
      Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))),
    ),
  )
  // Activate this worker as soon as it finishes installing.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        // Delete ONLY our own older shell caches — never any other storage.
        Promise.all(
          keys
            .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// Allow the page's "Update app" button to activate a waiting worker immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(`${BASE}/`)) return

  const isNavigation =
    req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')

  if (isNavigation) {
    // NETWORK-FIRST: always try the network so a new deploy is picked up; cache the
    // fresh page for offline; fall back to the cached page (or the home shell) offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match(`${BASE}/`)),
        ),
    )
    return
  }

  // CACHE-FIRST for content-hashed static assets (immutable → safe to serve cached).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(() => Response.error())
    }),
  )
})
