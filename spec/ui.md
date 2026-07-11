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

**Actions:** tap **+ New Bill** → `/bills/choose` (the Phase-5 chooser; was `/bills/new`); tap a card → `/bill?id=<encoded id>`. Card totals use `computeBillTotal`, which is summary-aware, so a summary bill's card shows the sum of its entered amounts with no code change.

### Screen: New Bill Chooser (`/bills/choose`) — slice-b _(Phase 5)_

**Purpose:** let the trader pick how to create a bill. `+ New Bill` (`new-bill-btn`) now routes here instead of straight to the fresh form.

**Key elements:**
- Two large, thumb-reachable, bilingual choice cards (≥56 px tall, big touch targets), stacked vertically in a container `data-testid="new-bill-choice"`:
  1. **Fresh bill** (`data-testid="choice-fresh"`, a `Link` to `/bills/new`) — title + one-line hint "Enter each sack weight / हर बोरे का वज़न भरें". Lands in **exactly today's unchanged sack form**.
  2. **Quick entry** (`data-testid="choice-quick"`, a `Link` to `/bills/quick`) — title + one-line hint "From a bill already written on paper / काग़ज़ पर लिखी बही से". Opens the summary form.
- Back link to home. No stubs; both options are live.

### Screen: Quick-Entry Bill (`/bills/quick`) — slice-b _(Phase 5)_

**Purpose:** transcribe a summary bill already written on paper — per-grain totals only, entered money amount authoritative. See [quick-bill-entry](capabilities/quick-bill-entry.md).

**Layout (top → bottom, single scroll) — mirrors the fresh form's bill-level chrome:**
1. **Farmer picker** (`FarmerPicker`, reused) — name **required**, place/village **required**, phone optional; same autocomplete. `data-testid="farmer-input"`.
2. **Purchase date** (defaults today, required) `data-testid="purchase-date"`; **Due date** (optional) `data-testid="due-date-input"`.
3. **Bill id preview** — read-only `DDMMYY/xxxxx`, finalised on save (same scheme as fresh).
4. **Grain lines** — one card per line, **≥1**, `+ Add another grain` (`grain.addAnother`). Per line (`QuickGrainLineEditor`):
   - **Grain type** selector (seeded + add-custom, reused) — **required**. `data-testid="grain-type-select"`.
   - **Price per quintal (₹)** — **required, > 0**. `data-testid="price-input"`.
   - **Total weight (kg)** — **required, > 0**; ONE number (gross), `inputmode="decimal"`. `data-testid="total-weight-input"`.
   - **Amount (₹)** — **required, > 0**; entered directly, verbatim from the paper bill; `inputmode="decimal"`. `data-testid="amount-input"`. (Authoritative — never recomputed.)
   - **Total sacks** — optional integer, `inputmode="numeric"`, **rendered WITHOUT any "(optional)" label** (just field + placeholder). `data-testid="sack-count-input"`.
   - **Deduction (kg)** — optional single number, `inputmode="decimal"`, **rendered WITHOUT any "(optional)" label**. `data-testid="deduction-kg-input"`. (NOT the multi-basis deduction editor — one total-kg figure.)
   - **Remove line** when > 1 line.
5. **Live bill total** (`LiveTotals`, reused) — at the end of the form in normal flow (NOT sticky) = **Σ the entered line Amounts**. `data-testid="bill-total"`.
6. **Save** (`data-testid="save-bill"`, reused) at the end of the form. **Enabled only when** farmer name + place + purchase date are set AND every line has grainType + price > 0 + total weight > 0 + amount > 0; disabled otherwise with an inline bilingual hint (same pattern as the fresh form). `sackCount`/`deductionKg` are never required.

**On save:** assemble a `Bill` with `entryMode: 'summary'`, each line carrying `summary: { totalWeightKg, sackCount?, deductionKg?, amount }` (and `sackWeights: []`, `deductions: []`), call `repo.createBill`, navigate to `/`. In edit mode (`/bills/quick?edit=<id>`) it loads the summary bill, pre-fills, and `updateBill` (respecting the edit-lock). No network.

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
5. **Live bill total** (`LiveTotals`) — rendered **at the end of the form in normal flow (NOT sticky/fixed)**, updates on every keystroke. `data-testid="bill-total"`. It must **not** be pinned to the viewport: while the trader is entering sacks the on-screen keyboard already occupies the bottom (see the sack-entry rationale below), so a pinned total + Save would leave almost nothing of the input visible on a phone.
6. **Save** (large primary button), **also at the end of the form in normal flow** (below the live total, not fixed). `data-testid="save-bill"`. Validation: ≥1 farmer, ≥1 grain line with ≥1 sack and a price > 0; disabled otherwise with an inline hint.

**On save:** assemble the `Bill`, call `repo.createBill`, navigate to `/` (list). No network.

### Screen: Bill Detail / Reopen (`/bill?id=<encoded id>`) — slice-c

**Purpose:** reopen a saved bill and see identical data.

**Branch on `entryMode` (`bill.entryMode ?? 'sacks'`) — Phase 5:**
- **`'summary'` bill** → render each grain **totals-only**: grain name, price, **total weight**, **sacks** (only if `summary.sackCount` given), **deduction kg** (only if `summary.deductionKg` given), and the **entered amount** — plus the bill total. **No sack column-grid.** Container `data-testid="detail-summary-line"` per grain; `detail-bill-total` reused. Edit link points to `/bills/quick?edit=<encoded id>`.
- **`'sacks'` bill** → renders **exactly as today** (the paper-ledger column-grid below). Edit link points to `/bills/new?edit=<encoded id>`. Provably unchanged.

**Key elements (sacks bill):** farmer + place + phone; purchase date; bill id; each grain line rendered as its own section card, with its sacks shown in the **paper-ledger column layout** — **vertical columns of up to 10 sacks each, weight values only (NO sack numbers)**, column 1 = sacks 1–10 in entry order, column 2 = 11–20, etc. (`ceil(N/10)` columns per grain, max 100 sacks → max 10 columns), with a **per-column subtotal row** beneath each column. Because each grain is its own section card here, the columns **restart within each grain section** (grains do NOT share one continuous column track on this screen — unlike the receipt). It reuses the same pure column-grouping helper (`toColumns` / `columnSubtotals` in `frontend/src/components/receipt/columns.ts`, `ceil(N/10)` per grain, entry-order split) that the receipt uses, so the math/layout logic is shared and already unit-tested. Also shows deductions, net kg, line amount; **bill total**. Read-only view with an **Edit** action (Phase 1: edit re-opens the form pre-filled; Phase 2 locks it once a payment exists). `data-testid="detail-bill-total"`, list container `data-testid="detail-sack-list"`; each rendered weight cell `data-testid="detail-sack-row"` (one per actual sack weight — empty filler cells that pad a short column to the tallest column do NOT carry the testid, so a 4-sack grain yields exactly 4 `detail-sack-row` elements).
**Coming-soon stubs:** **Payments** panel and **Share as image** button both rendered with the `ComingSoon` badge.

### Screen: Shared Image Receipt (Phase 3) — receipt-render

**Purpose:** render a bill as a ledger-style receipt that the trader shares as an image. Rendered from the Bill Detail **Share as image** action (a Phase 1 stub, live in Phase 3). See [receipt-render](capabilities/receipt-render.md) for the authoritative content spec; [share-as-image](capabilities/share-as-image.md) for capture/share.

**Layout (top → bottom):**
1. **Business header** (from the [business profile](capabilities/business-profile.md)), **bill id** (`DDMMYY/xxxxx`) + purchase date, **farmer** (name / village / phone) — all UNCHANGED from Phase 3.
2. **Top weight column-grid, left-to-right** — the sack section mirrors the trader's paper ledger:
   - Sack weights are laid out in **vertical columns of up to 10 rows (10 sacks per column)**, **weight values only, no sack numbers**.
   - Column 1 = sacks 1–10 (entry order), column 2 = 11–20, etc. A grain with N sacks occupies **`ceil(N/10)` columns**; max 100 sacks/bill → max 10 columns.
   - Grains **share one continuous column track**: grain 1 starts at column 1; each next grain starts in the next free column after the previous grain's last column. E.g. grain A 25 sacks → columns 1–3 (10, 10, 5); grain B 11 → columns 4–5 (10, 1); grain C 6 → column 6.
   - **Per grain block** (width = its column count): a **grain-name header** spanning the block; its **weight columns side by side**; a **subtotal row** aligned beneath each column (each = that column's sum). **No per-grain summary lines under the grid** — the gross/deduction/net/rate/amount figures move into the consolidated table below.
3. **Consolidated summary table** (below the grid) — **one table** where **columns = the grains** (header = grain name, same left-to-right order as the grid) and **rows = the line items**, so reading a grain's column downward gives gross → deduction → net → rate → amount:
   - **Gross weight (kg)**, **Deduction** (resolved kg + compact basis in one cell, e.g. `3.595 kg (0.5/sack + 1%)`), **Net weight** (kg only — the quintal unit appears only on the Rate row), **Rate (₹/quintal)**, **Amount (₹)**.
   - **Sizing:** the table is sized to its own content (**width `max-content`, `min-width: 100%`, no inner horizontal scroll**) so the whole receipt is one consistent width and the rasterized image never crops the last grain column. Any on-screen horizontal scrolling of a wide receipt is owned by the **outer preview container**, not the table.
4. **Bill grand total** ₹ = sum of the grains' Amount cells, shown as a trailing **"Total" column** or a **bill-total line** under the table.

**Summary bill (Phase 5):** a bill with `entryMode: 'summary'` **omits the top weight column-grid entirely** (there are no per-sack weights). It renders the business header + identity + the **consolidated summary table only**, sourced from the summary figures: gross = `totalWeightKg`, deduction = `deductionKg ?? 0` (**resolved kg only, no basis note**), net = gross − deduction, rate = price, amount = the **entered** amount; bill total = Σ entered amounts. All these come from `computeGrainLine` (summary-aware), so the table needs no arithmetic change — only the grid is hidden. Sharing/PNG capture is unchanged and still works. A `'sacks'` bill's receipt is entirely unchanged.

**Notes:**
- The image is intentionally **wider than the old flat numbered breakdown** (up to 10 columns) to match the paper ledger — expected, not a bug. The consolidated summary table sizes to its own content (single consistent width, no inner horizontal scroll) so the rasterized PNG never clips the last grain column.
- Bilingual Hindi/English follows the current toggle; Indian-style ₹ formatting; all amounts and the total come from the calc engine (`lib/calc`) — the math is unchanged, only the image layout changed (weight column-grid on top, one consolidated summary table below).
- The column split uses a **pure column-grouping helper** (`ceil(N/10)` per grain, entry-order split, per-column subtotals) so it is unit-testable independent of the DOM.
- The on-screen **bill entry** view (the sack-by-sack entry list) is **unaffected** by this redesign — it intentionally keeps its `#index — weight` removable rows for editing. The **bill detail** view, however, now ALSO uses the column-grid layout (weights only, no numbers) consistent with the receipt (see [Bill Detail / Reopen](#screen-bill-detail--reopen-billidencoded-id--slice-c) above).

### Screen: Coming-soon stub (`/due`, `/settings` etc.)

A single friendly placeholder screen: icon + "Coming soon — जल्द आ रहा है" + one line describing the feature and its target phase. Reached from stub nav items. Never an error/blank.

---

## Firebase multi-tenant screens (Phases 6–9)

> All bilingual Hindi/English, big-button, one-handed, low-end-Android — same conventions as above. These are rendered by the **`AuthGate`** (conditional on `useAuth().status`), **not** as new App-Router routes (static-export-safe). Contracts are frozen in [architecture.md § Firebase multi-tenant redesign](architecture.md#firebase-multi-tenant-redesign-phases-69--frozen-contracts). Product detail is in the capability files ([phone-auth](capabilities/phone-auth.md), [first-run-role-chooser](capabilities/first-run-role-chooser.md), [business-tenancy](capabilities/business-tenancy.md), [employee-management](capabilities/employee-management.md), [activity-log](capabilities/activity-log.md), [personal-profile](capabilities/personal-profile.md)).

### Screen: Login (phone + OTP) — Phase 6, slice-b

Shown when `status === 'signed-out'`. Container `data-testid="login-screen"`.
1. **Phone number** input (E.164, `inputmode="tel"`, ≥56 px). `data-testid="phone-input"`. Default country `+91` prefix shown.
2. Invisible reCAPTCHA mount point `data-testid="recaptcha-container"` (renders nothing visible for test numbers).
3. **Send code** button `data-testid="send-otp-btn"` → calls `startPhoneSignIn`.
4. After send: **OTP** input (`inputmode="numeric"`, 6 digits) `data-testid="otp-input"` + **Verify** button `data-testid="verify-otp-btn"` → `confirmOtp`.
5. Inline bilingual error on wrong code / network (mapped from Firebase error). Never crashes.

### Screen: First-run onboarding — Phase 6, slice-b

Shown when `status === 'onboarding'` (signed in, no `bizId`). A short stepped flow inside `data-testid="onboarding"`:
1. **Name prompt** (`data-testid="name-prompt"`): "What's your name?" — `data-testid="display-name-input"`, **Continue** `data-testid="name-continue-btn"` (required, non-blank) → `setDisplayName`.
2. **Role chooser** (`data-testid="role-chooser"`): two large cards — **"I am an Owner"** `data-testid="role-owner"` and **"I am an Employee"** `data-testid="role-employee"` → `chooseRole(role)` runs the [membership decision](capabilities/first-run-role-chooser.md).
3a. **Owner → Create business** (`data-testid="create-business"`): shop name `data-testid="biz-shop-input"` (required), trader name `data-testid="biz-trader-input"`, phone `data-testid="biz-phone-input"`, address `data-testid="biz-address-input"` (optional); **Create** `data-testid="create-business-btn"` → `createOwnerBusiness` → lands in the app as owner.
3b. **Employee (added) → joins** the business automatically (decision `employee-joined`), landing in the app.
3c. **Employee (not added) → Ask your owner** (`data-testid="ask-owner-screen"`): a friendly bilingual "Ask your owner to add your number <phone>, then sign in again" with a **Sign out** button. No app access.

### Screen: Gated home header — Phase 6, slice-c

When `status === 'ready'` the existing app renders, wrapped by a header (edit to `TopBar`/a new `GatedHomeHeader`) container `data-testid="gated-home"` showing:
- **Display name** `data-testid="home-user-name"`, **business name** `data-testid="home-business-name"`, **role** badge (owner/employee) `data-testid="home-role"`, and **Sign out** `data-testid="sign-out-btn"` (calls `signOut` → returns to Login).
- The existing bill list/screens render below, still reading the local store in Phase 6, with a labelled **`ComingSoon`** banner "Shared cloud & roles — coming soon / साझा क्लाउड और भूमिकाएँ — जल्द" (`data-testid="stub-shared-cloud"`) so the local-only state reads as intentional, not a bug.

### Screen: Settings — Personal profile vs Business profile — Phase 8

The Settings screen splits into two sections:
1. **Personal profile** (`data-testid="personal-profile"`): the user's own **display name** (editable, `data-testid="personal-name-input"`, **Save** `data-testid="personal-save"`) + **phone** (read-only) + language. Shown in attribution.
2. **Business profile** (`data-testid="business-profile"`, the existing form): shop/trader/phone/address — **owner-only editable**; employees see it **read-only** (inputs disabled + a "only an owner can edit" note). The old `SyncSettings` base-URL/token box is **removed** (Phase 7).

### Screen: Employees (owner-only) — Phase 8

`data-testid="employees-screen"` (reachable from Settings for owners only): a roster of members (name + phone + role) and an **Add employee** form — phone `data-testid="employee-phone-input"` + name label `data-testid="employee-name-input"` + **Add** `data-testid="add-employee-btn"` (writes an `invited` membership keyed by phone) and **Remove** per employee `data-testid="remove-employee-btn"`. Employees cannot see this screen.

### Screen: Activity log (owner-only) — Phase 9

`data-testid="activity-log"` (owner-only): a reverse-chronological list of activity entries `data-testid="activity-row"` — each shows actor name (snapshot), action (bill-create / payment / edit / delete), the bill id, and time. Read-only; append-only source. Employees never see it (enforced by Security Rules; a non-owner reaching it sees a "owners only" message, not raw data).

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
