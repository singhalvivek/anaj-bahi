# Anaj Bahi (अनाज बही) — Grain Purchase Ledger PWA

An installable, **offline-first** mobile PWA that replaces a village grain trader's paper
receipt-and-payment book. The trader records each purchase from a farmer — grain type,
price per **quintal (100 kg)**, and every individual **sack weight, sack by sack** — and the
app computes deductions, net weight, per-grain amounts, and the bill total exactly. Bills are
saved locally on the phone (IndexedDB) with **zero internet**, browsable/searchable, tracked for
partial payments and dues, shareable as an image receipt, and backed up to a personal cloud
service when signal returns. The UI is bilingual **Hindi (Devanagari) + English** with a toggle.

> This is a deterministic local-first data/ledger app. **There is no AI / LLM / agent** of any
> kind — see [`spec/agent.md`](spec/agent.md).

The full spec lives in [`spec/`](spec/) — start with [`spec/roadmap.md`](spec/roadmap.md) and
[`spec/architecture.md`](spec/architecture.md).

## Stack

- **Frontend:** Next.js 15 (App Router, static export, `basePath` = `NEXT_PUBLIC_BASE_PATH` — default `/app`) + React 19 + Tailwind CSS 4
- **Local store:** IndexedDB via **Dexie 4** (the source of truth on the device)
- **PWA:** hand-written service worker + web manifest (installable, offline app-shell)
- **Receipt image:** client-side rasterization via `html-to-image` + the Web Share API
- **Cloud sync/backup backend:** **FastAPI + SQLite** (SQLAlchemy 2.0, managed with `uv`) under [`backend/`](backend/) — a single-file DB, no DB server needed
- **Tests:** Vitest + fake-indexeddb (frontend unit), Playwright (E2E, incl. the live backend), pytest (backend)
- **Package managers:** **pnpm** (frontend), **uv** (backend)

## Running the app (frontend) — works fully offline

> All frontend commands run from the **`frontend/`** directory. No `.env`/keys needed for the app itself.

```bash
cd frontend
pnpm install
pnpm dev
```

Then open **http://localhost:3000/app/** (note the `/app` basePath and trailing slash) on an
Android phone (or Chrome device-mode). Optionally "Add to Home screen" and enable airplane mode —
the app runs and persists fully offline. On first launch you set a 4-digit PIN.

### Other frontend commands (from `frontend/`)

```bash
pnpm build        # production static export -> frontend/out/ (default basePath /app)
pnpm build:pages  # production build + base-path rewrite for GitHub Pages (see Deployment)
pnpm lint         # lint
pnpm test         # unit tests (vitest run) - calc / data / sync layers
pnpm test:e2e     # end-to-end tests (playwright) - full journeys incl. live backend sync
```

The static export's URL sub-path is parameterized by **`NEXT_PUBLIC_BASE_PATH`** (default `/app` —
keep it unset for local dev, `pnpm build`, and E2E). The GitHub Pages production build sets it to
`/anaj-bahi` and runs `pnpm build:pages` (which also rewrites the `/app` literals in the exported
`manifest.webmanifest` / `sw.js`).

## Running the cloud-sync backend (optional — for backup/restore)

> Backend commands run from the **`backend/`** directory. This is the ONLY part that needs `.env`.

```bash
cd backend
cp .env.example .env         # then set DEVICE_TOKEN to a long random string
uv sync                      # install dependencies
uv run python -m app.init_db # create the SQLite DB + tables (data/anaj.db)
uv run uvicorn app.main:app --port 8000
```

Health check: `GET http://localhost:8000/health` → `{"status":"ok"}`.
In the app, open **Settings → Cloud backup**, enter the backend base URL (`http://localhost:8000`)
and the **same `DEVICE_TOKEN`**, then use **Back up now** / **Restore**. `.env` variables:
`DATABASE_URL` (default `sqlite:///./data/anaj.db`) and `DEVICE_TOKEN` (the shared secret that
gates the sync endpoints). See [`backend/README.md`](backend/README.md).

## Features (all phases complete)

1. **Purchase capture** — create a bill (farmer autocomplete, `DDMMYY/xxxxx` id, seeded grain
   types), enter sack weights one-by-one with a live running list/count/total, configure
   deductions (per-sack kg / per-quintal kg / % of gross / flat kg), watch net weight / line
   amount / bill total compute live and exactly (quintal = 100 kg). Saved to IndexedDB.
2. **Security, payments & finding bills** — required 4-digit PIN lock (salted-hashed, re-locks on
   reload; data-safe reset); partial payments + outstanding balance + payment history; a
   due/overdue list; the edit-lock rule (a bill locks once a payment is recorded); and
   search/filter by farmer name, place, date, and grain type.
3. **Shareable image receipt** — a business profile in Settings populates a clean bilingual
   receipt (business header, full sack-by-sack breakdown, per-grain amounts, total) that is
   rasterized client-side and shared via the phone's native share sheet, with a download fallback.
4. **Cloud sync & backup** — offline-first backup to the FastAPI + SQLite backend: local writes
   always work offline; the queue flushes when online (idempotent, last-write-wins by id); and a
   **Restore** reproduces all bills/farmers/payments/profile onto a fresh device.

Everything is bilingual Hindi/English and mobile-first.

## Deployment

- **Frontend → GitHub Pages** at `https://singhalvivek.github.io/anaj-bahi/` (production basePath
  `/anaj-bahi`), built and published by `.github/workflows/deploy-pages.yml`.
- **Backend → Fly.io** as a FastAPI + SQLite service with the DB file on a persistent volume.

Copy-paste steps for both are in [`DEPLOY.md`](DEPLOY.md).
