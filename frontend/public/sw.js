/* Anaj Bahi — hand-written cache-first app-shell service worker.
 * Static export lives under basePath /app. We cache the app shell so a repeat
 * launch works offline. IndexedDB (the trader's data) is NEVER in this cache —
 * it persists independently in the browser's storage.
 *
 * Bump CACHE_VERSION whenever the shell changes to invalidate old caches.
 */
const CACHE_VERSION = 'anajbahi-shell-v1'
const BASE = '/app'

// Core shell URLs to precache. Next static export emits per-route index.html
// files under /app/... ; we precache the navigable entry points plus PWA assets.
const SHELL_URLS = [
  `${BASE}/`,
  `${BASE}/bill/`,
  `${BASE}/bills/new/`,
  `${BASE}/due/`,
  `${BASE}/settings/`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Precache best-effort: a single missing URL must not fail the whole install.
      Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  // Only handle same-origin GET navigations/assets for the app shell.
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(`${BASE}/`)) return

  // Cache-first for the shell; fall back to network and cache the result.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((res) => {
          // Cache successful basic responses for next time (best-effort).
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(() => {
          // Offline & uncached: for navigations, serve the app home shell.
          if (req.mode === 'navigate') return caches.match(`${BASE}/`)
          return Response.error()
        })
    }),
  )
})
