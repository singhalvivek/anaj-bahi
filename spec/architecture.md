# Architecture — Anaj Bahi

> Deterministic, offline-first PWA. **No AI/LLM/agent framework** anywhere in this project — see [agent.md](agent.md).

---

## System Overview

Anaj Bahi is an installable **Next.js PWA** that runs on the trader's phone. In Phase 1 there is **no backend and no network dependency**: the browser is the whole runtime. The UI (React 19 client components) reads and writes an **IndexedDB** database via **Dexie**; a pure TypeScript **calc module** computes all weights and money; a **service worker** caches the app shell so it launches offline; a lightweight **i18n context** swaps Hindi/English. Phases 1–5 built this single-user local ledger (with an optional FastAPI + SQLite personal-backup backend in the now-**superseded** Phase 4).

> **Firebase multi-tenant redesign (Phases 6–9).** The app is evolving from single-user-single-device into a **multi-tenant, multi-user** ledger: many independent **businesses**, each with **owners** and **employees** who share one ledger. The FastAPI + SQLite sync backend is **replaced entirely by Firebase** — **Firebase Auth (Google sign-in)** for identity and **Cloud Firestore (accessed directly from the client, with IndexedDB offline persistence as the store)** for the shared, business-scoped data. There is still **no server we run** (no FastAPI, no container) and — critically — **still no AI/LLM/agent** (see [agent.md](agent.md)). The full frozen contracts for this redesign are in [§ Firebase multi-tenant redesign — frozen contracts](#firebase-multi-tenant-redesign-phases-69--frozen-contracts) at the end of this file.

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
- **Agent framework:** **None.** No LLM, no agent orchestration. The Firebase redesign does **not** change this. See [agent.md](agent.md).
- **LLM provider + model:** **None** — not an AI app.
- **Frontend:** Next.js 15.3 (App Router) + React 19, **static export** (`output: 'export'`, `basePath: '/app'`, `trailingSlash: true`), Tailwind CSS 4. Installable PWA (manifest + hand-written service worker). Unchanged by the redesign.
- **Local store (Phases 1–5):** **IndexedDB via Dexie 4**. No server DB on device.
- **Auth (Phase 6+):** **Firebase Authentication — Google sign-in** via the Firebase Web JS SDK (`firebase/auth`): `GoogleAuthProvider` + `signInWithPopup`, **`browserLocalPersistence`** (stays signed in until explicit sign-out). Identity = the Firebase **`uid`** (stable per Google account, the same on every device). **No SMS/OTP, no reCAPTCHA, no Blaze plan** — Google sign-in is free on the **Spark** tier (phone/SMS-OTP was removed after it began returning `auth/billing-not-enabled`; the "10 free SMS/day" console banner is dead since Sept 2024). Google supplies `displayName` + `email`; email is stored on the user record. The **mobile number** is captured at onboarding as **profile/verification data only** — never an auth factor. Web config is 6 **public** `NEXT_PUBLIC_FIREBASE_*` values (not secrets); real security is **Firestore Security Rules**.
- **Cloud data store (Phase 7+):** **Cloud Firestore**, accessed **directly from the client** (`firebase/firestore`) with **no server**. **IndexedDB offline persistence (`persistentLocalCache` + `persistentMultipleTabManager`) is THE store** — writes save + queue locally offline and auto-sync on reconnect; reads are live cross-device via `onSnapshot`. Data is **business-scoped** (see the frozen collection-path map). Free **Spark/Blaze-free-quota** tier; no infra we operate.
- **~~Backend (Phase 4)~~ — SUPERSEDED / REMOVED (Phase 7):** the FastAPI + SQLite + SQLAlchemy `backend/` tree, its `uv` toolchain, the `frontend/src/lib/sync/*` engine, and the `SyncSettings` UI are **all removed** in Phase 7 and replaced by Firestore. The Phase-4 sync contract below is retained only as historical record, marked SUPERSEDED.
- **Key new dependency:** **`firebase`** (npm, ^11) — Auth + Firestore Web SDK (frontend `dependencies`). **`firebase-tools`** is a frontend **devDependency** (or `npx`-invoked) that runs the **Auth + Firestore emulators** for E2E (`firebase emulators:exec`); the emulator is cleared via its REST endpoint, so **no `firebase-admin` and no service-account key are required**.
- **Dependency management:** **pnpm** (frontend). (`uv`/Python removed with the backend in Phase 7.)
- **Observability:** N/A in the AI sense (no LLM tracing because there is no LLM). Client errors surface as visible UI messages; Firebase Auth/Firestore errors are mapped to translated messages; dev uses browser devtools + the Firebase console.

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
| `users/{uid}` | Firebase Auth uid | The signed-in user's own record; **the sole basis for routing on sign-in** (`bizId` set → `ready`; else → onboarding). Fields: `{ uid, email, phone (E.164, set at onboarding), displayName, bizId \| null, role \| null, createdAt, updatedAt }` | read/write only when `uid == request.auth.uid` |
| `invites/{code}` | one-time share **code** (6 uppercase chars, ambiguity-safe alphabet — no `O/0/I/1`) | **Owner-generated employee invite.** The owner creates it from the employee's **mobile alone** and shares the **code + mobile** out-of-band; the employee redeems it at first run, and their name is captured then from their Google login. Fields: `{ code, bizId, role: 'employee', assignedPhone (E.164), phoneKey (normalized digits), displayName (blank until claim), addedByUid, addedByName, status: 'unused'\|'claimed', claimedByUid \| null, createdAt (number), claimedAt (number \| null) }` | **get** (by-id, the code is a secret): any signed-in user; **list** (enumerate): an **owner** of `resource.data.bizId` only — so no one can enumerate another business's invites; **create/delete:** an **owner** of the business; **update:** an **owner**, OR the single-use `unused → claimed` transition stamped with `claimedByUid == request.auth.uid`. See [§ Security Rules — hardened invites + members model](#security-rules--hardened-invites--members-model-code-generator-edits-firestorerules) |
| `businesses/{bizId}` | uuid | The business + its **business profile**. Fields: `{ id, shopName, traderName, phone, address?, createdByUid, createdByName, createdAt, updatedAt }` | read: any member of `bizId`; write: an **owner** of `bizId` |
| `businesses/{bizId}/members/{uid}` | member uid | Per-business member (for in-app roster + rule membership checks — the **role source** for the rules). Fields: `{ uid, phone, displayName, role, addedByUid, addedByName, addedAt, status, inviteCode (string \| null — the code used at claim; null/omitted for the owner's own doc), phoneKey (normalized digits of the claimed mobile; owner: from own onboarding mobile) }` | read: any member; **create:** self **only** via the owner-bootstrap arm (role `owner` **and** the business does not yet exist) or the employee-claim arm (a matching **unused** `invites/{inviteCode}` tying `bizId` + `phoneKey`), OR an **owner** writing the roster; update: an **owner** or self; delete: an **owner** |
| `businesses/{bizId}/bills/{billId}` | `DDMMYY/xxxxx` | Shared bill ledger (same `Bill` shape as [data.md](data.md); Phase 8 adds `createdBy` attribution snapshot) | read/write: any member of `bizId` (edit-lock still applies) |
| `businesses/{bizId}/farmers/{farmerId}` | uuid | Shared farmers | read/write: any member of `bizId` |
| `businesses/{bizId}/grainTypes/{grainTypeId}` | slug/uuid | Shared grain types (seeded + custom) | read/write: any member of `bizId` |
| `businesses/{bizId}/activity/{activityId}` | uuid | **Append-only** activity log (bill-create, payment, edit/delete) — `{ id, type, billId?, actorUid, actorPhone, actorName (snapshot), at, summary }` | **read: OWNERS only**; write (create-only): any member; no update/delete |

> **Name snapshots (attribution survives renames/removal):** `displayName`/`createdByName`/`actorName`/`addedByName` are **snapshots written at the time of the action**, never a live join to `users`. So an activity entry or a bill's `createdBy` still shows who did it even after that person renames themselves or is removed from the business.

> **One-person-one-business** is enforced by the **`uid`**: once `users/{uid}.bizId` is set, sign-in routes the user straight to `ready` and they **never re-enter onboarding**, so they can never reach the create-business form or the join-by-code screen to acquire a second business. A user already in a business therefore cannot redeem an invite code (they never see JoinByCode). No phone-keyed lookup is involved.

### Security Rules — hardened `invites` + `members` model (code-generator edits `firestore.rules`)

The `firestore.rules` file replaces its old `match /memberships/{phoneKey}` block with a `match /invites/{code}` block **and hardens the `members/{uid}` block** to close a tenant-isolation hole (an earlier draft's `read: signedIn()` granted LIST — letting any signed-in user enumerate every business's invites — and the old members `create` let any signed-in user self-create an `owner` member for **any** bizId, since the phone/invite match was only client-side; net = cross-tenant owner escalation). The `users`, `businesses`, `bills`/`farmers`/`grainTypes`, and `activity` blocks are **UNCHANGED**; the `isMember` / `isOwner` helpers are unchanged.

The design is **claim/create-bootstrap-safe under a single client `writeBatch`**: Firestore rules only see **committed** state during a batch, so each write in the batch is evaluated against the pre-batch snapshot. The `members`-create rule reads the invite's still-`'unused'` committed state, while the `invites`-update rule enforces the `unused → claimed` single-use transition — the two writes are therefore mutually consistent and cannot be replayed.

```
// GET is by-id (the code is a shared secret an employee reads pre-membership); LIST is owner-only,
// so no one can enumerate another business's invites. Only an owner mints/cancels; the sole non-owner
// write is the single-use unused→claimed transition, stamped with the claimer's own uid.
match /invites/{code} {
  allow get:    if signedIn();
  allow list:   if signedIn() && isOwner(resource.data.bizId);
  allow create: if signedIn() && isOwner(request.resource.data.bizId);
  allow update: if signedIn() && (
    isOwner(resource.data.bizId) ||
    ( resource.data.status == 'unused'
      && request.resource.data.status == 'claimed'
      && request.resource.data.claimedByUid == request.auth.uid )
  );
  allow delete: if signedIn() && isOwner(resource.data.bizId);
}

match /businesses/{bizId} {
  // …businesses/bills/farmers/grainTypes/activity unchanged…
  match /members/{uid} {
    allow read: if isMember(bizId);
    // Self-create is tightly gated to two legitimate bootstraps, else an owner writes roster docs:
    allow create: if signedIn() && request.auth.uid == uid && (
      // owner bootstrap — ONLY while the business does not yet exist in committed state (the create
      // batch), which blocks self-owning an already-existing business:
      ( request.resource.data.role == 'owner'
        && !exists(/databases/$(database)/documents/businesses/$(bizId)) )
      ||
      // employee claim — gated on a REAL matching UNUSED invite (by code), tying bizId + phoneKey:
      ( request.resource.data.role == 'employee'
        && exists(/databases/$(database)/documents/invites/$(request.resource.data.inviteCode))
        && get(/databases/$(database)/documents/invites/$(request.resource.data.inviteCode)).data.bizId == bizId
        && get(/databases/$(database)/documents/invites/$(request.resource.data.inviteCode)).data.phoneKey == request.resource.data.phoneKey
        && get(/databases/$(database)/documents/invites/$(request.resource.data.inviteCode)).data.status == 'unused' )
    ) || isOwner(bizId);
    allow update: if isOwner(bizId) || isSelf(uid);
    allow delete: if isOwner(bizId);
  }
}
```

To satisfy the employee-claim rule, the **`members/{uid}` doc carries `inviteCode` + `phoneKey`** written at claim time (see the collection-path map). `createBusiness`'s owner member doc has `inviteCode: null` (or omitted) and `role: 'owner'`; its create passes the owner-bootstrap arm because `businesses/{bizId}` does not yet exist in committed state when the batch is evaluated. `claimInvite`'s single `writeBatch` — invite `unused→claimed` + `members/{uid}{…, inviteCode, phoneKey}` + `users/{uid}` — commits atomically and is rules-safe by the mutual-consistency argument above.

**Rules-unit test (required, `@firebase/rules-unit-testing`) must prove:** (1) a signed-in **non-owner cannot LIST** invites; (2) a signed-in user **cannot self-create an `owner`** member on an **already-existing** business; (3) a user **cannot claim-create an `employee`** member without a matching **unused** invite, or with a **mismatched `phoneKey`**; (4) the legit **owner-create** (fresh business) and **employee-claim** (matching unused invite) paths still **succeed**.

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
  role: 'owner' | 'employee' | null
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
  chooseRole(role: 'owner' | 'employee'): Promise<import('./membership').RoleRoute>  // routes: owner → create; employee → join
  createOwnerBusiness(input: import('../tenancy/business').NewBusinessInput): Promise<void> // createBusiness + seed the local BusinessProfile (shopName/traderName/phone) so Settings + receipt header show it; → status 'ready'
  joinByCode(input: { code: string; phoneE164: string; name: string }): Promise<void> // claim invite → status 'ready'
  signOut(): Promise<void>
}
export function AuthProvider(props: { children: React.ReactNode }): JSX.Element
export function useAuth(): AuthContextValue
```

Routing rule the `AuthGate` implements from `status`: `loading` → splash; `signed-out` → `<LoginScreen/>` (a single **Continue with Google** button); `onboarding` → `<OnboardingFlow/>` (name → role chooser → owner-create-business | employee-join-by-code); `ready` → the app (`{children}`) with the gated home header. **No new App-Router routes** — the gate swaps surfaces by conditional rendering (static-export-safe). Session persists across reloads (LOCAL persistence); on reload `status` resolves **purely from `users/{uid}.bizId`** without re-sign-in (no phone lookup).

> **Removal-safety:** because recognition is now purely `users/{uid}.bizId`, a member an owner removed still has their `bizId` set but is no longer in `businesses/{bizId}/members`. When the AuthProvider resolves a user with a `bizId`, it confirms the `members/{uid}` doc still exists; if it is gone (removed), it clears the user's own `users/{uid}.{bizId, role}` (a permitted self-write) and returns them to onboarding rather than leaving them stuck at a `ready` screen whose reads the rules reject.

### Role routing + invite logic — `lib/auth/membership.ts` (pure, unit-tested)

Recognition of returning users happens **before** onboarding (via `users/{uid}.bizId`), so the role chooser only routes a genuinely-new user to the correct onboarding sub-screen. The invite-check and code-generation logic are pure and unit-tested (they are what the JoinByCode and Generate-code flows call).

```ts
export type Role = 'owner' | 'employee'

// Role chooser is now a trivial 2-way route (no phone lookup — one-person-one-business is
// enforced upstream because a user with a bizId never reaches onboarding at all):
export type RoleRoute = { kind: 'create' } | { kind: 'join' }
export function routeRole(chosenRole: Role): RoleRoute   // 'owner' → 'create'; 'employee' → 'join'

// Shape read from invites/{code} (see the collection-path map):
export interface InviteRecord {
  code: string; bizId: string; role: 'employee'
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

// Owner creates an invite from a MOBILE ALONE (random code, retry on the rare id collision).
// Writes invites/{code} with status:'unused' and a blank displayName (the employee's name is
// captured at claim time from their Google login). Returns the record so the UI shows the code.
export function createInvite(
  owner: AppUser, bizId: string, employeePhoneE164: string,
): Promise<InviteRecord>
export function getInvite(code: string): Promise<InviteRecord | null>          // reads invites/{code}
export function listPendingInvites(bizId: string): Promise<InviteRecord[]>      // status === 'unused', for the roster
export function cancelInvite(code: string): Promise<void>                       // owner deletes an unused invite
// claimInvite runs the JoinByCode redemption in one atomic writeBatch (rules-safe: the members-create
// rule reads the invite's still-COMMITTED 'unused' state; the invite-update rule enforces unused→claimed):
//   - flip invites/{code} → status:'claimed', claimedByUid, claimedAt
//   - write businesses/{bizId}/members/{uid} (employee, active; inviteCode:code, phoneKey:phoneKey(phoneE164);
//     addedBy* + createdAt copied from the invite) — inviteCode + phoneKey are REQUIRED by the members rule
//   - set users/{uid}.{ bizId, role:'employee', phone, email }
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
export function listMembers(bizId: string): Promise<MemberRecord[]>       // CLAIMED roster (members subcollection)
// removeEmployee deletes businesses/{bizId}/members/{uid}. (The removed user's own users/{uid}.bizId is cleared
// by that user's client on their next load — see the removal-safety note above — since rules forbid writing
// another user's users doc.) Past attribution snapshots are left intact.
export function removeEmployee(bizId: string, member: { uid: string; phone: string }): Promise<void>
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
- A shared helper **`tests/e2e/support/auth.ts` → `signInTestOwner(page, { bizName })`** drives Google-popup → (onboarding-if-shown: name → Owner → shop+mobile) → app so every retained journey spec authenticates first; a dedicated `auth-onboarding.spec.ts` (sorts first, `workers: 1`) asserts the full Google-sign-in → name → owner-creates-business → gated-home path, plus the **owner-generates-code → second Google identity joins by code** round-trip.
