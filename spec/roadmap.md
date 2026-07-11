# Roadmap — Anaj Bahi (अनाज बही)

> **Product name:** **Anaj Bahi** (अनाज बही) — literally "Grain Ledger" (*anaj* = grain, *bahi* = the traditional Indian ledger/account book, *bahi-khata*). It is bilingual-friendly, instantly meaningful to the user, and reads naturally in both Devanagari and Latin script. Kept as the final name.

---

## What This App Does

Anaj Bahi is an installable, offline-first mobile PWA that replaces a village grain trader's paper receipt-and-payment book. The trader buys grain from farmers, and for each purchase records the farmer, the grain type(s), the price per quintal, and every individual sack weight — sack by sack — then the app computes deductions, net weight, per-grain amounts, and the bill total exactly. Bills are saved locally on the phone (IndexedDB) with zero internet, browsable in a searchable list, and (in later phases) tracked for partial payments and outstanding balances, shared as an image receipt over WhatsApp, and backed up to the cloud when signal returns.

## Who Uses It

A single user: a grain trader in a small Indian village (the product owner's father). Low-end Android phone, intermittent/absent connectivity, one-handed use in a busy mandi (market), comfortable in Hindi (Devanagari) with some English. Not a power user — big buttons, few taps, no jargon.

## Core Problem Being Solved

Today the trader keeps purchases and payments in a paper ledger: slow to write, error-prone arithmetic (sack weights, deductions, per-quintal pricing), hard to search ("what did I buy from Ramesh last week?"), easy to lose, and impossible to share a clean receipt. Anaj Bahi digitises exactly this workflow — fast sack-by-sack capture, exact money math, instant search, and a shareable receipt — without requiring internet.

## Success Criteria

- [ ] Trader can create a complete purchase bill (farmer + ≥1 grain line + sack weights + deductions) and save it with the phone in airplane mode; reopening the app shows the saved bill unchanged.
- [ ] Sack-by-sack entry lets him add ≥30 sack weights one-handed, seeing the running list, running count, and running total above the input the whole time.
- [ ] Line net weight, line amount, and bill total are computed exactly (unit-correct: quintal = 100 kg) and match hand calculation on the documented worked examples, including multiple deductions per line.
- [ ] The Hindi/English toggle switches all on-screen chrome and labels immediately, with the preference remembered across launches.
- [ ] The app installs to the Android home screen and launches full-screen offline (service worker + manifest).
- [ ] Every later-phase feature (payments, due list, cloud sync, share, search filters) appears as a clearly-labelled "coming soon" stub in Phase 1 — never mistaken for a bug.

## What This App Does NOT Do (Out of Scope)

- **No AI / LLM / agent of any kind.** This is a deterministic local-first data/ledger app. There is no model, no prompt, no `spec/agent.md` graph.
- No multi-user, roles, or accounts (single user, single device in Phase 1; cloud sync in Phase 4 is a personal backup, not collaboration).
- No dashboard, charts, or analytics in early phases — only the searchable bill list.
- No phone/push notifications — the "due soon / overdue" list is in-app only.
- No selling/inventory/GST/tax invoicing — this records *purchases from farmers*, not sales.
- No payment gateway or actual money movement — payments are ledger records only.
- No web/desktop-optimised layout — mobile-first, portrait, Android-first.

## Key Constraints

- Must run and persist **fully offline**; Phase 1 has **no backend, no server DB, no API keys, no `.env`**.
- Must be usable on a low-end Android phone: small bundle, static export, big touch targets, no heavy runtime.
- Money and weight math must be **exact and unit-correct** and isolated in a pure, unit-tested module.
- Bilingual Hindi (Devanagari) + English throughout, including the shared receipt (later phase).
- Currency ₹ INR; weights in kg; price per **quintal (100 kg)**.

---

## Phases of Development

> **Phase 1 is the smallest first-time-right user-testable win:** the full primary purchase-capture journey, local-only, real (persisted to IndexedDB), with every deferred feature shown as a labelled "coming soon" stub. Phases 2–4 wire stubs into real features, one human-tested increment at a time. Each Phase 2–4 delivers ≥3 capabilities.

### Phase 1 — Local purchase capture (offline, first-time-right)

- **Goal:** The trader opens the installed app offline, creates a purchase bill for a farmer with one or more grain lines, enters sack weights one-by-one with a live running list/count/total, sets deduction(s), watches net weight / line amount / bill total compute live, saves it to the phone, sees it in the bill list, reopens it and sees identical data — all with a working Hindi/English toggle. Everything not in this journey is a labelled stub.
- **Capabilities:** [create-bill](capabilities/create-bill.md), [sack-by-sack-entry](capabilities/sack-by-sack-entry.md), [deductions-and-totals-calc](capabilities/deductions-and-totals-calc.md), [farmer-autocomplete](capabilities/farmer-autocomplete.md), [bill-list-and-reopen](capabilities/bill-list-and-reopen.md), [i18n-toggle](capabilities/i18n-toggle.md), [pwa-shell](capabilities/pwa-shell.md).
- **Independent slices (parallel build units):** one Next.js codebase carved by **disjoint file paths**. Slice A defines the shared calc + data + i18n **contract** (function signatures/types are fixed in this spec — see [architecture.md § Phase-1 module contract](architecture.md#phase-1-module-contract-slice-a) and [data.md](data.md)), so slices B and C build in parallel against that contract.
  - `slice-a` (frontend/lib — **foundation, no UI**) — pure calc module, Dexie schema + repository, grain-type seed, bill-id generator, i18n dictionary + provider hook, and all Phase-1 `package.json` deps + vitest config + unit tests. **Deps: none.** Its exported types/functions are frozen in this spec so B and C need not wait for its code to import against the contract.
  - `slice-b` (frontend/UI — bill create) — the `/bills/new` route and all bill-form components (farmer picker, grain-line editor, **sack-by-sack entry**, deduction editor, live totals). **Deps: slice-a contract** (imports `lib/calc`, `lib/db/repo`, `lib/i18n`).
  - `slice-c` (frontend/UI — shell, list, detail, i18n toggle, PWA, E2E) — root layout (mounts i18n provider + language toggle + bottom nav), home bill-list, bill-detail (reopen) route, "coming soon" stub components, PWA manifest + service worker + registration, and the Playwright E2E smoke test. **Deps: slice-a contract**; the E2E test exercises slice-b's create flow — it is authored against the `data-testid`s fixed in [ui.md](ui.md) and runs at the phase gate after A, B, C all land.
- **Key surfaces / files (disjoint ownership):**
  - slice-a: `frontend/src/lib/calc/index.ts` (+`.test.ts`), `frontend/src/lib/db/schema.ts`, `frontend/src/lib/db/repo.ts` (+`.test.ts`), `frontend/src/lib/db/seed.ts`, `frontend/src/lib/db/id.ts`, `frontend/src/lib/i18n/dictionary.ts`, `frontend/src/lib/i18n/context.tsx`, `frontend/package.json` (deps only), `frontend/vitest.config.ts`, `frontend/vitest.setup.ts`.
  - slice-b: `frontend/src/app/bills/new/page.tsx`, `frontend/src/components/bill-form/*` (`FarmerPicker.tsx`, `GrainLineEditor.tsx`, `SackWeightEntry.tsx`, `DeductionEditor.tsx`, `LiveTotals.tsx`).
  - slice-c: `frontend/src/app/layout.tsx` (replace skeleton), `frontend/src/app/page.tsx` (replace skeleton → bill list), `frontend/src/app/bill/page.tsx` (detail, reads `?id=`), `frontend/src/components/LanguageToggle.tsx`, `frontend/src/components/BottomNav.tsx`, `frontend/src/components/ComingSoon.tsx`, `frontend/src/components/SwRegister.tsx`, `frontend/public/manifest.webmanifest`, `frontend/public/sw.js`, `frontend/public/icons/*`, `frontend/playwright.config.ts`, `frontend/tests/e2e/purchase-journey.spec.ts`.
- **Gate command:** run from `frontend/`: `pnpm install && pnpm test && pnpm build && pnpm test:e2e`
  (`pnpm test` = `vitest run` — calc + repo units; `pnpm build` — proves static export compiles; `pnpm test:e2e` = `playwright test` — real browser drives the primary journey against `pnpm dev` on `http://localhost:3000/app/`). No `.env`/keys required.
- **How the user tests it (handoff seed):**
  1. From `frontend/`, run `pnpm install` then `pnpm dev`; open `http://localhost:3000/app/` on the phone (or Chrome device mode). Optionally "Add to Home screen" and turn on airplane mode.
  2. Tap **+ New Bill**. Start typing a farmer name — if none saved, fill name + village + phone; next time it autocompletes.
  3. Add a grain line: pick **Wheat**, price `2400`. In sack-by-sack entry type `40` → Add, `40` → Add, `40.5` → Add, `39` → Add — watch the list above the input grow with **count 4, total 159.5 kg**.
  4. Add deductions: `per sack 0.5 kg` and `1% of gross`. Watch **net weight 155.905 kg**, **line amount ₹3741.72**, **bill total** update live.
  5. Tap **Save**. You return to the list and see the new bill (id like `060726/ghvg`). Reopen it — same farmer, sacks, deductions, totals.
  6. Toggle **हिं / EN** top-right — all labels switch instantly and stay switched after reload.
  7. Confirm the labelled **"Coming soon"** stubs (Payments, Due list, Share, Sync, Search filters) look intentional, not broken.

### Phase 2 — Payments & finding bills

- **Goal:** Record partial payments against a bill and see paid-to-date + outstanding balance, see a due-soon/overdue list, enforce the edit-lock rule (a bill locks once any payment is recorded), and find bills fast via search/filter.
- **Capabilities:** [payments](capabilities/payments.md), [due-list](capabilities/due-list.md), [bill-edit-lock](capabilities/bill-edit-lock.md), [search-filters](capabilities/search-filters.md).
- **Independent slices (parallel build units):**
  - `slice-a` (lib) — extend repo with payment CRUD, balance/aggregate helpers, due-status derivation, and search/filter queries against the Dexie indexes. **Deps: none** (extends Phase-1 lib; adds new files/functions).
  - `slice-b` (UI — payments & due) — payment entry + payment history on bill detail, outstanding-balance display, due-date field on create, the due/overdue list screen. **Deps: slice-a**.
  - `slice-c` (UI — search) — the search/filter bar wired to the home list. **Deps: slice-a**.
- **Key surfaces / files:** slice-a: `frontend/src/lib/db/repo.ts` (extend), `frontend/src/lib/db/queries.ts` (new) + tests; slice-b: `frontend/src/app/bill/page.tsx` (extend), `frontend/src/components/payments/*`, `frontend/src/app/due/page.tsx`; slice-c: `frontend/src/components/SearchBar.tsx`, `frontend/src/app/page.tsx` (wire search).
- **Gate command:** from `frontend/`: `pnpm test && pnpm build && pnpm test:e2e` (unit tests cover payment math, balance, due-status; E2E covers add-payment→see-balance→bill-locks→search-finds-bill).
- **How the user tests it (handoff seed):** Open a bill, add a ₹5000 payment dated today; see paid ₹5000 / outstanding = total − 5000; try to edit the bill — editing is now locked, but you can still add another payment. Set a due date on a new bill; see it in the Due list when near/overdue. Search "Ramesh" or "wheat" or a date and see the list filter.

### Phase 3 — Shareable image receipt (bilingual)

- **Goal:** From a saved bill, render a clean receipt (business header, full sack-by-sack breakdown per grain, per-grain amounts, bill total) and share it as an **image** through the phone's native share sheet (WhatsApp etc.), in the currently-selected language.
- **Capabilities:** [business-profile](capabilities/business-profile.md), [receipt-render](capabilities/receipt-render.md), [share-as-image](capabilities/share-as-image.md).
- **Independent slices (parallel build units):**
  - `slice-a` (lib/settings) — business-profile store (shop name, trader name, phone) in the `meta`/settings table + read/write API. **Deps: none**.
  - `slice-b` (UI — receipt) — the on-screen receipt component/template rendering a bill bilingually with the full breakdown. **Deps: slice-a** (needs business header) + Phase-1 calc/data (read-only).
  - `slice-c` (share) — capture the receipt DOM to a PNG (`html-to-image`) and invoke `navigator.share` with the image file, with a download fallback. **Deps: slice-b** (needs the rendered node).
- **Key surfaces / files:** slice-a: `frontend/src/lib/settings/profile.ts`, `frontend/src/app/settings/page.tsx`; slice-b: `frontend/src/components/receipt/Receipt.tsx`; slice-c: `frontend/src/lib/share/shareImage.ts`, share button on `frontend/src/app/bill/page.tsx`.
- **Gate command:** from `frontend/`: `pnpm test && pnpm build && pnpm test:e2e` (unit: receipt data assembly + rupee/weight formatting bilingual; E2E: open bill → open receipt → assert receipt shows all sacks + total in EN and HI; share invoked — `navigator.share` stubbed in the browser context to assert a PNG File is passed).
- **How the user tests it (handoff seed):** Set business profile once (shop + phone). Open a bill → **Share**. See the receipt preview with header, every sack weight per grain, per-grain amounts, and total, in the current language; tap share and pick WhatsApp; the received image is legible and correct. Toggle to the other language and re-share; the receipt language follows.

### Phase 4 — Cloud sync & backup (FastAPI + SQLite)

- **Goal:** When signal returns, local bills/farmers/payments sync to a personal **FastAPI + SQLite** cloud backend (backup + restore on a new device); creating/editing while offline queues changes and flushes automatically on reconnect. The app never blocks on the network — everything from Phases 1–3 keeps working fully offline. The frozen wire + `lib/sync` contract is in [architecture.md § Phase-4 sync contract](architecture.md#phase-4-sync-contract).
- **Capabilities:** [cloud-sync](capabilities/cloud-sync.md), [offline-queue](capabilities/offline-queue.md), [backup-restore](capabilities/backup-restore.md).
- **Independent slices (parallel build units):**
  - `slice-a` (backend) — **FastAPI + SQLite** sync service (SQLAlchemy 2.0, `uv`) under `backend/`; `GET /health`, token-gated `POST /sync/push` + `GET /sync/pull` with last-write-wins by `updatedAt` for bills and upsert-by-id for farmers/grain-types/profile, against the schema-light JSON-row storage model. Tables created via `uv run python -m app.init_db`. **Deps: none** (new `backend/` tree; requires `backend/.env` with `DATABASE_URL` + `DEVICE_TOKEN` — first phase to need secrets). Builds against the frozen contract, so slice-b/c proceed in parallel.
  - `slice-b` (frontend — outbox / sync engine) — the `frontend/src/lib/sync` module implementing the frozen API (`getSyncConfig`/`saveSyncConfig`, `syncNow`, `restoreFromCloud`, `getSyncState`, `startAutoSync`): an IndexedDB-backed pending set deduped by id, a sync engine that flushes idempotently on the `online` event, and pull-write into Dexie. **Deps: slice-a contract** (the frozen endpoint/wire shapes — not slice-a's code; builds in parallel).
  - `slice-c` (frontend — status / restore UI + E2E) — sync-config entry in Settings (base URL + device token → Dexie `meta`), sync-status indicator, manual "Sync now", first-run "Restore from cloud" on a fresh device, and the Playwright E2E for the sync journey. **Deps: slice-b** (the frozen `lib/sync` API).
- **Key surfaces / files:** slice-a: `backend/` (`app/main.py`, `app/init_db.py`, `app/models.py`, `app/db.py`, `app/deps.py` auth, `tests/`), `backend/pyproject.toml`, `backend/.env.example`; slice-b: `frontend/src/lib/sync/config.ts`, `frontend/src/lib/sync/engine.ts`, `frontend/src/lib/sync/index.ts` (+ tests); slice-c: `frontend/src/components/SyncStatus.tsx`, sync-config + restore flow in `frontend/src/app/settings/page.tsx`, `frontend/tests/e2e/sync-journey.spec.ts`.
- **Gate command:** backend from `backend/`: `uv sync && uv run python -m app.init_db && uv run pytest` (against a **real on-disk temp SQLite file** per test via `.env`, **not** in-memory); frontend from `frontend/`: `pnpm test && pnpm build && pnpm test:e2e` (E2E: create offline → go online → assert push to the real running FastAPI+SQLite service; wipe local → restore → assert bills reappear).
- **How the user tests it (handoff seed):** Start the backend from `backend/`: `uv sync`, then `uv run python -m app.init_db`, then `uv run uvicorn app.main:app --port 8000` (check `http://localhost:8000/health` → `{"status":"ok"}`). In the PWA **Settings**, enter the backend **base URL** (`http://localhost:8000`) and the **device token** (the same `DEVICE_TOKEN` value from `backend/.env`) — these save into local storage, no rebuild. Create a bill offline; reconnect; see the sync indicator flush to "synced". On a second device (or a fresh browser profile), enter the same base URL + token and **Restore from cloud** — all bills/farmers/payments/grain types reappear. This is the first phase needing `.env` (backend only: `DATABASE_URL` + `DEVICE_TOKEN`); `backend/.env.example` documents the keys.

### Phase 5 — Quick-entry (summary) bills

> Additive, back-compatible capability: a **second way to create a bill** for transcribing a paper bill's summary totals, alongside the unchanged sack-by-sack flow. No backend change (bills sync as opaque JSON). Offline, no `.env`. Existing sacks bills must be **provably unaffected** — the calc dispatch and the render branches only ever trigger when a summary discriminant is present.

- **Goal:** From **+ New Bill** the trader picks **Fresh** (today's unchanged sack form) or **Quick entry**. Quick entry captures farmer + date + one-or-more grain lines (grain, price, total weight, entered amount, optional sacks/deduction-kg), computes the bill total as the **sum of entered amounts** (never recomputed), saves offline, lists it, reopens it as a **totals-only** detail, edits it back in the quick form, and shares it as a **totals-only** receipt image. Payments/outstanding/due/search all keep working off the bill total for both modes.
- **Capability:** [quick-bill-entry](capabilities/quick-bill-entry.md) (bundles the chooser, the quick-entry form, the summary data-model + calc, and the summary detail/receipt rendering — one cohesive user-facing capability).
- **Independent slices (parallel build units):** carved by **disjoint file paths**; the foundation slice freezes the calc + type contract (see [architecture.md § Quick-entry additions](architecture.md#quick-entry-summary-bills--frozen-additions-phase-5)) so B and C build against it in parallel.
  - `slice-a` (foundation — data + calc + i18n, no new UI). **Deps: none.** Extend `lib/db/schema.ts` types (`Bill.entryMode?`, `GrainLineSummary`, `StoredGrainLine.summary?`); extend `lib/calc/index.ts` (`SummaryFigures`, `computeSummaryLine`, make `computeGrainLine` dispatch on `line.summary`, leave `computeBillTotal` unchanged) + unit tests; add the Phase-5 i18n keys to `lib/i18n/dictionary.ts` (both EN + HI). `repo` unchanged.
  - `slice-b` (UI — chooser + quick form). **Deps: slice-a contract.** New `app/bills/choose/page.tsx` (chooser) and `app/bills/quick/page.tsx` (quick form) + `components/bill-form/QuickGrainLineEditor.tsx` (reusing `FarmerPicker`, grain selector, `LiveTotals`); retarget the home FAB link in `app/page.tsx` (`/bills/new` → `/bills/choose`, one line).
  - `slice-c` (UI — summary detail + receipt + E2E). **Deps: slice-a contract.** Branch `app/bill/page.tsx` (summary → totals-only detail, no sack grid; Edit-link target by `entryMode`) and `components/receipt/Receipt.tsx` (summary → hide weight column-grid, deduction cell = kg only, no basis note); add `tests/e2e/quick-bill-journey.spec.ts`. The E2E exercises slice-b's flow and runs at the phase gate after A, B, C land.
- **Key surfaces / files (disjoint ownership):**
  - slice-a: `frontend/src/lib/db/schema.ts`, `frontend/src/lib/calc/index.ts` (+`.test.ts`), `frontend/src/lib/i18n/dictionary.ts`.
  - slice-b: `frontend/src/app/bills/choose/page.tsx` (new), `frontend/src/app/bills/quick/page.tsx` (new), `frontend/src/components/bill-form/QuickGrainLineEditor.tsx` (new), `frontend/src/app/page.tsx` (FAB link only).
  - slice-c: `frontend/src/app/bill/page.tsx`, `frontend/src/components/receipt/Receipt.tsx`, `frontend/tests/e2e/quick-bill-journey.spec.ts` (new).
- **Gate command:** from `frontend/`: `pnpm test && pnpm build && pnpm test:e2e`.
  - `pnpm test` (vitest): `computeSummaryLine` returns the **entered** amount verbatim (incl. a deliberately mismatched amount), `deductionKg ?? 0`, `sackCount ?? 0`, net clamp; a **mixed** sacks+summary bill's `computeBillTotal` = Σ line amounts; a legacy bill with no `entryMode` still totals via the sacks path.
  - `pnpm build`: static export compiles with the new routes.
  - `pnpm test:e2e` (Playwright): **new journey** — from home tap **+ New Bill** → chooser → **Quick entry** → fill a **2-grain summary** (e.g. Wheat price 2400, weight 159.5, amount 3741.72; Mustard price 5600, weight 60, amount 3360) → Save → home card shows **₹7101.72** → reopen → detail shows totals-only (no `detail-sack-row`) and total **₹7101.72** → Edit reopens `/bills/quick` pre-filled → Share opens a receipt preview and shares/downloads a PNG. **Regression:** the existing `purchase-journey.spec.ts` (Fresh sack flow) still passes unchanged, reached via chooser → **Fresh bill**.
- **How the user tests it (handoff seed):**
  1. From `frontend/`, `pnpm dev`; open `http://localhost:3000/app/`. Tap **+ New Bill** → you now see two choices.
  2. Tap **Quick entry**. Enter farmer (name + village), leave date as today. Add grain **Wheat**, price `2400`, total weight `159.5`, amount `3741.72`; leave sacks/deduction blank (note: no "(optional)" text on those two fields). Tap **+ Add another grain**: **Mustard**, price `5600`, total weight `60`, amount `3360`.
  3. Watch the bill total read **₹7101.72** (sum of the two entered amounts). Tap **Save** → back on the list, the new bill shows **₹7101.72**.
  4. Reopen it: you see **totals-only** per grain (no sack column grid) and the total. Tap **Edit** → the quick form reopens pre-filled. Tap **Share** → a totals-only receipt previews and shares/downloads.
  5. Tap **+ New Bill** → **Fresh bill**: confirm it is exactly the old sack-by-sack form and still works end-to-end. Old bills open and total exactly as before.
