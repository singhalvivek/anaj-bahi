# Capability: Installable PWA Shell

_Phase 1 · slice-c_

## What It Does
Makes the app installable to the Android home screen and launchable full-screen offline, via a web manifest and a hand-written cache-first service worker.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| — | — | Browser install prompt / launch | — |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| install metadata | manifest | `public/manifest.webmanifest` |
| cached app shell | Cache Storage | via `public/sw.js` |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Service Worker + Cache API | install/activate/fetch (cache-first for app shell) | If unsupported, app still runs online; no crash |

## Business Rules
- Manifest declares name ("Anaj Bahi"), short_name, `display: standalone`, theme/background colours, icons (192/512), and `start_url`/icon paths under the `/app` basePath.
- Service worker precaches the exported app shell and serves it cache-first so a repeat launch works with no network.
- Registered from a small client component (`SwRegister`); registration is guarded (no-op if unsupported).
- IndexedDB data persists independently of the SW cache (offline data is never in the SW cache).

## Success Criteria
- [ ] The build (`pnpm build`) produces a static export that links the manifest and registers the SW.
- [ ] After one online visit, reloading offline still launches the app shell.
- [ ] Chrome reports the app as installable (manifest + SW + icons valid).
