# Architecture — Anaj Bahi

> Deterministic, offline-first PWA. **No AI/LLM/agent framework** anywhere in this project — see [agent.md](agent.md).

---

## System Overview

Anaj Bahi is a single-user, installable **Next.js PWA** that runs entirely on the trader's phone. In Phase 1 there is **no backend and no network dependency**: the browser is the whole runtime. The UI (React 19 client components) reads and writes an **IndexedDB** database via **Dexie**; a pure TypeScript **calc module** computes all weights and money; a **service worker** caches the app shell so it launches offline; a lightweight **i18n context** swaps Hindi/English. Later phases add an optional Python/FastAPI + Postgres **sync backend** that the same client talks to only when online — the local IndexedDB store always remains the source of truth on the device.

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
                        FastAPI sync service ──► Postgres   (backup)
```

## Layers

| Layer | Responsibility |
|-------|----------------|
| **UI (App Router client components)** | Screens, forms, the sack-by-sack interaction, language toggle, "coming soon" stubs. Owns no business math. |
| **i18n (`lib/i18n`)** | Language state (Hindi/English) + string dictionary; provider + `useI18n()` hook; persists choice to `localStorage`. |
| **Calc (`lib/calc`)** | Pure, side-effect-free functions: deduction resolution, net weight, line amount, bill total, rounding. Fully unit-tested. |
| **Data (`lib/db`)** | Dexie schema, repository functions (farmers/grain-types/bills), grain-type seed, bill-id generator. Only layer that touches IndexedDB. |
| **PWA shell (`public/sw.js`, `manifest.webmanifest`)** | Cache-first app shell for offline launch + home-screen install. |
| **Sync (Phase 4)** | Outbox + sync engine (frontend) and FastAPI/Postgres service (backend). |

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
- **Backend (Phase 4 only):** FastAPI + Postgres 16 + SQLAlchemy 2.0, managed with `uv`, migrations via Alembic. Lives under a new `backend/` tree; not present in Phases 1–3.
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
| Production build | `pnpm build` (cwd `frontend/`) — static export to `frontend/out/` |
| Lint command | `pnpm lint` (cwd `frontend/`) |
| Unit test command | `pnpm test` → `vitest run` (cwd `frontend/`) |
| E2E / UI test command | `pnpm test:e2e` → `playwright test` (cwd `frontend/`); Playwright `webServer` runs `pnpm dev`, `baseURL` `http://localhost:3000/app/` |
| Migration command | **N/A in Phases 1–3** (Dexie handles IndexedDB schema versioning in-app). Phase 4 backend only: `uv run alembic upgrade head` (cwd `backend/`) |
| Phase-1 gate | `pnpm install && pnpm test && pnpm build && pnpm test:e2e` (cwd `frontend/`) |

**`package.json` scripts to add (owned by slice-a):** `"test": "vitest run"`, `"test:e2e": "playwright test"`.

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

Static export (`frontend/out/`) served as plain files under `/app` — installable to the Android home screen and fully functional offline. The Phase-4 backend deploys separately as a small FastAPI service with Postgres.

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
