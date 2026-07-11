# Anaj Bahi — Build & Deploy Session Log

> A reconstructed narrative of the Claude Code session that built and deployed Anaj Bahi.
> This is a faithful summary of decisions, commands, and fixes — not a verbatim chat transcript.
> Author: Claude (Opus 4.8) working with the repo owner (singhalvivek).

---

## 1. What was built

**Anaj Bahi (अनाज बही)** — a grain-purchase receipt & payment ledger, built for the owner's father,
a grain trader in a small Indian village, to replace paper records.

- **Platform:** installable, mobile-first **PWA**, offline-first.
- **Language:** bilingual **Hindi / English** toggle (UI + printed receipt).
- **Security:** required 4-digit PIN on open.
- **Not an AI app** — the harness's LLM/agent slot was skipped entirely; no API keys.
- **Money model:** ₹ INR, weights in **kg**, price per **quintal (100 kg)**.

### Domain model
- **Farmer** (reusable, autocomplete): name, village, phone.
- **Bill** (`DDMMYY/xxxxx` id): one farmer, purchase date, 1..N grain line-items.
- **Grain line-item:** grain type, price/quintal, sack-by-sack kg weights, and one or more
  **deductions** (per-sack kg / per-quintal kg / % of gross / flat kg).
  - net = gross − deductions; amount = (net kg ÷ 100) × price/quintal.
- **Bill total** = Σ line amounts.
- **Payments:** partial, each with date; outstanding balance; edit-locks after first payment.

### Signature UI
Sack-by-sack weight entry: numeric field with a **scrolling list of already-entered weights above it**
plus a running sack count + total.

---

## 2. Intake decisions (locked at the start)

| Question | Decision |
|---|---|
| Platform | Installable mobile PWA |
| Connectivity | Offline-first + cloud sync/backup |
| Language | Bilingual Hindi + English |
| Share a bill | As an **image** via the phone share sheet |
| Overview screens | Just the bill list first (dashboards later) |
| Reminders | In-app "due soon / overdue" list (no push) |
| Editing | Editable until first payment, then locked |
| Farmers | Saved list with autocomplete |
| Deductions | Trader chooses basis + amount per line |
| Bill id | `DDMMYY/xxxxx` (date + short random code) |
| PIN | Required at first run |
| Sync backend | Custom **FastAPI**; DB changed to **SQLite** (from Postgres) — single user, no server needed |

---

## 3. Build phases (each tested by the human before the next)

- **Phase 1 — Purchase capture:** sack-by-sack entry, exact per-quintal math, IndexedDB persistence,
  bill list + reopen, Hindi/English toggle, installable PWA shell.
- **Phase 2 — Security, payments & finding bills:** 4-digit PIN lock, partial payments + outstanding
  balance (+ "advance" credit on overpay), due/overdue list, edit-lock rule, search/filter.
- **Phase 3 — Shareable image receipt:** business profile in Settings → bilingual receipt, shared as a
  **PNG** via the native share sheet (download fallback on desktop).
- **Phase 4 — Cloud sync & backup:** FastAPI + **SQLite** backend, offline-first mutation queue that
  flushes when online, backup + restore-onto-a-new-device.

Each phase passed its gate (unit + E2E against the real path) and the human "It works well" review.

---

## 4. Receipt redesign (post-build change requests)

The father's paper ledger lists sack weights in **columns of ~10** with a subtotal under each column.
The receipt image was reworked to match:

1. **Column grid** of weights (no sack numbers), grains flowing left-to-right; each grain takes
   `ceil(sacks/10)` columns; per-column subtotals; max 100 sacks / 10 columns.
2. **Consolidated summary table** below the grid: grains as **columns**, rows = Gross / Deduction /
   Net / Rate / Amount, then the bill total.

### Two follow-up fixes
- **Crop bug:** the summary table sat in an `overflowX:auto` box at `width:100%`, clipping the last
  grain column in the preview *and* the PNG. Fixed → table `width: max-content`, no inner overflow.
- **Units:** net weight now shows **kg only** (quintal stays only on the rate row) — the trade standard.

Guarded by a 3-grain E2E crop test; verified 8/8 E2E.

---

## 5. Deployment

### Frontend → GitHub Pages
- Static export (`output: 'export'`), base path parameterized by `NEXT_PUBLIC_BASE_PATH`
  (default `/app` for local/dev/E2E; **`/anaj-bahi`** in production).
- `frontend/scripts/apply-base-path.mjs` rewrites `/app` → base in the exported `manifest.webmanifest`
  + `sw.js`. Workflow: `.github/workflows/deploy-pages.yml`.
- Live at **https://singhalvivek.github.io/anaj-bahi/**
- Repo: a **dedicated `anaj-bahi` GitHub repo** (pushed from the harness branch:
  `git remote add anajbahi …; git push anajbahi feature/anaj-bahi-v0.1:main`).

#### CI hurdles fixed (in order)
1. GitHub auto-added a generic `nextjs.yml` that builds at repo root → **deleted** it (app is in `frontend/`).
2. `Install dependencies` failed: `packages field missing or empty` — pnpm 9 rejects the settings-only
   `frontend/pnpm-workspace.yaml`. **Bumped CI pnpm 9 → 11** to match local.
3. pnpm 11 needs Node ≥ 22.13 (`node:sqlite`) → **bumped workflow Node 20 → 22**.
4. First `deploy-pages` run 502'd (brand-new Pages site) → **re-ran** → green.

### Backend → PythonAnywhere (free, no card)
- **Fly.io was abandoned:** it now requires a credit card to create any app. All Fly config
  (`fly.toml`, `Dockerfile`, `.dockerignore`) and the flyctl install were removed.
- **PythonAnywhere** chosen: free Beginner plan, **no card**, **persistent home disk** (SQLite survives),
  HTTPS. Its web apps are **WSGI**, so the FastAPI (ASGI) app runs via `backend/wsgi.py`.

#### The WSGI hang — root cause & fix
- First tried `a2wsgi`. Symptom on PythonAnywhere: the worker loaded fine and served **1–2 requests**,
  then every request **hung to the 300 s harakiri timeout** (504/499 in the access log). Yet the app
  worked perfectly when called directly in a console — so the code was correct.
- **Cause:** `a2wsgi` runs the ASGI app on a **single shared background event-loop thread**, which
  deadlocks under PythonAnywhere's uWSGI.
- **Fix:** replaced it with a small adapter in `backend/wsgi.py` that drives the ASGI app with a
  **fresh event loop per request** (build the http scope from the WSGI environ, run `app()` to
  completion, return the buffered response). Verified locally: 5× `/health` + auth 401/200/401, and
  backend pytest 11/11. `a2wsgi` dependency removed.

#### PythonAnywhere setup (username `vivekagarwal`)
1. Bash console: `git clone https://github.com/singhalvivek/anaj-bahi.git`; `cd anaj-bahi/backend`
2. `mkvirtualenv anaj --python=/usr/bin/python3.10` (3.11 venv came out broken → 3.10 works)
3. `pip install fastapi sqlalchemy pydantic-settings`
4. `python -m app.init_db` (with `DATABASE_URL` + `DEVICE_TOKEN` exported)
5. Web → **Manual configuration** (Python 3.10) → set source/workdir/virtualenv
6. WSGI file: put `/home/vivekagarwal/anaj-bahi/backend` on `sys.path`, set `DATABASE_URL` +
   `DEVICE_TOKEN` in `os.environ`, `from wsgi import application`
7. **Reload** → `https://vivekagarwal.pythonanywhere.com/health` → `{"status":"ok"}`
8. Connect in the PWA: **Settings → Cloud backup** → backend URL + the same device token.

**To update the backend later:** `cd ~/anaj-bahi && git pull` → **Reload** the web app.
Free web apps need a renewal click every ~3 months.

---

## 6. Key technical decisions & why

- **SQLite over Postgres** for sync: single user, low concurrency → no DB server/Docker/hosted DB.
- **PythonAnywhere over Fly.io:** Fly requires a card; PythonAnywhere is free + no card + persistent disk.
- **Fresh-event-loop-per-request WSGI adapter over a2wsgi:** a2wsgi's shared loop deadlocks under uWSGI.
- **Base path parameterized (`NEXT_PUBLIC_BASE_PATH`):** keeps local dev on `/app` while Pages uses
  `/anaj-bahi`, so E2E/dev are never disturbed by the production path.
- **CI pnpm/Node bumped to match local (pnpm 11 / Node 22):** the local toolchain is the source of truth.

---

## 7. Repos, branches, live URLs

- **Product repo (deployed):** https://github.com/singhalvivek/anaj-bahi — branch `main`.
- **Harness repo (origin of the build):** https://github.com/singhalvivek/super-duper-harness —
  branch `feature/anaj-bahi-v0.1` (open/merge the PR to keep its `main` current).
- **App (live):** https://singhalvivek.github.io/anaj-bahi/
- **Backend (live):** https://vivekagarwal.pythonanywhere.com

### Notable commits (on `anaj-bahi/main`)
- `5ffd1fa` fix(backend): fresh event loop per request under WSGI
- `cb9e886` deploy: drop Fly.io, standardize on PythonAnywhere
- `15599ac` backend WSGI entry point (initial a2wsgi version)
- `66341c4` CI Node 22 · `5c4e4df` CI pnpm 11 · `6d5eb6e` remove GitHub's default nextjs.yml
- Frontend build history: phase-1 → phase-2 → phase-3 → phase-4 → receipt redesign → crop/units fix → deploy config

---

## 8. Current state & optional next steps

**Done:** app built (4 phases) + receipt refinements, deployed to GitHub Pages, backend on PythonAnywhere,
cloud backup/restore working, "Add to Home screen" install verified.

**Optional / open:**
- Merge the `super-duper-harness` PR (`feature/anaj-bahi-v0.1` → `main`).
- **Play Store app** via a **TWA** (wrap the live PWA with PWABuilder; `$25` Google Play fee; the
  `/.well-known/assetlinks.json` is cleaner with a custom domain).
- A cheap **custom domain** (~₹700/yr) — nicer URL + cleaner TWA verification.
- Native features later (biometric unlock, native camera) → Capacitor, not a rewrite.

---

## 9. Run commands (reference)

```sh
# Frontend (local dev)
cd frontend && pnpm install && pnpm dev        # -> http://localhost:3000/app/

# Frontend (production static export -> frontend/out/)
cd frontend && NEXT_PUBLIC_BASE_PATH=/anaj-bahi pnpm build:pages

# Backend (local dev)
cd backend && uv sync && uv run python -m app.init_db
uv run uvicorn app.main:app --port 8000        # health: GET /health

# Backend tests
cd backend && uv run pytest
```
