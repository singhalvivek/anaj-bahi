# UI — Anaj Bahi

> Mobile-first, portrait, Android-first PWA. Big touch targets (min **48×48 px**, primary actions ≥56 px tall), one-handed use, thumb-reachable primary actions near the bottom. Bilingual Hindi/English via a top-right toggle. Deferred features appear as clearly-labelled **"coming soon"** stubs, never as broken UI.

---

## UI Type

Installable web app (Next.js App Router, static export). Client-rendered screens over IndexedDB. No server-rendered data.

## Global chrome

- **Top bar:** app title ("अनाज बही" / "Anaj Bahi" per language) on the left; **language toggle `हिं | EN`** on the right (48 px tap target). Toggling re-labels the entire UI instantly and persists (localStorage `anajbahi.lang`, default `hi`).
- **Bottom nav (`BottomNav`):** thumb-reachable — **Bills** (home, active) and stub tabs **Due** and **Settings/Share** rendered but routing to a "coming soon" screen in Phase 1.
- **Primary FAB / button:** **+ New Bill** — large, bottom-right, always reachable from the list.
- **i18n rule:** no hard-coded user-facing strings in components — all through `t('key')` from `useI18n()`. Numbers/₹/kg formatted the same in both languages; only labels translate.

## Views / Screens

### Screen: Bill List (Home, `/`)  — slice-c

**Purpose:** see all saved bills newest-first; entry point to create/reopen.

**Key elements:**
- List of bill cards: bill id (`060726/ghvg7`), farmer name + place, purchase date, grain type chips, **bill total ₹**.
- Empty state: friendly "No bills yet — tap + New Bill" (bilingual).
- **`data-testid="new-bill-btn"`**, list container **`data-testid="bill-list"`**, each card **`data-testid="bill-card"`**.
- **Coming-soon stubs (labelled):** a disabled **Search / Filter** bar at the top with a "coming soon" pill; a **Due** and **Share** entry showing the `ComingSoon` badge. Each stub uses `data-testid="stub-<name>"` and the visible text "Coming soon / जल्द आ रहा है".

**Actions:** tap **+ New Bill** → `/bills/new`; tap a card → `/bill?id=<encoded id>`.

### Screen: New Bill (`/bills/new`) — slice-b

**Purpose:** the primary journey — create a purchase bill end-to-end.

**Layout (top → bottom, single scroll):**
1. **Farmer picker** (`FarmerPicker`) — a text input with **autocomplete** against saved farmers (see [farmer-autocomplete](capabilities/farmer-autocomplete.md)). Selecting fills farmer; if new, an inline "add farmer" mini-form (name required, place required, phone optional). `data-testid="farmer-input"`, suggestion items `data-testid="farmer-suggestion"`.
2. **Purchase date** — date field defaulting to **today**. `data-testid="purchase-date"`.
3. **Bill id preview** — shown read-only once date is set (`DDMMYY/xxxxx`), finalised on save.
4. **Grain lines** (`GrainLineEditor`, one card per line, **≥1**):
   - Grain type selector (seeded list + "add custom") — labels shown in current language. `data-testid="grain-type-select"`.
   - Price per quintal (₹) numeric input. `data-testid="price-input"`.
   - **Sack-by-sack entry** (`SackWeightEntry`) — see the detailed spec below.
   - **Deduction editor** (`DeductionEditor`) — add **multiple** deductions; each row = a basis dropdown (per-sack kg / per-quintal kg / % of gross / flat kg) + a value input + remove button. `data-testid="add-deduction"`, rows `data-testid="deduction-row"`.
   - **Line totals** (live): sack count, gross kg, deduction kg, **net kg**, **line amount ₹**. `data-testid="line-net"`, `data-testid="line-amount"`.
   - **+ Add another grain** button.
5. **Live bill total** (`LiveTotals`) — sticky near the bottom, updates on every keystroke. `data-testid="bill-total"`.
6. **Save** (large primary button). `data-testid="save-bill"`. Validation: ≥1 farmer, ≥1 grain line with ≥1 sack and a price > 0; disabled otherwise with an inline hint.

**On save:** assemble the `Bill`, call `repo.createBill`, navigate to `/` (list). No network.

### Screen: Bill Detail / Reopen (`/bill?id=<encoded id>`) — slice-c

**Purpose:** reopen a saved bill and see identical data.

**Key elements:** farmer + place + phone; purchase date; bill id; each grain line with its **full sack-by-sack list**, deductions, net kg, line amount; **bill total**. Read-only view with an **Edit** action (Phase 1: edit re-opens the form pre-filled; Phase 2 locks it once a payment exists). `data-testid="detail-bill-total"`, sack list `data-testid="detail-sack-list"`.
**Coming-soon stubs:** **Payments** panel and **Share as image** button both rendered with the `ComingSoon` badge.

### Screen: Coming-soon stub (`/due`, `/settings` etc.)

A single friendly placeholder screen: icon + "Coming soon — जल्द आ रहा है" + one line describing the feature and its target phase. Reached from stub nav items. Never an error/blank.

---

## Signature interaction — Sack-by-sack weight entry (`SackWeightEntry`)

> The defining interaction. Optimised for adding **many sacks one-handed, fast**, while always seeing what's already entered.

**Vertical layout (top → bottom):**
1. **Running summary bar** — big, bold: **"Sacks: N • Total: X.X kg"** (bilingual labels). Always visible.
2. **Scrollable list of entered weights** — **directly above** the input. Each row shows the sack index and weight (e.g. `#3 — 40.5 kg`) with a small **✕ remove** and the list **auto-scrolls to the newest** entry so the last-added sack is visible. Fixed max-height (~40% of viewport) so the input stays on screen; scroll within.
3. **Numeric-only input** — `inputmode="decimal"`, large (≥56 px), placeholder "sack weight (kg)". Autofocus; after **Add**, the field **clears and re-focuses** immediately so the trader keeps typing the next sack without hunting for the field.
4. **Add button** — large, right of the input, thumb-reachable; **Enter key also adds**. Adding appends to `sackWeights`, updates the summary + list + line/bill totals live.

**Behaviour rules:**
- Input accepts digits + one decimal point; rejects other characters. Empty/zero Add is ignored.
- Removing a sack (✕) updates count/total/amounts live and preserves the order of the rest.
- The list is the source of truth for order — the receipt (Phase 3) prints sacks in this exact order.
- `data-testid`: input `sack-input`, add `sack-add`, list `sack-list`, each row `sack-row`, summary `sack-summary`.

**Why above, not below:** the trader's thumb and the on-screen keyboard occupy the bottom; putting the history **above** the input keeps prior weights visible while the keyboard is open and the next value is typed.

---

## Bilingual toggle (`LanguageToggle`)

- Two-state pill `हिं | EN`; active side highlighted. Tap flips `lang` in the i18n context.
- Affects **all** chrome/labels immediately (React re-render) and the receipt (Phase 3). Numbers, ₹, kg, dates are locale-neutral (Western digits) in both.
- Persisted; on next launch the app opens in the last-used language (default Hindi).

## Stub labelling convention

Every deferred feature renders a shared **`ComingSoon`** component: a muted card/badge with a "🔒 Coming soon — जल्द आ रहा है" label and the feature name, visually distinct (dashed border, reduced opacity, non-interactive). This guarantees a stub reads as intentional. Stubs in Phase 1: **Search/Filter, Payments, Due list, Share as image, Cloud sync, Settings**.

## Error & loading states

- **Storage unavailable** (IndexedDB blocked): full-screen clear message "Storage unavailable — enable site data" (bilingual); never a silent failure.
- **Validation:** inline, next to the field, in the current language; Save disabled until valid.
- **Loading:** IndexedDB reads are near-instant; show a light skeleton only if a read exceeds ~150 ms.
- No network errors in Phases 1–3 (offline app).

## Tech Stack

Next.js 15.3 (App Router, static export) + React 19 + Tailwind CSS 4. i18n via a hand-rolled context (`lib/i18n`). Reactive reads via `dexie-react-hooks` `useLiveQuery`. See [architecture.md](architecture.md).
