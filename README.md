# Anaj Bahi (अनाज बही) — Grain Purchase Ledger PWA

An installable, **offline-first** mobile PWA that replaces a village grain trader's paper
receipt-and-payment book. The trader records each purchase from a farmer — grain type,
price per **quintal (100 kg)**, and every individual **sack weight, sack by sack** — and the
app computes deductions, net weight, per-grain amounts, and the bill total exactly. Bills are
saved to **Cloud Firestore with offline persistence** — they work with **zero internet**
(local-first) and **sync automatically** to the shared business ledger across devices when
signal returns — browsable/searchable, tracked for partial payments and dues, and shareable as
an image receipt. The UI is bilingual **Hindi (Devanagari) + English** with a toggle.

> This is a deterministic local-first data/ledger app. **There is no AI / LLM / agent** of any
> kind — see [`spec/agent.md`](spec/agent.md).

The full spec lives in [`spec/`](spec/) — start with [`spec/roadmap.md`](spec/roadmap.md) and
[`spec/architecture.md`](spec/architecture.md).

## Stack

- **Frontend:** Next.js 15 (App Router, static export, `basePath` = `NEXT_PUBLIC_BASE_PATH` — default `/app`) + React 19 + Tailwind CSS 4
- **Auth:** **Firebase Phone Authentication** (SMS-OTP) — the trader is identified by their phone number
- **Data store:** **Cloud Firestore** with offline persistence (`persistentLocalCache`) — a local-first store that reads/writes instantly on-device and syncs the shared business ledger automatically
- **PWA:** hand-written service worker + web manifest (installable, offline app-shell)
- **Receipt image:** client-side rasterization via `html-to-image` + the Web Share API
- **Tests:** Vitest (frontend unit), Playwright (E2E against real Firebase)
- **Package manager:** **pnpm** (frontend)

## Running the app (frontend) — works fully offline

> All frontend commands run from the **`frontend/`** directory. No `.env`/keys needed for the app itself.

```bash
cd frontend
pnpm install
pnpm dev
```

Then open **http://localhost:3000/app/** (note the `/app` basePath and trailing slash) on an
Android phone (or Chrome device-mode). Optionally "Add to Home screen" and enable airplane mode —
the app runs and persists fully offline (writes queue locally and sync when signal returns).

> The app needs Firebase web config to run — set the `NEXT_PUBLIC_FIREBASE_*` values in
> `frontend/.env.local` (see [Firebase setup](#firebase-setup-auth--data) below and `.env.example`).

### Other frontend commands (from `frontend/`)

```bash
pnpm build        # production static export -> frontend/out/ (default basePath /app)
pnpm build:pages  # production build + base-path rewrite for GitHub Pages (see Deployment)
pnpm lint         # lint
pnpm test         # unit tests (vitest run) - calc / data layers
pnpm test:e2e     # end-to-end tests (playwright) - full journeys against real Firebase
```

E2E runs against real Firebase using a registered **test phone number** (fixed OTP, no SMS
sent). It needs the same `NEXT_PUBLIC_FIREBASE_*` config in `frontend/.env.local`, plus an
optional `FIREBASE_SERVICE_ACCOUNT` (path to an Admin-SDK JSON key) so global-setup can reset
the test user via the privileged Admin SDK; without it, global-setup falls back to the client SDK.

The static export's URL sub-path is parameterized by **`NEXT_PUBLIC_BASE_PATH`** (default `/app` —
keep it unset for local dev, `pnpm build`, and E2E). The GitHub Pages production build sets it to
`/anaj-bahi` and runs `pnpm build:pages` (which also rewrites the `/app` literals in the exported
`manifest.webmanifest` / `sw.js`).

## Firebase setup (auth + data)

There is **no self-hosted backend** — identity and data are Firebase. Auth is **Firebase Phone
Authentication** (SMS-OTP; the trader is identified by their phone number) and the ledger lives in
**Cloud Firestore** with offline persistence. Configure it entirely from the frontend:

1. Create a Firebase project and enable **Authentication → Phone** and **Cloud Firestore**.
2. Add a **Web app** and copy its config into `frontend/.env.local` (see `.env.example`):
   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```
   These 6 values are **public web config** (build-time inlined), not secrets — real access
   control is the Firestore Security Rules in [`firestore.rules`](firestore.rules).
3. In **Authentication → Settings → SMS region policy**, make sure the **user's country is
   allowed** (otherwise OTP delivery is blocked). For automated E2E, register the test phone
   number under **Phone numbers for testing** with a fixed code.
4. For the E2E global-setup reset, optionally set `FIREBASE_SERVICE_ACCOUNT` in `frontend/.env.local`
   to the path of an Admin-SDK JSON key.

Sync is **automatic** — Firestore flushes queued local writes on reconnect. The app's
**Settings → Sync** section only surfaces the online/offline + pending/synced state and offers a
manual **Sync now**; there is no URL or token to enter.

## Features (all phases complete)

1. **Purchase capture** — create a bill (farmer autocomplete, `DDMMYY/xxxxx` id, seeded grain
   types), enter sack weights one-by-one with a live running list/count/total, configure
   deductions (per-sack kg / per-quintal kg / % of gross / flat kg), watch net weight / line
   amount / bill total compute live and exactly (quintal = 100 kg). Saved to Cloud Firestore.
2. **Quick-entry (summary) bills** — capture a purchase already written on paper without the
   sack-by-sack breakdown: farmer, grain, price, total weight, and amount straight in.
3. **Payments & finding bills** — partial payments + outstanding balance + payment history; a
   due/overdue list; the edit-lock rule (a bill locks once a payment is recorded); and
   search/filter by farmer name, place, date, and grain type.
4. **Shareable image receipt** — a business profile in Settings populates a clean bilingual
   receipt (business header, full sack-by-sack breakdown, per-grain amounts, total) that is
   rasterized client-side and shared via the phone's native share sheet, with a download fallback.
5. **Phone auth & shared cloud ledger** — sign in with **Firebase Phone (SMS-OTP)** — the trader
   is identified by their phone number; the ledger lives in **Cloud Firestore** with offline
   persistence, so writes always work offline and sync automatically to the shared business ledger
   across devices when signal returns.
6. **Multi-user with roles (owner / employee)** — an owner creates a business and invites
   employees by phone number; everyone shares one ledger. The owner manages the employee roster
   and the business profile; employees record bills and payments but cannot edit the business or
   manage staff. Boundaries are enforced by **Firestore Security Rules** (`firestore.rules`), not
   just the UI.
7. **Per-action attribution & owner-only activity log** — every bill-create, edit, and payment is
   stamped with the actor who did it; the owner sees a live, newest-first **activity log** of who
   did what. The log is owner-only (Rules-enforced); employees are refused it.

Everything is bilingual Hindi/English, mobile-first, an installable **PWA**, and runs with **no
backend to operate** (identity and data are hosted Firebase).

## Deployment

- **Frontend → GitHub Pages** at `https://singhalvivek.github.io/anaj-bahi/` (production basePath
  `/anaj-bahi`), built and published by `.github/workflows/deploy-pages.yml`.
- **No backend to deploy** — auth and data are hosted Firebase (Phone Auth + Cloud Firestore). The
  app deploys to GitHub Pages **unchanged**; just ensure the production build has the
  `NEXT_PUBLIC_FIREBASE_*` config and the Firestore Security Rules (`firestore.rules`) are published.

Copy-paste steps are in [`DEPLOY.md`](DEPLOY.md).
