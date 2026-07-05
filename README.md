# Anaj Bahi (अनाज बही) — Grain Purchase Ledger PWA

An installable, **offline-first** mobile PWA that replaces a village grain trader's paper
receipt-and-payment book. The trader records each purchase from a farmer — grain type,
price per **quintal (100 kg)**, and every individual **sack weight, sack by sack** — and the
app computes deductions, net weight, per-grain amounts, and the bill total exactly. Bills are
saved locally on the phone (IndexedDB) with **zero internet**, and browsable in a bill list.
The UI is bilingual **Hindi (Devanagari) + English** with a toggle.

> This is a deterministic local-first data/ledger app. **There is no AI / LLM / agent** of any
> kind — see [`spec/agent.md`](spec/agent.md).

The full spec lives in [`spec/`](spec/) — start with [`spec/roadmap.md`](spec/roadmap.md) and
[`spec/architecture.md`](spec/architecture.md).

## Stack

- **Frontend:** Next.js 15 (App Router, static export, `basePath: /app`) + React 19 + Tailwind CSS 4
- **Local store:** IndexedDB via **Dexie 4** (the source of truth on the device)
- **PWA:** hand-written service worker + web manifest (installable, offline app-shell)
- **Tests:** Vitest + fake-indexeddb (unit), Playwright (E2E)
- **Package manager:** **pnpm**
- **Phase 4 only (not yet built):** a FastAPI + Postgres cloud-sync/backup service under `backend/`

**Phase 1 needs no backend, no server database, no API keys, and no `.env`.**

## Running it

> All commands run from the **`frontend/`** directory.

```bash
cd frontend
pnpm install      # install dependencies
pnpm dev          # start the dev server on port 3000
```

Then open **http://localhost:3000/app/** (note the `/app` basePath and trailing slash) on an
Android phone (or Chrome device-mode). Optionally "Add to Home screen" and enable airplane mode —
the app runs and persists fully offline.

### Other commands (from `frontend/`)

```bash
pnpm build        # production static export -> frontend/out/
pnpm lint         # lint
pnpm test         # unit tests (vitest run) - calc + data layer
pnpm test:e2e     # end-to-end tests (playwright) - primary purchase journey
```

## What Phase 1 delivers

The full primary purchase-capture journey, offline and first-time-right:

1. **+ New Bill** - pick/enter a farmer (autocomplete against saved farmers), purchase date, and an
   auto-generated bill id of the form `DDMMYY/xxxxx`.
2. **Add grain lines** - choose a grain type (seeded list: wheat, paddy, mustard, gram, soybean,
   maize, bajra), enter price per quintal, and add **sack weights one at a time** - with a
   scrollable list of the weights already entered plus a running **sack count and total** shown
   directly above the input.
3. **Deductions** - one or more per grain line (per-sack kg, per-quintal kg, % of gross, or flat kg).
4. **Live totals** - net weight, per-line amount, and bill total compute live and exactly
   (quintal = 100 kg).
5. **Save** - persisted to IndexedDB; appears in the bill list; reopen it to see identical data.
6. **Hindi/English toggle** - switches all chrome instantly and is remembered across launches.
7. **Installable PWA shell** - manifest + service worker.

Payments, the due/overdue list, cloud sync, share-as-image, and search filters appear as clearly
labelled **"coming soon"** stubs and are built in later phases (see
[`spec/roadmap.md`](spec/roadmap.md)).
