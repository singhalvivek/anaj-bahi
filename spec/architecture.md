# Architecture — Anaj Bahi

> Deterministic, offline-first PWA. **No agent framework** anywhere in this project. Through Phase 12 there was no AI of any kind; **Phase 13 ([Bill Check](capabilities/bill-check.md)) adds exactly one stateless LLM vision call**, used only to read handwriting off a photo — never to calculate. Every ledger figure stays deterministic and every other screen stays fully offline. See [agent.md](agent.md).

---

## System Overview

Anaj Bahi is an installable **Next.js PWA** that runs on the trader's phone. In Phase 1 there is **no backend and no network dependency**: the browser is the whole runtime. The UI (React 19 client components) reads and writes an **IndexedDB** database via **Dexie**; a pure TypeScript **calc module** computes all weights and money; a **service worker** caches the app shell so it launches offline; a lightweight **i18n context** swaps Hindi/English. Phases 1–5 built this single-user local ledger (with an optional FastAPI + SQLite personal-backup backend in the now-**superseded** Phase 4).

> **Firebase multi-tenant redesign (Phases 6–9).** The app is evolving from single-user-single-device into a **multi-tenant, multi-user** ledger: many independent **businesses**, each with **owners**, **partners** (co-owners), and **employees** who share one ledger. The FastAPI + SQLite sync backend is **replaced entirely by Firebase** — **Firebase Auth (Google sign-in)** for identity and **Cloud Firestore (accessed directly from the client, with IndexedDB offline persistence as the store)** for the shared, business-scoped data. There is still **no server we run** (no FastAPI, no container) and — as of Phases 6–9 — still no AI/LLM/agent (that changes only in Phase 13, and only on the Bill Check screen; see [agent.md](agent.md)). The full frozen contracts for this redesign are in [§ Firebase multi-tenant redesign — frozen contracts](#firebase-multi-tenant-redesign-phases-69--frozen-contracts) at the end of this file.

## Component Map

```
                 ┌─────────────────────────────────────────────┐
                 │  Next.js PWA (static export, basePath /app)  │
                 │                                              │
  Trader ──tap──►│  React client components (App Router)        │
                 │        │                    ▲                │
                 │        ▼                    │                │
                 │   lib/i18n (Hindi/English context)           │
                 │        │                    │                │
                 │        ▼                    │                │
                 │   lib/calc (pure math) ─────┘                │
                 │        │                                     │
                 │        ▼                                     │
                 │   lib/db/repo  ──►  Dexie  ──►  IndexedDB    │
                 │                                              │
                 │   service worker (public/sw.js) — app shell  │
                 └───────────────────────┬──────────────────────┘
                                         │ (Phase 4 only, when online)
                                         ▼
                        FastAPI sync service ──► SQLite (data/*.db)  (backup)
```

## Layers

| Layer | Responsibility |
|-------|----------------|
| **UI (App Router client components)** | Screens, forms, the sack-by-sack interaction, language toggle, "coming soon" stubs. Owns no business math. |
| **i18n (`lib/i18n`)** | Language state (Hindi/English) + string dictionary; provider + `useI18n()` hook; persists choice to `localStorage`. |
| **Calc (`lib/calc`)** | Pure, side-effect-free functions: deduction resolution, net weight, line amount, bill total, rounding. Fully unit-tested. |
| **Data (`lib/db`)** | Dexie schema, repository functions (farmers/grain-types/bills), grain-type seed, bill-id generator. Only layer that touches IndexedDB. |
| **PWA shell (`public/sw.js`, `manifest.webmanifest`)** | Cache-first app shell for offline launch + home-screen install. |
| **Sync (Phase 4)** | Outbox + sync engine (frontend) and FastAPI/SQLite service (backend). |

## Data Flow (Phase 1 — create a bill)

1. **Trigger:** trader taps **+ New Bill** → `/bills/new`.
2. Farmer picker calls `repo.searchFarmers(prefix)`; on save of a new farmer, `repo.upsertFarmer`.
3. Grain line editor collects grain type + price/quintal + `sackWeights[]` + `deductions[]`; on every change it calls **pure** `calc.computeGrainLine(...)` and `calc.computeBillTotal(...)` to render live totals (no DB writes yet).
4. On **Save**, the page assembles a `Bill` (with a `db/id.generateBillId(date)` id, denormalised farmer name/place + grain-type ids for search) and calls `repo.createBill(bill)` → Dexie → IndexedDB.
5. **Output:** the bill is persisted locally; the home list (`repo.listBills()`) shows it; reopening `/bill?id=…` calls `repo.getBill(id)` and re-renders identical data.

No network, no server, no keys anywhere in this flow.

## External Dependencies

| Dependency | Purpose | Failure Mode |
|------------|---------|--------------|
| Browser **IndexedDB** | Local persistent store (via Dexie) | If unavailable/blocked, app surfaces a clear "storage unavailable" error; never silently loses data. |
| Browser **Service Worker + Cache API** | Offline app-shell launch + install | If unsupported, app still runs online; install/offline degrade gracefully. |
| **`navigator.share`** (Phase 3) | Native share sheet for receipt image | If unsupported, falls back to image download. |
| **FastAPI sync service** (Phase 4 only) | Cloud backup/restore | If offline/down, mutations queue in the outbox and flush later; local store is unaffected. |

---

## Stack

- **Mode:** **Brownfield** for the Firebase redesign (Phases 6–9) — it **extends the already-shipped `frontend/` Next.js app in place**, adopting its stack, layout, and toolchain; it never restructures, renames, or moves existing files. (Phases 1–5 were greenfield-built by this harness.)
- **Language:** TypeScript 5 (frontend). ~~Python 3.12 for the Phase-4 sync backend~~ — **removed** in Phase 7 (Firebase replaces it).
- **Agent framework:** **None.** No LangGraph/CrewAI/AutoGen, no agent loop, no graph, no tools, no multi-turn. Phase 13 adds a single stateless `fetch` to a vision model; that is not an agent and is not modelled as one. See [agent.md](agent.md).
- **LLM provider + model (Phase 13+):** **Google Gemini** (Generative Language API), called **directly from the client**. Model from `NEXT_PUBLIC_GEMINI_MODEL`, default **`gemini-flash-lite-latest`**. Used by **one screen only** (`/bills/check`) for **handwriting transcription only** — it never computes money. Phases 1–12 had no LLM at all.
- **Frontend:** Next.js 15.3 (App Router) + React 19, **static export** (`output: 'export'`, `basePath: '/app'`, `trailingSlash: true`), Tailwind CSS 4. Installable PWA (manifest + hand-written service worker). Unchanged by the redesign.
- **Local store (Phases 1–5):** **IndexedDB via Dexie 4**. No server DB on device.
- **Auth (Phase 6+):** **Firebase Authentication — Google sign-in** via the Firebase Web JS SDK (`firebase/auth`): `GoogleAuthProvider` + `signInWithPopup`, **`browserLocalPersistence`** (stays signed in until explicit sign-out). Identity = the Firebase **`uid`** (stable per Google account, the same on every device). **No SMS/OTP, no reCAPTCHA, no Blaze plan** — Google sign-in is free on the **Spark** tier (phone/SMS-OTP was removed after it began returning `auth/billing-not-enabled`; the "10 free SMS/day" console banner is dead since Sept 2024). Google supplies `displayName` + `email`; email is stored on the user record. The **mobile number** is captured at onboarding as **profile/verification data only** — never an auth factor. Web config is 6 **public** `NEXT_PUBLIC_FIREBASE_*` values (not secrets); real security is **Firestore Security Rules**.
- **Cloud data store (Phase 7+):** **Cloud Firestore**, accessed **directly from the client** (`firebase/firestore`) with **no server**. **IndexedDB offline persistence (`persistentLocalCache` + `persistentMultipleTabManager`) is THE store** — writes save + queue locally offline and auto-sync on reconnect; reads are live cross-device via `onSnapshot`. Data is **business-scoped** (see the frozen collection-path map). Free **Spark/Blaze-free-quota** tier; no infra we operate.
- **~~Backend (Phase 4)~~ — SUPERSEDED / REMOVED (Phase 7):** the FastAPI + SQLite + SQLAlchemy `backend/` tree, its `uv` toolchain, the `frontend/src/lib/sync/*` engine, and the `SyncSettings` UI are **all removed** in Phase 7 and replaced by Firestore. The Phase-4 sync contract below is retained only as historical record, marked SUPERSEDED.
- **Key new dependency:** **`firebase`** (npm, ^11) — Auth + Firestore Web SDK (frontend `dependencies`). **`firebase-tools`** is a frontend **devDependency** (or `npx`-invoked) that runs the **Auth + Firestore emulators** for E2E (`firebase emulators:exec`); the emulator is cleared via its REST endpoint, so **no `firebase-admin` and no service-account key are required**.
- **Dependency management:** **pnpm** (frontend). (`uv`/Python removed with the backend in Phase 7.)
- **Observability:** No LLM tracing stack. The one model call is a single `fetch` whose outcome is rendered to the trader directly — a failed or unparseable read is a visible bilingual message on the screen, which is the only observability surface that matters for a device-only app with no server. Client errors surface as visible UI messages; Firebase Auth/Firestore errors are mapped to translated messages; dev uses browser devtools + the Firebase console.

> **Assumed:** unit tests use **Vitest** + **fake-indexeddb** (idiomatic, fast, TS-native) and E2E uses **Playwright** (already available in the repo). No heavy i18n library — a hand-rolled context + typed dictionary covers two languages.

> **Assumed:** the Next.js app keeps its existing home under **`frontend/`** (the real source tree already present); all app code lives there, never loose at repo root. The Phase-4 backend gets its own **`backend/`** tree.

> **Assumed (Firebase redesign):** (1) **E2E runs against the Firebase Auth + Firestore emulators** (see [§ E2E determinism](#e2e-determinism-frozen)) — Google sign-in is simulated by the Auth emulator's built-in test-IdP popup, so no real Google account, no external network, and no SMS/OTP are involved. (2) The app connects to the emulators only when the env flag **`NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1`** is set (Playwright + optional local dev); unset → real Firebase. The Firestore emulator is reset before each run via its **REST clear endpoint** (no Admin SDK, no service-account key). (3) Firestore uses the modern **`persistentLocalCache`** offline API (not the deprecated `enableIndexedDbPersistence`). (4) `phoneKey` = E.164 without the leading `+` — now used only for the **invite** mobile match, not for identity. (5) In Phase 6, the old `backend` **`uvicorn` webServer** and `sync-journey.spec.ts` are removed from the Playwright config so the Phase-6 gate is Firebase-frontend-only; the fuller backend-tree / `lib/sync` / `SyncSettings` removal completes in Phase 7.

## Commands

> Binding source of truth for which tool every generator and gate runs. **All frontend commands run with working directory `frontend/`.** Phase 1 needs **no secrets and no `.env`.**

| Command | Value |
|---------|-------|
| Package-manager run prefix | `pnpm` (cwd `frontend/`) |
| Install | `pnpm install` (cwd `frontend/`) |
| Dev run command | `pnpm dev` (cwd `frontend/`) — Next dev server |
| Dev port | `3000` |
| URL the user opens | `http://localhost:3000/app/` (note the `/app` basePath + trailing slash) |
| Production build | `pnpm build` (cwd `frontend/`) — static export to `frontend/out/` (default basePath `/app`) |
| Pages production build | `NEXT_PUBLIC_BASE_PATH=/anaj-bahi pnpm build:pages` (cwd `frontend/`) — `next build` + `scripts/apply-base-path.mjs` (rewrites `/app` → `/anaj-bahi` in the exported `manifest.webmanifest`/`sw.js`). Run by CI. |
| Base path env | `NEXT_PUBLIC_BASE_PATH` — the static-export `basePath`. **Default `/app`** (unset = local dev, `pnpm build`, and E2E). GitHub Pages production sets `/anaj-bahi`. |
| Lint command | `pnpm lint` (cwd `frontend/`) |
| Unit test command | `pnpm test` → `vitest run` (cwd `frontend/`) |
| E2E / UI test command | `pnpm test:e2e` → `playwright test` (cwd `frontend/`); Playwright `webServer` runs `pnpm dev`, `baseURL` `http://localhost:3000/app/` |
| Migration command | **N/A in Phases 1–3** (Dexie handles IndexedDB schema versioning in-app). **Phase 4 backend:** no Alembic — create/init the SQLite tables with `uv run python -m app.init_db` (cwd `backend/`), which calls SQLAlchemy `Base.metadata.create_all(...)`. Idempotent (safe to re-run). |
| Phase-1 gate | `pnpm install && pnpm test && pnpm build && pnpm test:e2e` (cwd `frontend/`) |

**`package.json` scripts to add (owned by slice-a):** `"test": "vitest run"`, `"test:e2e": "playwright test"`.

### Firebase env & commands (Phase 6+, cwd `frontend/`)

> **Phase 6 is the FIRST Firebase-era phase and the first to require `.env` on the frontend.** All commands still run with working directory **`frontend/`**; the dev port, URL, and command shapes are **unchanged** (pnpm, port 3000, URL `http://localhost:3000/app/`).

| Command / setting | Value |
|-------------------|-------|
| Firebase Web config (PUBLIC, not secrets) | 6 vars in **`frontend/.env.local`** (gitignored): `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`. Documented in **`frontend/.env.example`**. Read at build/runtime by `lib/firebase/app.ts` via `process.env.NEXT_PUBLIC_*` (inlined into the static export). |
| Emulator flag (E2E / optional dev) | **`NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1`** — when set, `lib/firebase/app.ts` calls `connectAuthEmulator(...)` + `connectFirestoreEmulator(...)`. Unset (default) → real Firebase. Playwright sets it; local dev may set it to iterate without touching the real project. **No service-account key and no `FIREBASE_SERVICE_ACCOUNT` are required** anymore. |
| Emulator ports | Auth `9099`, Firestore `8080` (declared in **`firebase.json`** → `emulators`). The Firestore emulator is cleared before each E2E run via `DELETE http://127.0.0.1:8080/emulator/v1/projects/<projectId>/databases/(default)/documents`. |
| Google provider (real project) | Enable **Authentication → Sign-in method → Google** with a **support email** (Console; documented in DEPLOY.md, not automated). Only needed for real (non-emulator) use, e.g. production. |
| Authorized domains (real project) | Add `localhost` and `singhalvivek.github.io` in Console → Authentication → Settings → Authorized domains (documented in DEPLOY.md, not automated). |
| Dev run / port / URL | **Unchanged:** `pnpm dev` (cwd `frontend/`), port `3000`, URL `http://localhost:3000/app/`. `pnpm dev` auto-loads `frontend/.env.local`. |
| Unit test command | **Unchanged:** `pnpm test` → `vitest run` (cwd `frontend/`) — covers invite-code generation + the pure invite-check / role-route decision modules. |
| E2E / UI test command | `pnpm test:e2e` → **`firebase emulators:exec --only auth,firestore "playwright test"`** (cwd `frontend/`), so the Auth + Firestore emulators are up for the whole run. Playwright's `webServer` runs `pnpm dev` (with `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1`); `global-setup` clears the Firestore emulator via its REST endpoint. Google sign-in is driven through the **Auth emulator's test-IdP popup**. |
| **Phase-6 gate** | `pnpm install && pnpm test && pnpm build && pnpm test:e2e` (cwd `frontend/`), **with `frontend/.env.local` present** (the 6 `NEXT_PUBLIC_FIREBASE_*` values). E2E runs entirely on the **emulators** — no real Google account, no SMS, no secret key. Frontend-only — **no `uv`, no backend**. |
| **Phase-12 gate** | Same shape as Phase 6/11: `pnpm install && pnpm test && pnpm build && pnpm test:e2e` (cwd `frontend/`), with `frontend/.env.local` present. **No new dependency, no new env var.** `pnpm test` additionally covers the Phase-12 rollup/format/queries units (see [roadmap Phase 12](roadmap.md#phase-12--pilot-readiness-first-cross-bill-figures--the-fast-default-path)); `pnpm build` type-checks the new `/rollup` route and every new EN+HI i18n key. |
| **Phase-12 scoped gate (while iterating)** | A full E2E pass is ~30–40 min, so iterate on the subset and run the full suite **once** before finalising the PR: `pnpm test && pnpm build`, then `firebase emulators:exec --only auth,firestore --project demo-anaj-bahi --config ../firebase.json "playwright test tests/e2e/auth-onboarding.spec.ts tests/e2e/ledger-journey.spec.ts tests/e2e/pilot-readiness.spec.ts tests/e2e/post-save-share.spec.ts tests/e2e/purchase-journey.spec.ts tests/e2e/quick-bill-journey.spec.ts tests/e2e/receipt-share.spec.ts"` (cwd `frontend/`). The full `pnpm test:e2e` is still the binding gate. |

**`package.json` deps to add (owned by Phase-6 slice-a):** `firebase` (^11) in `dependencies`; `firebase-tools` in `devDependencies` (emulator runner for E2E). **`firebase-admin` is NOT needed** (emulator reset is a REST call).

### ~~Phase-4 backend commands (cwd `backend/`)~~ — SUPERSEDED / REMOVED (Phase 7)

> **Historical.** The FastAPI + SQLite backend, its `uv` toolchain, and all commands below are **removed in Phase 7** (Firebase replaces cloud sync). Retained only so the shipped-Phases-1–5 record stays readable. Do not build against these for the redesign.

### ~~Original Phase-4 backend commands (cwd `backend/`)~~

> **Phase 4 is the FIRST phase to require `.env`** — backend only. The frontend never gets build-time secrets (see the sync-config note below). All commands below run with working directory **`backend/`**.

| Command | Value |
|---------|-------|
| Package/dependency manager | `uv` (cwd `backend/`) |
| Install | `uv sync` (cwd `backend/`) |
| Create / init the SQLite DB | `uv run python -m app.init_db` — runs `Base.metadata.create_all(engine)`, creating the file at `DATABASE_URL` (default `data/anaj.db`). Idempotent. |
| Run the API | `uv run uvicorn app.main:app --port 8000` (cwd `backend/`) |
| Backend port | `8000` |
| Health path | `GET /health` → `{ "status": "ok" }` (no auth) |
| Backend test command | `uv run pytest` (cwd `backend/`) — runs against a **real on-disk temp SQLite file** per test (e.g. a `tmp_path`-based `data/*.db`), **not** an in-memory `:memory:` DB, so file-DB behaviour (persistence, connection handling) is exercised. |
| Env | `backend/.env` (gitignored) supplies `DATABASE_URL` + `DEVICE_TOKEN`; `backend/.env.example` documents them. |

| Key library | Version | Purpose |
|-------------|---------|---------|
| next | 15.3.x | App Router, static export, PWA host |
| react / react-dom | 19.x | UI |
| tailwindcss | 4.x | Styling (already present) |
| dexie | ^4 | IndexedDB wrapper (schema, indexes, queries) |
| dexie-react-hooks | ^1 | `useLiveQuery` for reactive list/detail reads |
| vitest | ^2 | Unit tests (calc + repo) |
| fake-indexeddb | ^6 | IndexedDB in unit tests |
| @vitejs/plugin-react + jsdom | latest | Vitest React/DOM env |
| @playwright/test | ^1.6 | E2E of the primary journey |
| html-to-image | ^1 | (Phase 3) DOM → PNG for the receipt |

**Avoid:** no `next-pwa` (hand-write the service worker for Next 15 App-Router static export reliability); no heavy i18n framework; no ORM/SQLite on the device (IndexedDB via Dexie is the local store); no backend/`.env`/keys in Phases 1–3.

## Deployment Model

Static export (`frontend/out/`) served as plain files under a `basePath` — installable to the Android home screen and fully functional offline. **No backend to deploy** — Firebase Auth + Cloud Firestore (operated by Google) are the only cloud; the Phase-4 FastAPI + SQLite backend was removed in Phase 7.

**Concrete targets** (copy-paste steps in [`../DEPLOY.md`](../DEPLOY.md)):

- **Frontend → GitHub Pages** (repo `anaj-bahi`) at `https://singhalvivek.github.io/anaj-bahi/`. The `basePath` is parameterized by `NEXT_PUBLIC_BASE_PATH` (default `/app`; production `/anaj-bahi`). The workflow `.github/workflows/deploy-pages.yml` runs `pnpm build:pages` with `NEXT_PUBLIC_BASE_PATH=/anaj-bahi`, adds `.nojekyll`, and publishes `frontend/out/`. The postbuild `scripts/apply-base-path.mjs` rewrites the `/app` literals in the exported `manifest.webmanifest`/`sw.js` (a no-op at the default `/app`, so local dev + E2E are untouched). The 6 `NEXT_PUBLIC_FIREBASE_*` web-config values are supplied as **GitHub repo secrets** at build time; `singhalvivek.github.io` must be a Firebase **authorized domain**.
- **Firebase (no infra we run):** Auth (**Google** provider, with a support email; add `singhalvivek.github.io` to Authorized domains) + Cloud Firestore, **free Spark tier — no Blaze**. `firestore.rules` (repo root) is published via the console or `firebase deploy --only firestore:rules`.

### PWA updates & per-deploy versioning

The app is a long-lived installed PWA that must **auto-update without ever losing data**. Data lives in **IndexedDB** (Firestore `persistentLocalCache`, including offline-unsynced writes); the service worker (`public/sw.js`) only caches the app **shell** and never touches IndexedDB, so updating cannot lose data — synced or not.

- **Service-worker strategy:** page navigations are **network-first** (fetch the latest online; fall back to cache only offline) so a new deploy appears on the next online open; content-hashed static assets are **cache-first**; `activate` deletes only our own older shell caches (prefix `anajbahi-shell-`), with `skipWaiting` + `clients.claim`. The SW is **disabled in `pnpm dev`** (`SwRegister` registers it only in production) so local iteration never serves stale code.
- **Per-deploy version = the git short hash of the deployed commit.** `build:pages` runs `scripts/gen-version.mjs` (pre → sets `NEXT_PUBLIC_APP_VERSION` = `<shortHash> · <date>`, inlined and shown in **Settings**) and `scripts/stamp-sw.mjs` (post → stamps the exported `out/sw.js` `CACHE_VERSION` to `anajbahi-shell-<shortHash>`). So **every PR/deploy is a new commit → a new version → a byte-different service worker** the browser re-installs (clearing the old shell cache): the app self-updates and the visible version bumps automatically. Plain `pnpm build` (the E2E gate) is left **unstamped/unchanged**.
- **Manual control:** Settings has an **"Update app"** button (`lib/pwa.ts` `updateApp()`) that checks for a new worker, activates a waiting one, and reloads — data-safe (shell only).

---

## Phase-1 module contract (slice-a)

> These signatures are **frozen** so slices B and C compile against them in parallel without waiting for slice-a's implementation. Types and rules are detailed in [data.md](data.md).

### `lib/calc/index.ts` (pure, no I/O)

```ts
export type DeductionBasis = 'per_sack_kg' | 'per_quintal_kg' | 'percent_gross' | 'flat_kg'
export interface Deduction { basis: DeductionBasis; value: number }

export interface GrainLineInput {
  pricePerQuintal: number      // ₹ per 100 kg
  sackWeights: number[]        // kg, in entry order (may be decimal)
  deductions: Deduction[]      // zero or more, applied additively
}

export interface GrainLineTotals {
  sackCount: number            // sackWeights.length
  grossWeightKg: number        // sum of sackWeights
  deductionKg: number          // sum of resolved deductions, kg (>= 0)
  netWeightKg: number          // max(0, gross - deductionKg)
  amount: number               // ₹, netQuintals * price, rounded to 2 dp
}

export function resolveDeductionKg(d: Deduction, grossKg: number, sackCount: number): number
export function computeGrainLine(line: GrainLineInput): GrainLineTotals
export function computeBillTotal(lines: GrainLineInput[]): number   // sum of line amounts, 2 dp
export function roundRupees(amount: number): number                 // round half-up to 2 dp
```

### `lib/db/repo.ts` + `lib/db/schema.ts` (only layer touching IndexedDB)

```ts
export interface Farmer { id: string; name: string; place: string; phone?: string; createdAt: number }
export interface GrainType { id: string; nameEn: string; nameHi: string; isCustom: 0 | 1; createdAt: number }
export interface StoredDeduction { basis: DeductionBasis; value: number }
export interface StoredGrainLine {
  id: string; grainTypeId: string; pricePerQuintal: number
  sackWeights: number[]; deductions: StoredDeduction[]
}
export interface Payment { id: string; amount: number; date: string; note?: string; createdAt: number } // Phase 2
export interface Bill {
  id: string                  // "DDMMYY/xxxxx"
  farmerId: string
  farmerName: string          // denormalised (search)
  farmerPlace: string         // denormalised (search)
  purchaseDate: string        // ISO "yyyy-mm-dd"
  grainTypeIds: string[]      // denormalised, multiEntry index (search)
  lines: StoredGrainLine[]
  dueDate?: string            // Phase 2
  payments: Payment[]         // Phase 2 (empty [] in Phase 1)
  createdAt: number
  updatedAt: number
}

// farmers
export function listFarmers(): Promise<Farmer[]>
export function searchFarmers(prefix: string): Promise<Farmer[]>        // name startsWithIgnoreCase
export function getFarmer(id: string): Promise<Farmer | undefined>
export function upsertFarmer(input: Omit<Farmer, 'id' | 'createdAt'> & { id?: string }): Promise<Farmer>

// grain types
export function listGrainTypes(): Promise<GrainType[]>
export function addCustomGrainType(nameEn: string, nameHi: string): Promise<GrainType>
export function ensureSeeded(): Promise<void>                            // idempotent seed on first run

// bills
export function createBill(input: Omit<Bill, 'createdAt' | 'updatedAt'>): Promise<Bill>
export function getBill(id: string): Promise<Bill | undefined>
export function listBills(): Promise<Bill[]>                             // Phase 1: all, newest first
export function updateBill(bill: Bill): Promise<Bill>                    // Phase 1: allowed (no payments yet)
```

### `lib/db/id.ts`

```ts
// "DDMMYY/xxxxx": date part from `date`, xxxxx = 5-char [a-z0-9] from crypto.getRandomValues.
// Regenerates on collision against existing bill ids.
export function generateBillId(date: Date, exists: (id: string) => Promise<boolean>): Promise<string>
```

### `lib/i18n/context.tsx`

```ts
export type Lang = 'hi' | 'en'
export function I18nProvider(props: { children: React.ReactNode }): JSX.Element
export function useI18n(): { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string }
// `lang` persisted to localStorage key "anajbahi.lang"; default 'hi'.
```

---

## Quick-entry (summary) bills — frozen additions (Phase 5)

> **Additive and back-compatible.** All Phase-1 signatures above are unchanged. Slices build against these frozen shapes in parallel (foundation slice-a implements them; slices b/c compile against them). See [quick-bill-entry](capabilities/quick-bill-entry.md) and [data.md § Summary grain lines](data.md#summary-grain-lines-quick-entry).

### `lib/db/schema.ts` — extended types (optional fields only)

```ts
export type BillEntryMode = 'sacks' | 'summary'

export interface GrainLineSummary {
  totalWeightKg: number     // gross, one number (not per sack)
  sackCount?: number        // optional integer count, no per-sack weights
  deductionKg?: number      // optional single total-kg deduction
  amount: number            // ₹ entered verbatim from the paper bill — AUTHORITATIVE
}

// StoredGrainLine gains ONE optional field; existing fields unchanged.
export interface StoredGrainLine {
  id: string
  grainTypeId: string
  pricePerQuintal: number
  sackWeights: number[]        // 'summary' lines: []
  deductions: StoredDeduction[] // 'summary' lines: []
  summary?: GrainLineSummary   // present iff the bill is entryMode 'summary'
}

// Bill gains ONE optional field; absent → 'sacks' (back-compat).
export interface Bill { /* …all Phase-1 fields… */ entryMode?: BillEntryMode }
```

`repo.createBill` / `updateBill` need **no logic change** — Dexie persists the extra optional fields verbatim, and the Phase-4 sync serialises the whole bill as JSON (backend stores it opaquely), so summary bills round-trip through IndexedDB and cloud sync with no backend change.

### `lib/calc/index.ts` — additive dispatch (existing signatures unchanged)

```ts
export interface SummaryFigures {          // == GrainLineSummary, structurally
  totalWeightKg: number
  sackCount?: number
  deductionKg?: number
  amount: number
}

// GrainLineInput gains an OPTIONAL discriminant:
export interface GrainLineInput {
  pricePerQuintal: number
  sackWeights: number[]
  deductions: Deduction[]
  summary?: SummaryFigures                 // present → summary line
}

// gross = totalWeightKg; deductionKg = deductionKg ?? 0; net = max(0, gross − ded);
// sackCount = sackCount ?? 0; amount = roundRupees(amount)  // ENTERED, not net×price
export function computeSummaryLine(pricePerQuintal: number, s: SummaryFigures): GrainLineTotals

// computeGrainLine DISPATCHES: line.summary present → computeSummaryLine; else the
// existing sacks path. computeBillTotal is UNCHANGED (Σ computeGrainLine(line).amount)
// and thus summary-aware. Every existing consumer (home totals, detail, receipt,
// billBalance → payments/outstanding/due) keeps working for BOTH modes with no
// call-site change. Sacks bills only take the sacks path → provably unaffected.
```

### Routes & navigation

| Route | Purpose | testids |
|-------|---------|---------|
| `/bills/choose` (new) | Two-option chooser; `+ New Bill` retargets here | `new-bill-choice`, `choice-fresh`→`/bills/new`, `choice-quick`→`/bills/quick` |
| `/bills/new` (unchanged) | Fresh sack-by-sack form; still handles `?edit=<id>` for sacks bills | (existing) |
| `/bills/quick` (new) | Summary quick-entry form; handles `?edit=<id>` for summary bills | `save-bill` (reused), `total-weight-input`, `amount-input`, `sack-count-input`, `deduction-kg-input` |

Bill Detail's Edit link branches on `entryMode`: `'summary'` → `/bills/quick?edit=`, else `/bills/new?edit=`.

---

## Phase-4 sync contract — ⚠️ SUPERSEDED (removed in Phase 7)

> **This entire section is historical.** The FastAPI + SQLite sync backend it describes is **replaced by Firebase** (Auth + Firestore) in Phases 6–9 and its code (`backend/`, `frontend/src/lib/sync/*`, `SyncSettings`) is **removed in Phase 7**. Read the [§ Firebase multi-tenant redesign — frozen contracts](#firebase-multi-tenant-redesign-phases-69--frozen-contracts) instead. Kept only as the record of what shipped in Phases 1–5.

> **Frozen (Phases 1–5 record).** Backend (slice-a) and frontend (slices b/c) built against this — the wire shapes, auth, storage model, and the frontend `lib/sync` API below did not change during the Phase-4 build. Backend was **FastAPI + SQLite**; the local IndexedDB store always remained the device source of truth.

### Auth

- Every `/sync/*` endpoint **requires** header `Authorization: Bearer <DEVICE_TOKEN>`. Missing or wrong token → **HTTP 401**.
- `GET /health` requires **no auth**.
- The authoritative token lives in `backend/.env` as `DEVICE_TOKEN`. The user types the **same** token into the PWA Settings screen (see Frontend sync config).

### Endpoints

| Method | Path | Auth | Request body | Response |
|--------|------|------|--------------|----------|
| GET | `/health` | none | — | `{ "status": "ok" }` |
| POST | `/sync/push` | Bearer | `{ bills: Bill[], farmers: Farmer[], grainTypes: GrainType[], profile: BusinessProfile \| null }` | `{ "ok": true, "counts": { "bills": n, "farmers": n, "grainTypes": n, "profile": 0\|1 } }` |
| GET | `/sync/pull` | Bearer | — | `{ bills: Bill[], farmers: Farmer[], grainTypes: GrainType[], profile: BusinessProfile \| null }` |

- **Payments** are embedded inside each `Bill` (`Bill.payments[]`, see [data.md](data.md)/[Phase-1 module contract](#phase-1-module-contract-slice-a)); pushing bills therefore carries their payments — there is no separate payments endpoint.
- `/sync/pull` returns **all data for the device** and is what **restore** uses.

### CORS (required — cross-origin)

- The static-export PWA (`http://localhost:3000`) and the FastAPI backend (`http://localhost:8000`) are **deliberately different origins**, so the backend **MUST enable CORS** (`Access-Control-Allow-Origin`) or the browser blocks every `/sync/*` fetch and its preflight.
- The backend enables **permissive CORS** — `allow_origins=["*"]`, all methods, all headers. This is safe because auth is a Bearer **device token** (no cookies / no credentialed requests), so a wildcard origin exposes nothing.

### Upsert / merge semantics (idempotent)

- **Bills:** upsert keyed by client `id` with **last-write-wins by `updatedAt`** — an incoming bill replaces the stored row only if its `updatedAt` is **≥** the stored `updated_at`; older incoming bills are ignored.
- **Farmers & grain types:** no `updatedAt` field → upsert-by-`id`, **last push wins** (incoming replaces stored).
- **Profile:** singleton — store the latest pushed `profile` (a `null` profile is a no-op, never deletes an existing one).
- **Idempotent:** re-pushing the identical payload is a safe no-op (same ids, `updatedAt` not newer → no change). `counts` reflects rows received, not rows changed.

### Backend storage model (chosen)

Schema-light, one row per record keyed by the client `id`, storing `updated_at` + the record verbatim as JSON, so the server round-trips the exact frontend shapes without re-modelling them:

| Table | Columns |
|-------|---------|
| `bills` | `id` TEXT PK, `updated_at` INTEGER, `data` JSON (the full `Bill`, payments embedded) |
| `farmers` | `id` TEXT PK, `data` JSON (the full `Farmer`) |
| `grain_types` | `id` TEXT PK, `data` JSON (the full `GrainType`) |
| `profile` | `id` TEXT PK (constant, e.g. `"singleton"`), `data` JSON (the `BusinessProfile`) |

`/sync/pull` returns each table's `data` JSON as the respective array (and the singleton `profile` row's `data`, or `null` if none).

### Frontend sync config (user-entered, not build-time env)

Because the PWA is a **static export**, the backend **base URL** and **device token** are **entered by the user in the Settings screen** and stored locally in the Dexie **`meta`** table — **not** a build-time env var — so no rebuild is needed to point at a backend. (This mirrors the profile store already in `meta` from Phase 3.)

### Frozen frontend sync API — `frontend/src/lib/sync`

> slice-c builds against these signatures while slice-b implements them.

```ts
export interface SyncConfig { baseUrl: string; token: string }
export interface SyncState { lastSyncedAt: number | null; pendingCount: number; lastError: string | null }

export type SyncErrorKind = 'auth' | 'network' | 'config' | 'unknown'
export interface SyncResult { ok: boolean; counts?: Record<string, number>; error?: SyncErrorKind }

export function getSyncConfig(): Promise<SyncConfig | null>           // from Dexie `meta`
export function saveSyncConfig(cfg: SyncConfig): Promise<void>        // to Dexie `meta`

// NEVER throws — returns { ok:false, error } on failure so the UI never crashes and offline is graceful.
export function syncNow(): Promise<SyncResult>    // push local snapshot to /sync/push; idempotent; { ok:true, counts } on success
export function getSyncState(): Promise<{ lastSyncedAt: number | null; pendingCount: number; lastError: string | null }>

// restore throws TYPED errors (SyncAuthError / SyncNetworkError; plain Error if unconfigured) — callers handle them.
export function restoreFromCloud(): Promise<void> // GET /sync/pull → write all records into local Dexie

// Auto-flush: an `online`-event listener calls syncNow() when connectivity returns.
export function startAutoSync(): () => void       // registers the `online` listener → syncNow(); returns an unsubscribe fn; safe when unconfigured
```

- **`syncNow` never throws** — on failure it resolves to `{ ok:false, error }` with `error` one of `'auth' | 'network' | 'config' | 'unknown'`, so the UI never crashes and offline is graceful; on success it resolves to `{ ok:true, counts }` (the push response `counts`). `restoreFromCloud` **does** throw typed errors (`SyncAuthError` / `SyncNetworkError`; plain `Error` if unconfigured). `startAutoSync` is a no-op-safe listener even when sync is unconfigured.
- **Pending** = local records changed since `lastSyncedAt`, **deduped by `id`** (a record edited twice counts once). Offline-safe: sync **never blocks the UI, never loses a record, never duplicates** (idempotent push + `updatedAt` last-write-wins).

### `backend/.env` (gitignored) — documented by `backend/.env.example`

```dotenv
DATABASE_URL=sqlite:///./data/anaj.db
DEVICE_TOKEN=change-me-to-a-long-random-string
```

`backend/.env` is **gitignored**; only `backend/.env.example` (with these keys) is committed. `DATABASE_URL` points at the local SQLite file (created by `app.init_db`); `DEVICE_TOKEN` is the bearer token the user also enters in Settings.

---

## Firebase multi-tenant redesign (Phases 6–9) — frozen contracts

> **All contracts in this section are frozen** so the Phase-6 slices build in parallel on disjoint paths (and Phases 7–9 extend them). Identity is the **Firebase `uid`** (stable per Google account, cross-device); one person belongs to **exactly one business**; all business data is **business-scoped** in Firestore. There is **no server we run** and **no AI/LLM** — Firebase Auth (Google) + client-side Firestore replace the retired FastAPI backend. Product-narrative detail lives in the capability files; the shapes and signatures live here.

### Component map (Firebase era)

```
                 ┌─────────────────────────────────────────────────────┐
                 │  Next.js PWA (static export, basePath /app)          │
  Trader ──tap──►│  React client components (App Router)                │
                 │        │                     ▲                       │
                 │        ▼                     │                       │
                 │  lib/auth (AuthProvider / useAuth) ── Google popup ──┼──► Firebase Auth
                 │        │  status: signed-out│onboarding│ready        │    (Google, LOCAL persistence)
                 │        ▼                     │                       │
                 │  AuthGate ─ signed-out→Login │ onboarding→Onboarding │
                 │            │ ready→ the app  │                       │
                 │            ▼                                         │
                 │  lib/tenancy (createBusiness / invites / claimInvite)│
                 │  lib/db/repo (business-scoped) ── onSnapshot/writes ─┼──► Cloud Firestore
                 │  lib/calc (pure math, UNCHANGED)                     │    (IndexedDB offline cache = the store)
                 │  lib/i18n (Hindi/English, UNCHANGED)                 │    Security Rules enforce roles
                 │  service worker — app shell (UNCHANGED)              │
                 └─────────────────────────────────────────────────────┘
```

The `lib/calc`, `lib/i18n`, PWA shell, and all bill-form/receipt UI are **retained unchanged**; only the **data-access layer** (`lib/db/repo`) is re-pointed from Dexie to Firestore, and a new **auth/session** + **tenancy** layer is added in front of the app.

### Firestore data model — frozen collection-path map

phoneKey rule: **E.164 with the leading `+` stripped** (digits only). `+911111111111` → `911111111111`. Used **only** to match the mobile an employee enters against the mobile the owner put on the invite — **never** an identity/document key for users. Identity is the Firebase `uid`.

| Path | Doc id | Purpose | Access (Security Rules) |
|------|--------|---------|-------------------------|
| `users/{uid}` | Firebase Auth uid | The signed-in user's own record; **the sole basis for routing on sign-in** (`bizId` set → `ready`; else → onboarding). Fields: `{ uid, email, phone (E.164, set at onboarding), displayName, bizId \| null, role: 'owner'\|'partner'\|'employee' \| null, createdAt, updatedAt }` | read/write only when `uid == request.auth.uid` |
| `invites/{code}` | one-time share **code** (6 uppercase chars, ambiguity-safe alphabet — no `O/0/I/1`) | **Manager-generated invite** (an owner **or a partner** mints it). The manager creates it from the new member's **mobile alone** plus a chosen **role (`employee` or `partner`)** and shares the **code + mobile** out-of-band; the member redeems it at first run, and their name is captured then from their Google login. Fields: `{ code, bizId, role: 'employee'\|'partner', assignedPhone (E.164), phoneKey (normalized digits), displayName (blank until claim), addedByUid, addedByName, status: 'unused'\|'claimed', claimedByUid \| null, createdAt (number), claimedAt (number \| null) }` | **get** (by-id, the code is a secret): any signed-in user; **list** (enumerate): a **manager** (`canManage`) of `resource.data.bizId` only — so no one can enumerate another business's invites; **create/delete:** a **manager** of the business (create requires `role in ['employee','partner']`); **update:** a **manager**, OR the single-use `unused → claimed` transition stamped with `claimedByUid == request.auth.uid`. See [§ Security Rules — hardened invites + members model](#security-rules--hardened-invites--members-model-code-generator-edits-firestorerules) |
| `businesses/{bizId}` | uuid | The business + its **business profile**. Fields: `{ id, shopName, traderName, phone, address?, createdByUid, createdByName, createdAt, updatedAt }` | read: any member of `bizId`; **write: an owner of `bizId` only** (business-profile writes stay owner-only — a partner does **not** get this) |
| `businesses/{bizId}/members/{uid}` | member uid | Per-business member (for in-app roster + rule membership checks — the **role source** for the rules). Fields: `{ uid, phone, displayName, role: 'owner'\|'partner'\|'employee', addedByUid, addedByName, addedAt, status, inviteCode (string \| null — the code used at claim; null/omitted for the owner's own doc), phoneKey (normalized digits of the claimed mobile; owner: from own onboarding mobile) }` | read: any member; **create:** self **only** via the owner-bootstrap arm (role `owner` **and** the business does not yet exist) or the claim arm (role `employee`/`partner` referencing a matching **unused** `invites/{inviteCode}` tying `bizId` + `phoneKey` **and the same `role`**), OR a **manager** writing the roster; update: an **owner** or self; **delete:** a **manager** (`canManage`) whose target's `role != 'owner'` (owners are never removable — a partner can never remove an owner) |
| `businesses/{bizId}/bills/{billId}` | `DDMMYY/xxxxx` | Shared bill ledger (same `Bill` shape as [data.md](data.md); Phase 8 adds `createdBy` attribution snapshot) | read/write: any member of `bizId` (edit-lock still applies) |
| `businesses/{bizId}/farmers/{farmerId}` | uuid | Shared farmers | read/write: any member of `bizId` |
| `businesses/{bizId}/grainTypes/{grainTypeId}` | slug/uuid | Shared grain types (seeded + custom) | read/write: any member of `bizId` |
| `businesses/{bizId}/activity/{activityId}` | uuid | **Append-only** activity log (bill-create, payment, edit/delete) — `{ id, type, billId?, actorUid, actorPhone, actorName (snapshot), at, summary }` | **read: MANAGERS only** (owner or partner, `canManage`); write (create-only): any member; no update/delete |

> **Name snapshots (attribution survives renames/removal):** `displayName`/`createdByName`/`actorName`/`addedByName` are **snapshots written at the time of the action**, never a live join to `users`. So an activity entry or a bill's `createdBy` still shows who did it even after that person renames themselves or is removed from the business.

> **Role tag visibility (UI):** a member's role (Owner / Partner / Employee) is surfaced in **exactly one place** — the **Members roster** on the Members screen, reachable only by managers (owner or partner). The Settings identity strip (`home-role`) and the Settings personal profile (`personal-role`) **no longer show any role badge**, for owners, partners, and employees alike. An employee therefore never sees an owner/partner tag anywhere. See [employee-management](capabilities/employee-management.md) / [personal-profile](capabilities/personal-profile.md).

> **Three roles + partner scope:** `role ∈ 'owner' | 'partner' | 'employee'`. A **partner** is a co-owner with **owner powers minus removing an owner and minus editing the business profile** — concretely: CAN add members (employees and partners) via invite codes, read all activity, and remove employees and other partners; CANNOT remove/downgrade an owner or write `businesses/{bizId}` (business-profile edits stay owner-only). A partner exists **only** by an owner/partner inviting them with the Partner role — there is no self-serve partner onboarding. The rules encode this with an `isPartner(bizId)` helper and `canManage(bizId)` = `isOwner(bizId) || isPartner(bizId)`.

> **One-person-one-business** is enforced by the **`uid`**: once `users/{uid}.bizId` is set, sign-in routes the user straight to `ready` and they **never re-enter onboarding**, so they can never reach the create-business form or the join-by-code screen to acquire a second business. A user already in a business therefore cannot redeem an invite code (they never see JoinByCode). No phone-keyed lookup is involved.

### Security Rules — hardened `invites` + `members` model (code-generator edits `firestore.rules`)

The `firestore.rules` file replaces its old `match /memberships/{phoneKey}` block with a `match /invites/{code}` block **and hardens the `members/{uid}` block** to close a tenant-isolation hole (an earlier draft's `read: signedIn()` granted LIST — letting any signed-in user enumerate every business's invites — and the old members `create` let any signed-in user self-create an `owner` member for **any** bizId, since the phone/invite match was only client-side; net = cross-tenant owner escalation). The `users`, `businesses` (profile write), and `bills`/`farmers`/`grainTypes` blocks are **UNCHANGED**; the `isMember` / `isOwner` / `isSelf` helpers are unchanged.

**Two new helpers** are added and the `invites`, `members`-delete, and `activity`-read boundaries widen from owner-only to **manager (owner-or-partner)**:

```
// role source is the caller's own members/{uid} doc within the business:
function isPartner(bizId) {
  return isMember(bizId)
    && get(/databases/$(database)/documents/businesses/$(bizId)/members/$(request.auth.uid)).data.role == 'partner';
}
function canManage(bizId) { return isOwner(bizId) || isPartner(bizId); }  // owner OR partner
```

The design is **claim/create-bootstrap-safe under a single client `writeBatch`**: Firestore rules only see **committed** state during a batch, so each write in the batch is evaluated against the pre-batch snapshot. The `members`-create rule reads the invite's still-`'unused'` committed state, while the `invites`-update rule enforces the `unused → claimed` single-use transition — the two writes are therefore mutually consistent and cannot be replayed.

```
// GET is by-id (the code is a shared secret a member reads pre-membership); LIST is manager-only,
// so no one can enumerate another business's invites. Only a MANAGER (owner or partner) mints/cancels;
// create must carry role in ['employee','partner']. The sole non-manager write is the single-use
// unused→claimed transition, stamped with the claimer's own uid.
match /invites/{code} {
  allow get:    if signedIn();
  allow list:   if signedIn() && canManage(resource.data.bizId);
  allow create: if signedIn() && canManage(request.resource.data.bizId)
                   && request.resource.data.role in ['employee', 'partner'];
  allow update: if signedIn() && (
    canManage(resource.data.bizId) ||
    ( resource.data.status == 'unused'
      && request.resource.data.status == 'claimed'
      && request.resource.data.claimedByUid == request.auth.uid )
  );
  allow delete: if signedIn() && canManage(resource.data.bizId);
}

match /businesses/{bizId} {
  // …businesses (profile write = isOwner, UNCHANGED) / bills / farmers / grainTypes unchanged…
  // activity read widens to managers (see below).
  match /members/{uid} {
    allow read: if isMember(bizId);
    // Self-create is tightly gated to two legitimate bootstraps, else a MANAGER writes roster docs:
    allow create: if signedIn() && request.auth.uid == uid && (
      // owner bootstrap — ONLY while the business does not yet exist in committed state (the create
      // batch), which blocks self-owning an already-existing business:
      ( request.resource.data.role == 'owner'
        && !exists(/databases/$(database)/documents/businesses/$(bizId)) )
      ||
      // employee/partner claim — gated on a REAL matching UNUSED invite (by code), tying bizId +
      // phoneKey AND the same role (an invite for 'employee' can only mint an 'employee' member, etc.):
      ( request.resource.data.role in ['employee', 'partner']
        && exists(/databases/$(database)/documents/invites/$(request.resource.data.inviteCode))
        && get(/databases/$(database)/documents/invites/$(request.resource.data.inviteCode)).data.bizId == bizId
        && get(/databases/$(database)/documents/invites/$(request.resource.data.inviteCode)).data.phoneKey == request.resource.data.phoneKey
        && get(/databases/$(database)/documents/invites/$(request.resource.data.inviteCode)).data.role == request.resource.data.role
        && get(/databases/$(database)/documents/invites/$(request.resource.data.inviteCode)).data.status == 'unused' )
    ) || canManage(bizId);
    allow update: if isOwner(bizId) || isSelf(uid);
    // A manager may remove any NON-owner member (employee or partner). Owners are never removable
    // through the roster, so a partner can never remove an owner and owner-to-owner removal stays out:
    allow delete: if canManage(bizId) && resource.data.role != 'owner';
  }
}

// activity read widens from owner-only to manager (owner or partner); write/append unchanged:
// allow read: if canManage(bizId);  (create-only append: any member; no update/delete)
```

To satisfy the claim rule, the **`members/{uid}` doc carries `inviteCode` + `phoneKey` + `role`** written at claim time (see the collection-path map), and the invite's `role` must equal the member doc's `role`. `createBusiness`'s owner member doc has `inviteCode: null` (or omitted) and `role: 'owner'`; its create passes the owner-bootstrap arm because `businesses/{bizId}` does not yet exist in committed state when the batch is evaluated. `claimInvite`'s single `writeBatch` — invite `unused→claimed` + `members/{uid}{…, inviteCode, phoneKey, role: invite.role}` + `users/{uid}{…, role: invite.role}` — commits atomically and is rules-safe by the mutual-consistency argument above.

**Business-profile writes stay owner-only:** the `businesses/{bizId}` `update`/`write` rule remains `isOwner(bizId)` — a partner does **not** get it. Partner parity is scoped to `invites` (create/list/delete), `members` delete (non-owner targets), and `activity` read.

**Rules-unit test (required, `@firebase/rules-unit-testing`) must prove:** (1) a signed-in **non-manager (employee) cannot LIST** invites, but a **partner can**; (2) a signed-in user **cannot self-create an `owner`** member on an **already-existing** business; (3) a user **cannot claim-create** an `employee` **or** `partner` member without a matching **unused** invite, with a **mismatched `phoneKey`**, or with a **role that differs from the invite's role**; (4) the legit **owner-create** (fresh business), **employee-claim**, and **partner-claim** (matching unused invite of the same role) paths still **succeed**; (5) a **partner can delete** an employee member **and** another partner member, but **cannot delete an owner** member; (6) an **owner can delete a partner** member; (7) a **partner cannot write `businesses/{bizId}`** (business profile stays owner-only); (8) a **partner can read `activity`**, an **employee cannot**.

**These rules must be published** by the user (Firebase console or `firebase deploy --only firestore:rules`).

### Auth / session contract — `lib/auth`

`lib/firebase/app.ts` initializes the SDK from `NEXT_PUBLIC_FIREBASE_*` and exports `app`, `auth`, and `firestore` (Firestore with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`; auth uses `browserLocalPersistence`). When `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1` it also calls `connectAuthEmulator(auth, 'http://127.0.0.1:9099')` + `connectFirestoreEmulator(firestore, '127.0.0.1', 8080)`. **No reCAPTCHA verifier and no `#recaptcha-container` are created anywhere** — those are removed with SMS/OTP.

```ts
// lib/auth/session.ts (thin wrappers over firebase/auth; no React)
export interface AppUser {
  uid: string
  email: string | null          // from Google; stored on users/{uid}
  phone: string | null          // E.164, captured at onboarding — PROFILE DATA, not an auth factor
  displayName: string | null
  bizId: string | null
  role: 'owner' | 'partner' | 'employee' | null
}
// GoogleAuthProvider + signInWithPopup; LOCAL persistence. Throws a mapped, translatable AuthError.
export function signInWithGoogle(): Promise<void>
export function signOutUser(): Promise<void>
// cb receives the Google identity fields on sign-in, null on sign-out.
export function onFirebaseAuthChange(
  cb: (u: { uid: string; email: string | null; displayName: string | null } | null) => void,
): () => void

// lib/auth/context.tsx (the surface the UI consumes)
export type AuthStatus = 'loading' | 'signed-out' | 'onboarding' | 'ready'
export interface AuthContextValue {
  status: AuthStatus
  user: AppUser | null                                   // set while signed-in (onboarding or ready)
  signInWithGoogle(): Promise<void>                      // Google popup; loads/creates users/{uid}; sets status
  setDisplayName(name: string): Promise<void>            // onboarding step 1 (persists to users/{uid}); prefilled from Google
  chooseOnboardingPath(choice: 'create' | 'join'): Promise<import('./membership').RoleRoute>  // role-free: 'New business' → create; 'Business already registered' → join
  createOwnerBusiness(input: import('../tenancy/business').NewBusinessInput): Promise<void> // createBusiness + seed the local BusinessProfile (shopName/traderName/phone) so Settings + receipt header show it; → status 'ready'
  joinByCode(input: { code: string; phoneE164: string; name: string }): Promise<void> // claim invite (role — employee|partner — taken from the invite) → status 'ready'
  signOut(): Promise<void>
}
export function AuthProvider(props: { children: React.ReactNode }): JSX.Element
export function useAuth(): AuthContextValue
```

Routing rule the `AuthGate` implements from `status`: `loading` → splash; `signed-out` → `<LoginScreen/>` (a single **Continue with Google** button); `onboarding` → `<OnboardingFlow/>` (name → **role-free** onboarding-path chooser: **New business** → create-business (becomes owner) | **Business already registered** → join-by-code (role from the invite)); `ready` → the app (`{children}`) with the gated home header. **No new App-Router routes** — the gate swaps surfaces by conditional rendering (static-export-safe). Session persists across reloads (LOCAL persistence); on reload `status` resolves **purely from `users/{uid}.bizId`** without re-sign-in (no phone lookup).

> **Removal-safety:** because recognition is now purely `users/{uid}.bizId`, a member an owner removed still has their `bizId` set but is no longer in `businesses/{bizId}/members`. When the AuthProvider resolves a user with a `bizId`, it confirms the `members/{uid}` doc still exists; if it is gone (removed), it clears the user's own `users/{uid}.{bizId, role}` (a permitted self-write) and returns them to onboarding rather than leaving them stuck at a `ready` screen whose reads the rules reject.

### Role routing + invite logic — `lib/auth/membership.ts` (pure, unit-tested)

Recognition of returning users happens **before** onboarding (via `users/{uid}.bizId`), so the role chooser only routes a genuinely-new user to the correct onboarding sub-screen. The invite-check and code-generation logic are pure and unit-tested (they are what the JoinByCode and Generate-code flows call).

```ts
export type Role = 'owner' | 'partner' | 'employee'

// Onboarding is ROLE-FREE — the chooser is a trivial 2-way route on the create-vs-join CHOICE (no
// role is named or picked; no phone lookup — one-person-one-business is enforced upstream because a
// user with a bizId never reaches onboarding at all):
export type RoleRoute = { kind: 'create' } | { kind: 'join' }
export function routeOnboarding(choice: 'create' | 'join'): RoleRoute
//   'create' ('New business')                → { kind: 'create' }  (creator becomes owner)
//   'join'   ('Business already registered') → { kind: 'join' }    (joiner's role comes from the invite)

// Shape read from invites/{code} (see the collection-path map). role is the role the joiner will
// receive on claim — 'employee' or 'partner' (the owner/partner picked it when generating the code):
export interface InviteRecord {
  code: string; bizId: string; role: 'employee' | 'partner'
  assignedPhone: string; phoneKey: string; displayName: string
  addedByUid: string; addedByName: string
  status: 'unused' | 'claimed'; claimedByUid: string | null
  createdAt: number; claimedAt: number | null
}

// PURE invite check — drives the two JoinByCode steps and their distinct errors:
export type InviteCheck =
  | { kind: 'ok'; bizId: string }        // code exists, unused, mobile matches → claimable
  | { kind: 'not-found' }                // no such code OR status !== 'unused' (step-1 error)
  | { kind: 'phone-mismatch' }           // code ok but entered mobile ≠ invite.phoneKey (step-2 error)
// FROZEN RULES (unit-tested):
//   !invite || invite.status !== 'unused'         → { kind: 'not-found' }
//   phoneKey(enteredPhoneE164) !== invite.phoneKey → { kind: 'phone-mismatch' }
//   else                                           → { kind: 'ok', bizId: invite.bizId }
export function checkInvite(invite: InviteRecord | null, enteredPhoneE164: string): InviteCheck
```

### Invite-code generation — `lib/tenancy/invite.ts` (generation is pure & unit-tested)

```ts
// Ambiguity-safe alphabet — no O, 0, I, 1: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' (32 chars).
// 6 chars from crypto.getRandomValues → uppercase, human-shareable, unbiased (reject-sample the RNG).
export function generateInviteCode(): string

// A MANAGER (owner or partner) creates an invite from a MOBILE + a chosen ROLE ('employee' | 'partner')
// (random code, retry on the rare id collision). Writes invites/{code} with status:'unused', the chosen
// role, and a blank displayName (the member's name is captured at claim time from their Google login).
// Returns the record so the UI shows the code.
export function createInvite(
  actor: AppUser, bizId: string, memberPhoneE164: string, role: 'employee' | 'partner',
): Promise<InviteRecord>
export function getInvite(code: string): Promise<InviteRecord | null>          // reads invites/{code}
export function listPendingInvites(bizId: string): Promise<InviteRecord[]>      // status === 'unused', for the roster
export function cancelInvite(code: string): Promise<void>                       // a manager deletes an unused invite
// claimInvite runs the JoinByCode redemption in one atomic writeBatch (rules-safe: the members-create
// rule reads the invite's still-COMMITTED 'unused' state; the invite-update rule enforces unused→claimed):
//   - flip invites/{code} → status:'claimed', claimedByUid, claimedAt
//   - write businesses/{bizId}/members/{uid} (role: invite.role, active; inviteCode:code,
//     phoneKey:phoneKey(phoneE164); addedBy* + createdAt copied from the invite) — inviteCode + phoneKey
//     + role are REQUIRED by the members rule (invite.role must equal the member doc's role)
//   - set users/{uid}.{ bizId, role: invite.role, phone, email }   // role = 'employee' | 'partner'
// Pre-condition: checkInvite(getInvite(code), phoneE164).kind === 'ok'.
export function claimInvite(user: AppUser, code: string, phoneE164: string): Promise<void>
```

### Tenancy write helpers — `lib/tenancy/business.ts`

```ts
export interface NewBusinessInput { shopName: string; traderName: string; phone?: string; address?: string }
export function phoneKey(phoneE164: string): string     // '+911111111111' → '911111111111' (invite mobile match only)
// createBusiness writes, in one atomic writeBatch: businesses/{bizId}, businesses/{bizId}/members/{uid}
// (owner, active, inviteCode:null, phoneKey from the owner's onboarding mobile), and users/{uid}
// ({ bizId, role:'owner', phone, email }). The owner member-create passes the rule's owner-bootstrap arm
// because businesses/{bizId} does not yet exist in committed state during the batch. There is NO owner
// invite doc — the owner's own uid recognises them on any device. Returns the new bizId.
export function createBusiness(owner: AppUser, input: NewBusinessInput): Promise<string>
export function listMembers(bizId: string): Promise<MemberRecord[]>       // CLAIMED roster (members subcollection; each carries role)
// removeMember deletes businesses/{bizId}/members/{uid}. Callable by a MANAGER (owner or partner) and
// only for a NON-owner target (employee or partner) — the rules reject removing an owner, so a partner
// can never remove an owner and owners are never removable through the roster. (The removed user's own
// users/{uid}.bizId is cleared by that user's client on their next load — see the removal-safety note
// above — since rules forbid writing another user's users doc.) Past attribution snapshots are left intact.
export function removeMember(bizId: string, member: { uid: string; phone: string; role: 'employee' | 'partner' }): Promise<void>
```

> **`memberships/{phoneKey}` is gone**, and with it `findMembershipByPhone` and `claimEmployeeMembership`. Employee onboarding is now the `invites/{code}` flow (`createInvite` → share code+mobile → `claimInvite`).

### Firestore-backed repo contract — `lib/db/repo` (re-pointed in Phase 7)

> **Preserves the Phase-1 call-site shapes** so `lib/calc` and every bill-form/detail/receipt component survive unchanged. The imperative functions keep their names and (already-`Promise`) signatures; the store is now **business-scoped Firestore** instead of Dexie. Business scope is **ambient** — the `AuthProvider` calls `setActiveBusiness(bizId)` when `status` becomes `ready` (and `setActiveBusiness(null)` on sign-out), so existing callers like `repo.listBills()` need no `bizId` argument.

```ts
export function setActiveBusiness(bizId: string | null): void   // called by AuthProvider

// SAME NAMES / SHAPES as the Phase-1 contract, now Firestore-backed & business-scoped:
export function listFarmers(): Promise<Farmer[]>
export function searchFarmers(prefix: string): Promise<Farmer[]>
export function getFarmer(id: string): Promise<Farmer | undefined>
export function upsertFarmer(input: Omit<Farmer,'id'|'createdAt'> & { id?: string }): Promise<Farmer>
export function listGrainTypes(): Promise<GrainType[]>
export function addCustomGrainType(nameEn: string, nameHi: string): Promise<GrainType>
export function ensureSeeded(): Promise<void>                    // seeds businesses/{bizId}/grainTypes once, idempotent
export function createBill(input: Omit<Bill,'createdAt'|'updatedAt'>): Promise<Bill>
export function getBill(id: string): Promise<Bill | undefined>
export function listBills(): Promise<Bill[]>
export function updateBill(bill: Bill): Promise<Bill>            // edit-lock unchanged (payments.length > 0)
export function addPayment(billId: string, p: Omit<Payment,'id'|'createdAt'> & { id?: string }): Promise<Bill>

// Reactive reads change engine: dexie-react-hooks `useLiveQuery` is retired for synced entities and
// replaced by Firestore onSnapshot hooks (business-scoped, live cross-device):
export function useBills(): Bill[] | undefined
export function useBill(id: string): Bill | undefined
export function useFarmers(): Farmer[] | undefined
export function useGrainTypes(): GrainType[] | undefined
```

- **Offline persistence IS the store:** an offline `createBill`/`addPayment` resolves from the local Firestore cache and auto-syncs on reconnect; there is **no separate outbox** (`lib/sync/*` is deleted). Multi-user concurrent writes merge last-write-wins per document.
- **One-time migration (Phase 7):** on the trader's first **owner** sign-in, `migrateLocalToFirestore(bizId)` reads the legacy Dexie `bills`/`farmers`/`grainTypes` and uploads them into `businesses/{bizId}/…`, guarded by a `users/{uid}.migratedAt` flag so it runs **once, idempotently**. The Dexie DB is kept read-only as the migration source; no destructive local wipe.
- **Attribution (Phase 8):** `createBill`/`addPayment` additionally stamp a `createdBy: { uid, phone, name }` snapshot and append an `businesses/{bizId}/activity/*` entry.

### Sync UI (Phase 7)

Automatic (Firestore handles it) **plus** a visible **online/sync status + "Sync now"** control in Settings (`lib/db` exposes a small `getSyncStatus()`/`waitForPendingWrites()` helper over Firestore). The old `SyncSettings` base-URL/device-token box is **deleted** — there is no URL or token to enter; the user is identified by their phone.

### E2E determinism (frozen — emulator-based)

- Auth + Firestore run on the **Firebase emulators** (Auth `9099`, Firestore `8080`, from `firebase.json`). The app connects to them when `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1` (set for the Playwright `webServer`'s `pnpm dev`). **No real Firebase project, no real Google account, no SMS, no service-account key.**
- **Google sign-in is simulated by the Auth emulator's test-IdP popup:** `signInWithPopup(GoogleAuthProvider)` against the emulator opens the emulator's built-in "sign-in with Google" page where the test picks/creates a Google identity (email + display name); Playwright drives that popup. The same emulator email → the same stable `uid` across a run, so returning-user recognition (`users/{uid}.bizId`) is exercised for real.
- Playwright **`global-setup`** clears the Firestore emulator before the run via its REST endpoint (`DELETE http://127.0.0.1:8080/emulator/v1/projects/<projectId>/databases/(default)/documents`) — the emulator equivalent of the old cloud reset, needing no Admin SDK. The whole suite is wrapped by `firebase emulators:exec --only auth,firestore "playwright test"`.
- A shared helper **`tests/e2e/support/auth.ts` → `signInTestOwner(page, { bizName })`** drives Google-popup → (onboarding-if-shown: name → **New business** → shop+mobile) → app so every retained journey spec authenticates first; a dedicated `auth-onboarding.spec.ts` (sorts first, `workers: 1`) asserts the full Google-sign-in → name → **New-business** → gated-home path, plus the **manager-generates-code → second Google identity joins via "Business already registered"** round-trip. The onboarding assertions use the role-free labels (`choose-new-business` / `choose-existing-business`) and confirm **no owner/partner/employee wording** appears in onboarding.
- **Partner journey (Phase 8):** a spec exercises an owner generating a **Partner** invite (role picker), a second Google identity claiming it and landing as a partner, then that **partner** reaching the Members + Activity screens, generating a further invite, and **removing an employee and another partner** — while a direct attempt by the partner to remove the **owner** (or to write `businesses/{bizId}`) is rejected. An **employee** identity is asserted to see **no role badge** on Settings and to be refused the Members + Activity screens.

---

## Phase-12 pilot-readiness contract (frozen)

> **Frozen so slices b and c compile against these signatures in parallel, without waiting for slice-a's implementation.** Everything here is **additive** to the shipped app: no new dependency, no schema change, no new Firestore collection/index/query, no `firestore.rules` change, no LLM (this project still has none — see [agent.md](agent.md)). Product rationale + the exact aggregate definitions are in [home-rollups](capabilities/home-rollups.md) and [entry-defaults](capabilities/entry-defaults.md); the canonical worked fixture is in [data.md § Phase-12 derived aggregates](data.md#phase-12-derived-aggregates-no-schema-change).

### Explicitly UNCHANGED (frozen — do not edit these)

| Surface | Why it must not change |
|---------|------------------------|
| `frontend/src/components/format.ts` → **`formatRupees`** | It is exactly `` `₹${amount.toFixed(2)}` `` — **no thousands separators**. Shipped E2E specs assert that literal (e.g. `₹7101.72`) and the rasterised receipt depends on it. The Indian-grouped formatter is a **new, separately-named export in a new file** (below). This file is not touched at all. |
| `lib/calc/index.ts` | All money/weight math, `billBalance`, `dueStatus`, `todayIso`, `addDaysIso` are **reused as-is**. Phase 12 adds **no** calc function and writes **no** new date arithmetic. |
| `lib/db/schema.ts` | No new field, no new `ActivityType`. `Bill.dueDate` already exists as an optional ISO string. |
| `BillFilter` + `searchBills` (`lib/db/queries.ts`) | **Deliberately NOT extended** — see the decision note below. `SearchBar` and `ledger-journey.spec.ts` depend on their exact current behaviour. |
| `firestore.rules` | `businesses/{bizId}/bills` is already read/write for any member; nothing new is read or written outside it. |
| `components/SyncStatus.tsx` | Keeps its DOM and testids (`sync-status`, `sync-pending-indicator`, `sync-online-indicator`, `sync-now-btn`) byte-for-byte; only the module it calls is refactored beneath it. |
| `app/bill/page.tsx`, `components/receipt/*`, `components/bill-form/*` | Untouched. Per-bill figures stay 2-dp via `formatRupees`. |

> **Decision — `BillFilter` is not extended (and the drill-down is a dedicated route instead).** Drilling into "this month" / "today" / "still outstanding" was considered as `BillFilter { from?, to?, outstandingOnly? }`. **Rejected**, because (1) `paid(month)` matches bills by **the payment's own date** and its row figure is the bill's *in-period payment sum* — not expressible as a bill filter that also yields the right per-row number; (2) the drill-down must display, per row, the **exact contribution** that sums to the headline, which is a projection, not a filter; (3) an `outstandingOnly` flag would be dead code on the only caller (`SearchBar`), and any edit to `searchBills` risks the shipped search specs. Instead, `lib/reports/rollup.ts` returns both the totals **and** the contribution rows (below), and a new `/rollup` route renders them. `queries.ts` changes for **exactly one** reason: the additive `listDueBills` bucket.

### `lib/reports/format.ts` (**new** — pure, no I/O, no `Intl`)

```ts
/**
 * Half-up to a whole rupee, on the absolute value so the sign never skews it.
 * roundToRupee(1200.55) === 1201 ; roundToRupee(4000.30) === 4000 ;
 * roundToRupee(-258.28) === -258 ; roundToRupee(0) === 0
 */
export function roundToRupee(amount: number): number

/**
 * Indian digit grouping, HAND-ROLLED (last 3 digits, then pairs) — deliberately NOT
 * `Intl.NumberFormat('en-IN')`, so it is deterministic in Vitest/jsdom and independent
 * of the ICU data available on a low-end Android WebView. Integer input only.
 *   0 → '0' | 999 → '999' | 1000 → '1,000' | 100000 → '1,00,000'
 *   420000 → '4,20,000' | 12345678 → '1,23,45,678' | -420000 → '-4,20,000'
 */
export function groupIndian(whole: number): string

/**
 * The ONLY money formatter used on Phase-12 rollup surfaces: whole rupees, Indian
 * grouping, no paise. `formatRupeesIndian(420000) === '₹4,20,000'`.
 * Rounds internally, so it is idempotent on the already-integer rollup figures.
 * `formatRupees` (2 dp, no separators) stays the formatter for per-bill surfaces.
 */
export function formatRupeesIndian(amount: number): string
```

### `lib/reports/rollup.ts` (**new** — pure over `Bill[]`, no I/O)

```ts
import type { Bill } from '@/lib/db/schema'

/** 'yyyy-mm' from an ISO 'yyyy-mm-dd' — a STRING prefix compare, no Date, no timezone risk. */
export function monthKeyOf(iso: string): string        // '2026-07-26' → '2026-07'

/** All figures are WHOLE RUPEES (integers), each = Σ of already-rounded per-bill contributions. */
export interface MonthRollup {
  monthKey: string        // 'yyyy-mm'
  billCount: number       // bills whose purchaseDate is in the month
  bought: number          // Σ roundToRupee(billBalance(b).total)  over bills in the month (net of paldari, NOT clamped)
  paid: number            // Σ roundToRupee(Σ in-month payment amounts)  over ALL BILLS, matched by PAYMENT date
  dueAllTime: number      // Σ roundToRupee(max(0, billBalance(b).outstanding)) over ALL BILLS — ALL-TIME, CLAMPED PER BILL
}

export interface DayRollup {
  date: string            // ISO 'yyyy-mm-dd'
  billCount: number       // bills whose purchaseDate === date
  bought: number          // Σ roundToRupee(billBalance(b).total)  over bills on that date
  paid: number            // Σ roundToRupee(Σ payments dated that day)  over ALL BILLS
  pending: number         // Σ roundToRupee(max(0, outstanding))  over bills on that date (CLAMPED PER BILL)
}

export function monthRollup(bills: Bill[], monthKey: string): MonthRollup
export function dayRollup(bills: Bill[], date: string): DayRollup

/**
 * `dueAllTime` is NAMED for its scope on purpose: it is ALL-TIME outstanding exposure,
 * NOT the month's. Clamping is PER BILL — an overpaid bill contributes 0, never a
 * negative, so an advance on one bill can never reduce reported exposure elsewhere.
 * `paid` is matched by the PAYMENT's own date over EVERY bill, so a June bill's July
 * payment counts in July's `paid` and NOT in July's `bought`. Both asymmetries are
 * intended; see capabilities/home-rollups.md.
 */

/** The metrics that have a drill-down screen. (`unsynced` is not a money metric — the page handles it.) */
export type RollupMetric = 'bought-month' | 'paid-month' | 'due-all' | 'bought-today'

/** One drill-down row = one contributing bill, carrying its EXACT whole-rupee contribution. */
export interface Contribution {
  billId: string
  farmerName: string
  farmerPlace: string
  date: string            // purchaseDate for bought-*/due-all; the LATEST in-period payment date for paid-month
  amount: number          // whole rupees — the same integer that went into the total
}

/**
 * INVARIANT (unit-tested): for every metric,
 *   Σ rollupContributions(bills, m, p).amount  ===  the matching rollup figure
 * because each total is DEFINED as the sum of these rounded contributions.
 * Also: rollupContributions(…, 'bought-month').length === monthRollup(...).billCount.
 *
 * Zero rows: excluded for 'paid-month' and 'due-all' (a bill with no in-period payment /
 * nothing outstanding is not a contributor); INCLUDED for 'bought-month'/'bought-today'
 * (the bill IS in the period, and the row count must equal billCount).
 * Order: 'due-all' → amount DESC (biggest exposure first); all others → date DESC then
 * createdAt DESC (newest first, matching the home list).
 */
export function rollupContributions(
  bills: Bill[],
  metric: RollupMetric,
  period: { monthKey: string; today: string },
): Contribution[]
```

### `lib/db/queries.ts` — additive fourth due bucket (existing three unchanged)

```ts
export interface DueBuckets {
  overdue: Bill[]
  dueSoon: Bill[]
  upcoming: Bill[]
  /**
   * Phase 12 — ADDITIVE. Pre-Phase-12 legacy rows only: no `dueDate` AND
   * billBalance(bill).outstanding > 0. Sorted purchaseDate ASC (oldest first,
   * ties by createdAt ASC). The three buckets above keep their exact membership
   * rules, contents and ordering — `due-overdue`/`due-soon`/`due-upcoming` and the
   * shipped due assertions are unaffected.
   */
  noDueDate: Bill[]
}
export function listDueBills(bills: Bill[], today: string, soonDays?: number): DueBuckets
```

Implementation note: today's `if (!bill.dueDate) continue` becomes "compute `billBalance` first, then route an undated bill into `noDueDate` when `outstanding > 0`, else skip". `searchBills`/`BillFilter` are untouched.

### `lib/db/sync-status.ts` — a COUNT, with exactly one source of truth

```ts
export interface UnsyncedBills {
  count: number       // bills whose OWN doc has locally-pending writes
  billIds: string[]   // their `Bill.id` values (`DDMMYY/xxxxx`), for the drill-down
}

/**
 * Phase 12 — the primitive. `onSnapshot(bills, { includeMetadataChanges: true })`, then
 * count/collect the docs whose own `doc.metadata.hasPendingWrites` is true (the existing
 * helper only exposed the QUERY-level boolean). No active business, or a listen error →
 * `{ count: 0, billIds: [] }` + a no-op unsubscribe. Never throws. Costs no extra
 * document read (same collection already listened to) and works offline — pending-write
 * metadata is local.
 */
export function subscribeUnsyncedBills(cb: (state: UnsyncedBills) => void): () => void

/**
 * UNCHANGED SIGNATURE + SEMANTICS, now DERIVED: `subscribeUnsyncedBills(s => cb(s.count > 0))`.
 * There is therefore exactly ONE sync-state implementation. Equivalent to the old
 * query-level `snap.metadata.hasPendingWrites` because the app has no delete-bill
 * mutation, so a pending write always belongs to a doc present in `snap.docs`.
 * `SyncStatus.tsx` keeps its DOM/testids unchanged.
 */
export function subscribePendingWrites(cb: (hasPending: boolean) => void): () => void

/** Unchanged. */
export function waitForSync(): Promise<void>
```

**Anti-flicker (owned by slice-b, not by this module):** `UNSYNCED_BADGE_DELAY_MS = 1500`, a module const **inside `components/rollup/UnsyncedBadge.tsx`**. A write is briefly pending on every save even when online, so the badge **shows** only after `count > 0` has held continuously for that long and **hides immediately** at 0. `sync-status.ts` itself stays a plain, undebounced subscription (the Settings indicator wants the raw signal).

### `lib/db/repo.ts` — one narrow addition

```ts
/**
 * Phase 12 — set ONLY a bill's `dueDate` (+ `updatedAt`). DELIBERATELY NOT gated by the
 * edit-lock: the lock protects PURCHASE figures after money has moved, and `billBalance`
 * never reads `dueDate`, so this can change no total, no payment and no outstanding.
 * Without it, pre-Phase-12 bills that have a payment AND no due date would keep their
 * outstanding money hidden forever — the exact failure the mandatory due date prevents.
 * Appends a best-effort activity entry using the EXISTING `type: 'bill-edit'`
 * (no new ActivityType). Local-first: succeeds offline and syncs on reconnect.
 * Throws `BillNotFoundError` for an unknown id. `updateBill`'s lock is unchanged.
 */
export function setBillDueDate(billId: string, dueDate: string): Promise<Bill>
```

### Routes & navigation (Phase 12)

| Route | Purpose | testids |
|-------|---------|---------|
| `/` (edit) | The three new surfaces mount **above** the existing `SearchBar`, in order: `unsynced-badge` (only when count > 0) → `month-strip` → `today-card`. The bill list and its testids are untouched, and the new surfaces sit **outside** the `bill-list` container (which doubles as the empty-state container). | `month-strip`, `month-bought`, `month-paid`, `month-due`, `month-empty`, `today-card`, `today-count`, `today-bought`, `today-paid`, `today-pending`, `today-empty`, `unsynced-badge` |
| `/rollup?metric=…` (**new**) | The drill-down. `metric ∈ 'bought-month' \| 'paid-month' \| 'due-all' \| 'bought-today' \| 'unsynced'`. Reads `useBills()` (+ `subscribeUnsyncedBills` for `unsynced`), renders one headline + its contribution rows + a back link. Query-param driven (like `/bill?id=`) and **wrapped in `<Suspense>`** for `useSearchParams` under static export, exactly as `/bills/quick` does. An unknown/missing `metric` falls back to `bought-month`. | `rollup-screen`, `rollup-headline`, `rollup-count`, `rollup-row`, `rollup-row-amount`, `rollup-empty` |
| `/bills/choose` (edit) | `choice-quick` renders **first** and primary with a "Recommended" pill; `choice-fresh` second. Testids, targets and both journeys preserved. | `new-bill-choice`, `choice-quick`, `choice-quick-badge`, `choice-fresh` (all preserved except the new badge) |
| `/bills/new`, `/bills/quick` (edit) | Due date **required**, pre-filled `addDaysIso(purchaseDate, 15)`, `dueDateTouched` tracking (mirrors the shipped `amountTouched`), added to the save-enabled validation **last** so existing hint precedence is unchanged. No ordering constraint vs `purchaseDate`. | `due-date-input`, `purchase-date`, `save-bill` (all preserved) |
| `/due` (edit) | A fourth section `due-no-date` (legacy rows), additional to and visually distinct from the three existing buckets, each row carrying an inline pre-filled date input + **Set date** → `setBillDueDate`. The `empty` state now requires all **four** buckets empty. | `due-list`, `due-row`, `due-overdue`, `due-soon`, `due-upcoming` (preserved) + `due-no-date`, `due-set-date-input`, `due-set-date-btn` |

**Testability rule (frozen):** every rollup money figure renders a numeric **`data-amount`** attribute (whole rupees) and every count a numeric **`data-count`**, on the strip, the today line, the badge, the drill-down headline and every drill-down row — so E2E asserts `Σ rows === headline` and month/day deltas numerically, never by parsing grouped, translated text.

### `lib/i18n/dictionary.ts` — the complete Phase-12 key set (owned by slice-a)

> The dictionary is **one shared ~911-line file** and `HI` is typed `Record<TKey, string>`, so **every EN key must have an HI counterpart or `pnpm build` fails** (this has bitten previous phases). Slice-a adds **all** of these — for slice-b's and slice-c's surfaces too — so parallel slices never conflict on the file. Values below are the frozen defaults; a build may polish wording but must keep both languages paired.

| Key | EN | HI |
|-----|----|----|
| `rollup.month.title` | This month | इस महीना |
| `rollup.today.title` | Today | आज |
| `rollup.bought` | Bought | खरीद |
| `rollup.paid` | Paid | भुगतान |
| `rollup.due` | Due (all) | कुल बकाया |
| `rollup.pending` | Pending | बाकी |
| `rollup.bills` | bills | बही |
| `rollup.month.empty` | No bills this month yet — add one and these numbers fill up. | इस महीने अभी कोई बही नहीं — एक जोड़ें, ये आँकड़े भर जाएँगे। |
| `rollup.today.empty` | No bills entered today yet. | आज अभी कोई बही नहीं भरी। |
| `rollup.addsUp` | These add up to the total above. | ये जोड़कर ऊपर का कुल बनता है। |
| `rollup.empty` | Nothing here yet. | यहाँ अभी कुछ नहीं। |
| `rollup.title.boughtMonth` | Bought this month | इस महीने की खरीद |
| `rollup.title.paidMonth` | Paid this month | इस महीने का भुगतान |
| `rollup.title.dueAll` | All outstanding | कुल बकाया |
| `rollup.title.boughtToday` | Today's bills | आज की बही |
| `rollup.title.unsynced` | Not backed up yet | बैकअप बाकी |
| `unsynced.bills` | bills not yet backed up | बही का बैकअप बाकी |
| `unsynced.hint` | These are saved on this phone. They upload automatically when you are online. | ये इसी फ़ोन पर सुरक्षित हैं। ऑनलाइन होते ही अपने-आप अपलोड हो जाएँगी। |
| `unsynced.tapToSee` | Tap to see which ones | देखें कौन-कौन सी |
| `choice.quick.hint` (**changed value**) | The usual way — copy the totals from your paper bill | रोज़ का तरीक़ा — काग़ज़ की बही से कुल आँकड़े भरें |
| `choice.fresh.hint` (**changed value**) | When the farmer wants every sack listed | जब किसान को हर बोरे का हिसाब चाहिए |
| `choice.recommended` | Recommended | सुझाया गया |
| `dueDate.hint` | Defaults to 15 days after the purchase date — change it if needed. | खरीद तारीख से 15 दिन बाद अपने-आप — ज़रूरत हो तो बदलें। |
| `validation.dueDateRequired` | Set a due date | देय तारीख भरें |
| `due.noDate` | No due date — set one | देय तारीख नहीं — तय करें |
| `due.noDate.hint` | These older bills still owe money but have no due date. | इन पुरानी बहियों का पैसा बाकी है पर देय तारीख नहीं है। |
| `due.setDate` | Set date | तारीख तय करें |
| `due.dateSet` | Due date saved | देय तारीख सहेजी गई |

`choice.quick.title`, `choice.fresh.title`, `dueDate.label` and every other existing key keep their current values. No key is removed.

### E2E determinism for Phase 12 (frozen)

- The Firestore emulator is cleared **once per run** by `global-setup`, **not per spec**, and Playwright runs with `retries: 1`. Therefore the Phase-12 spec **asserts deltas against a baseline it reads at the start of the test**, never absolute totals — this makes it immune both to bills left behind by earlier specs and to its own first attempt on a retry.
- `frontend/tests/e2e/support/emulator.ts` gains two helpers (built on the existing `getUidByEmail` / `getDocFields` / `str` / `FIRESTORE_DOCS_BASE` + `Bearer owner` admin token):
  - `getOwnerBizId(): Promise<string>` — `getUidByEmail(OWNER_EMAIL)` → `users/{uid}.bizId`.
  - `clearBillDueDate(bizId: string, billId: string): Promise<void>` — `PATCH .../businesses/{bizId}/bills/{billId.replace(/\//g,'_')}?updateMask.fieldPaths=dueDate` with body `{"fields":{}}`, which **deletes** the field. This is how the spec manufactures a **pre-Phase-12 legacy row**, since the UI can no longer create one. Reload the page after it so the client picks up the change deterministically. **Accepted fallback if the field-delete PATCH proves awkward:** write the field as an explicit null — body `{"fields":{"dueDate":{"nullValue":null}}}` with the same `updateMask` — because `!bill.dueDate` is true for `null` as well as for a missing key, so the bucket rule behaves identically. (`DueRow` already renders `bill.dueDate ? … : '—'`.) Either form is acceptable; do not add production code to make this testable.
- The offline segment uses `context.setOffline(true/false)`, the same mechanism the shipped `shared-ledger.spec.ts` already relies on.

---

## Bill Check (Phase 13) — frozen

> **Frozen so the three slices build in parallel on disjoint paths.** Everything here is
> **additive**: no schema change, no new Firestore collection/index/query, no
> `firestore.rules` change, no change to `lib/calc`, no change to any existing screen except
> one new button on home. Product rationale lives in
> [bill-check.md](capabilities/bill-check.md); the AI surface and the eyes-only rule live in
> [agent.md](agent.md); the shapes and signatures live here.

### What is new in the component map

```
  Trader ──photo──► /bills/check (client component)
                          │
                          ▼
                  lib/billcheck/image.ts      downscale on-device (canvas → JPEG)
                          │
                          ▼
                  lib/billcheck/reader.ts  ──HTTPS──►  Gemini :generateContent
                          │                             (the ONLY external AI call)
                          ▼
                  lib/billcheck/parse.ts      strict validate — never trust the model
                          │
                          ▼
                  lib/billcheck/verify.ts  ──uses──►  lib/calc (pure, unchanged)
                          │
                          ▼
                   check-result + check-verdict        nothing is persisted
```

`lib/db`, `lib/auth`, `lib/tenancy`, `lib/reports` and `lib/calc` are **not touched**. Bill
Check reads no bill and writes nothing — it is a leaf.

### Module contract (frozen signatures)

`frontend/src/lib/billcheck/types.ts`

```ts
/** One field the model read, with how sure it was. `value: null` ⇒ it could not read it. */
export interface ReadField<T> { value: T | null; confidence: number } // confidence 0..1

export interface ReadBillLine {
  grainName: ReadField<string>
  ratePerQuintal: ReadField<number>   // ₹ per 100 kg
  weightKg: ReadField<number>         // gross, as written
  deductionKg: ReadField<number>      // 0 when the paper shows none
  sackCount: ReadField<number>        // informational only; never used in math
  amount: ReadField<number>           // ₹ as WRITTEN on the paper for this line
}

export interface ReadBill {
  farmerName: ReadField<string>
  place: ReadField<string>
  date: ReadField<string>             // ISO yyyy-mm-dd when legible
  lines: ReadBillLine[]
  paldari: ReadField<number>          // bill-level labour charge, ₹; 0 when absent
  paperTotal: ReadField<number>       // the grand total WRITTEN at the bottom; null ⇒ none
}

/** A read that failed, as a typed cause — never a thrown string, never a silent null. */
export type BillReadErrorKind =
  | 'offline' | 'not-configured' | 'rate-limited' | 'network'
  | 'bad-response' | 'no-bill-found' | 'image-too-large'
export interface BillReadError { kind: BillReadErrorKind; detail?: string }

export interface InlineImage { mimeType: string; base64: string }
export type BillReader = (image: InlineImage) => Promise<ReadBill>
```

`frontend/src/lib/billcheck/verify.ts` — **pure, no I/O, no network**

```ts
export const CONFIDENCE_THRESHOLD = 0.75   // below this a cell renders amber

export interface LineCheck {
  grainName: string | null
  ratePerQuintal: number | null
  weightKg: number | null
  deductionKg: number
  netWeightKg: number | null
  writtenAmount: number | null
  computedAmount: number | null       // null when a required input was unreadable
  lineDiff: number | null             // written − computed, 2 dp; null when either is null
  unsureFields: string[]              // field names below CONFIDENCE_THRESHOLD
}

export type Verdict = 'ok' | 'check' | 'incomplete'

export interface BillCheckResult {
  lines: LineCheck[]
  sumWritten: number | null           // Σ written line amounts, GROSS of paldari
  sumComputed: number | null          // Σ computed line amounts, GROSS of paldari
  payableWritten: number | null       // sumWritten − paldari
  paperTotal: number | null
  mathDiff: number | null             // sumWritten − sumComputed (paldari-FREE)
  additionDiff: number | null         // paperTotal − payableWritten; null when no paperTotal
  paldari: number
  verdict: Verdict
  unsureCount: number
}

export function verifyReadBill(read: ReadBill): BillCheckResult
```

**Rules the implementation must satisfy** (each is a named unit test):

1. `computedAmount` is obtained **only** by calling `computeGrainLine` from `@/lib/calc`
   with a sacks-style input — `{ pricePerQuintal: rate, sackWeights: [weightKg],
   deductions: [{ basis: 'flat_kg', value: deductionKg }] }`. Bill Check does **not**
   re-implement the formula, and deliberately does **not** take the `summary` path, whose
   whole purpose is to return the entered amount verbatim — which would make the check
   vacuous.
2. **Paldari belongs to the TOTAL comparison, never to the line comparison.** `sumWritten`
   and `sumComputed` are both **gross** of paldari, so `mathDiff` is paldari-free; paldari is
   subtracted exactly once, on `payableWritten`, which is what `additionDiff` compares the
   written grand total against. This mirrors the paper (grain lines gross, then one labour
   charge, then the payable total). Getting this wrong would report *"line amounts are ₹500
   off"* on every bill carrying a labour charge — a false accusation, and the one failure this
   screen cannot afford.
3. `mathDiff` and `additionDiff` are **independent**. A bill with correct lines and a
   mis-added grand total yields `mathDiff: 0` and a non-zero `additionDiff`.
4. A `null` anywhere propagates to `null` — **never to `0`**. `additionDiff` is `null` (not
   `0`) when the paper has no grand total; the UI must then say "no total written on the
   paper", not "your addition is correct".
5. `netWeightKg` clamps at `0` and never goes negative.
6. `verdict` is `'incomplete'` if any line's `ratePerQuintal`, `weightKg` or `amount` is
   `null`; else `'check'` if either diff is non-zero; else `'ok'`. An `'incomplete'` read is
   never reported as `'ok'`.
7. Pure: identical input always yields identical output, no side effects, no clock, no
   `Math.random`.

`frontend/src/lib/billcheck/parse.ts` — **pure**

```ts
export function parseReadBill(raw: unknown): ReadBill   // throws a BillReadError on bad input
```

Coerces numeric strings, clamps confidence to `0..1`, rejects a non-array or empty `lines`,
maps absent optionals to `{ value: 0, confidence: 1 }` for `deductionKg`/`paldari` and to
`{ value: null, confidence: 0 }` for everything else, and ignores unknown keys. **No code
path may produce `NaN`.** Tested entirely against fixture JSON — no key, no network.

### Transport + key handling (the recorded trade-off)

| | |
|---|---|
| Endpoint | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}` |
| Key env var | **`NEXT_PUBLIC_GEMINI_API_KEY`** — build-time inlined into the static export |
| Model env var | `NEXT_PUBLIC_GEMINI_MODEL`, default `gemini-flash-lite-latest` |
| `generationConfig` | `responseMimeType: 'application/json'`, a strict `responseSchema`, `temperature: 0` |
| Proxy | **None.** Called directly from the browser. |

**The key is public.** `NEXT_PUBLIC_*` values are inlined into the JavaScript bundle, so
anyone who opens devtools on the deployed site can read this key and spend against it. This
is **not** the same situation as the six `NEXT_PUBLIC_FIREBASE_*` values: those are
*designed* to be public and are guarded by Firestore Security Rules, whereas a Gemini key is
a **billable credential with no equivalent server-side guard**.

This was chosen deliberately, with the trade-off stated: a key-holding proxy (a Cloudflare
Worker, ~60 lines, free tier) is the correct design, but it adds a second deploy surface and
a second account to the pilot, and the pilot is already the blocking path. The decision
accepts a bounded, monetary, self-inflicted risk to avoid delaying it further.

**Required mitigations — part of the capability, not optional hygiene:**

1. Use a **dedicated** AI-Studio key used for nothing else, so revoking it affects nothing
   but this screen.
2. Restrict it by **HTTP referrer** to the Pages origin in the Google Cloud console. (This
   raises the cost of casual abuse; it does not stop a determined one — referrers are
   client-supplied.)
3. Set a **hard quota cap** on the key so the worst case is a dead feature, never an
   unbounded bill.
4. **Before any release beyond the 3–5-trader pilot, move the key behind a proxy.** The
   client already isolates the provider in `reader.ts`, so that is a one-file change plus a
   worker deploy — no change to `parse.ts`, `verify.ts` or the UI.

[`DEPLOY.md`](../DEPLOY.md) carries steps 1–3 as a checklist, and the screen degrades to a
labelled `check-unconfigured` state when the key is absent, so a fork or a clean clone never
crashes.

### Offline + failure behaviour (frozen)

Bill Check is the **only** online-only screen in the app. It must therefore fail *legibly*,
because every other screen works in airplane mode and a trader has no reason to suspect the
difference:

| Condition | `BillReadErrorKind` | Behaviour |
|---|---|---|
| `navigator.onLine === false` | `offline` | checked **before** any fetch; its own message; photo kept |
| key env var absent/empty | `not-configured` | `check-unconfigured` instead of the read button |
| HTTP 429 / quota | `rate-limited` | its own message naming the daily cap |
| HTTP 5xx, DNS, timeout | `network` | generic retryable message; photo kept |
| 200 with unparseable or schema-violating JSON | `bad-response` | retryable; the raw text is **not** shown to the trader |
| 200, well-formed, but zero usable lines | `no-bill-found` | "couldn't find a bill in this photo — try again in better light" |
| downscaled image still over the inline cap | `image-too-large` | asks for a tighter crop |

In every case the photo is **retained**, so a retry never costs a re-shoot.

### E2E determinism for Phase 13 (frozen)

- **No gate ever spends a real API call.** Unit tests are pure. The E2E spec intercepts
  `**generativelanguage.googleapis.com/**` with `page.route` and fulfils canned responses.
- **No test-only hooks in production code.** The interception is at the network layer, so
  the shipped `reader.ts` → `parse.ts` → `verify.ts` → render path is the one under test.
  There is no `window.__TEST_READER__`, no injected global, and no env branch in app code.
- The dev server for E2E sets `NEXT_PUBLIC_GEMINI_API_KEY` to a **dummy non-empty value** in
  `playwright.config.ts`'s `webServer.env` (alongside the existing emulator vars) so the
  screen renders its configured state. The value never reaches anything real because every
  matching request is intercepted.
- The spec asserts **request count** to prove that correcting a cell re-verifies locally and
  does **not** re-call the API — the observable consequence of the eyes-only rule.
- The fixture image is generated in-test as a tiny base64 PNG; no binary is committed.
