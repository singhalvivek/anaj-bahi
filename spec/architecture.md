# Architecture — Anaj Bahi

> Deterministic, offline-first PWA. **No AI/LLM/agent framework** anywhere in this project — see [agent.md](agent.md).

---

## System Overview

Anaj Bahi is a single-user, installable **Next.js PWA** that runs entirely on the trader's phone. In Phase 1 there is **no backend and no network dependency**: the browser is the whole runtime. The UI (React 19 client components) reads and writes an **IndexedDB** database via **Dexie**; a pure TypeScript **calc module** computes all weights and money; a **service worker** caches the app shell so it launches offline; a lightweight **i18n context** swaps Hindi/English. Later phases add an optional Python/FastAPI + **SQLite** **sync backend** that the same client talks to only when online — the local IndexedDB store always remains the source of truth on the device.

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

- **Mode:** Greenfield (built by this harness). Extends the existing `frontend/` Next.js skeleton in place.
- **Language:** TypeScript 5 (frontend). Python 3.12 for the Phase-4 sync backend only.
- **Agent framework:** **None.** No LLM, no agent orchestration. See [agent.md](agent.md).
- **LLM provider + model:** **None** — not an AI app.
- **Frontend:** Next.js 15.3 (App Router) + React 19, **static export** (`output: 'export'`, `basePath: '/app'`, `trailingSlash: true`), Tailwind CSS 4. Installable PWA (manifest + hand-written service worker).
- **Local store:** **IndexedDB via Dexie 4** (Phase 1 onward). No server DB on device.
- **Backend (Phase 4 only):** FastAPI + **SQLite** + SQLAlchemy 2.0, managed with `uv`. Lives under a new `backend/` tree; not present in Phases 1–3. **Rationale for SQLite (user stack decision):** this is a single-user, low-concurrency personal-backup app — SQLite needs **no DB server, no Docker, no hosted database**; it runs directly from a local `data/*.db` file, is fully testable on this machine now, and deploys to a cheap single-VM host with a persistent disk. No Alembic: for this schema-light JSON-row model, tables are created via SQLAlchemy `Base.metadata.create_all(...)` driven by an explicit `uv run python -m app.init_db` step (Alembic would be overkill).
- **Dependency management:** **pnpm** (frontend); `uv` (Phase-4 backend).
- **Observability:** N/A in the AI sense. Client errors surface as visible UI messages; dev uses browser devtools. (There is no LLM tracing because there is no LLM.)

> **Assumed:** unit tests use **Vitest** + **fake-indexeddb** (idiomatic, fast, TS-native) and E2E uses **Playwright** (already available in the repo). No heavy i18n library — a hand-rolled context + typed dictionary covers two languages.

> **Assumed:** the Next.js app keeps its existing home under **`frontend/`** (the real source tree already present); all app code lives there, never loose at repo root. The Phase-4 backend gets its own **`backend/`** tree.

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

### Phase-4 backend commands (cwd `backend/`)

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

Static export (`frontend/out/`) served as plain files under a `basePath` — installable to the Android home screen and fully functional offline. The Phase-4 backend deploys separately as a small FastAPI service backed by a single **SQLite** file on a persistent disk.

**Concrete targets** (copy-paste steps in [`../DEPLOY.md`](../DEPLOY.md)):

- **Frontend → GitHub Pages** (repo `anaj-bahi`) at `https://singhalvivek.github.io/anaj-bahi/`. The `basePath` is parameterized by `NEXT_PUBLIC_BASE_PATH` (default `/app`; production `/anaj-bahi`). The workflow `.github/workflows/deploy-pages.yml` runs `pnpm build:pages` with `NEXT_PUBLIC_BASE_PATH=/anaj-bahi`, adds `.nojekyll`, and publishes `frontend/out/` via GitHub Pages. The postbuild `scripts/apply-base-path.mjs` rewrites the `/app` literals in the exported `manifest.webmanifest`/`sw.js` (a no-op at the default `/app`, so local dev + E2E are untouched).
- **Backend → PythonAnywhere** (free tier, no card): a FastAPI + SQLite service. PythonAnywhere serves **WSGI**, so the ASGI app runs through the WSGI adapter in `backend/wsgi.py`, which drives it with a **fresh event loop per request** (a shared-loop wrapper like `a2wsgi` deadlocks under PythonAnywhere's uWSGI after the first request). The SQLite file lives on the **persistent home disk** (`DATABASE_URL=sqlite:////home/<user>/anaj-bahi/backend/data/anaj.db` — four slashes = absolute path). `DEVICE_TOKEN` + `DATABASE_URL` are set in the PythonAnywhere WSGI config file (never committed). `python -m app.init_db` is run once to create the tables.

The app works fully offline without the backend; the backend is only for optional cloud backup/restore.

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

## Phase-4 sync contract

> **Frozen.** Backend (slice-a) and frontend (slices b/c) build against this in parallel — the wire shapes, auth, storage model, and the frontend `lib/sync` API below do not change during the Phase-4 build. Backend is **FastAPI + SQLite**; the local IndexedDB store always remains the device source of truth.

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
