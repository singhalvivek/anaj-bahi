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
4. **Grain lines** — one card per line, **≥1**, `+ Add another grain` (`grain.addAnother`). Per line (`QuickGrainLineEditor`), fields in this exact order **(Phase 10 reorder)**:
   - **Grain type** selector (seeded + add-custom, reused) — **required**. `data-testid="grain-type-select"`.
   - **Price per quintal (₹)** — **required, > 0**. `data-testid="price-input"`.
   - **Total sacks** — optional integer, `inputmode="numeric"`, **rendered WITHOUT any "(optional)" label** (just field + placeholder). `data-testid="sack-count-input"`.
   - **Total weight (kg)** — **required, > 0**; ONE number (gross), `inputmode="decimal"`. `data-testid="total-weight-input"`.
   - **Deduction (kg)** — optional single number, `inputmode="decimal"`, **rendered WITHOUT any "(optional)" label**. `data-testid="deduction-kg-input"`. (NOT the multi-basis deduction editor — one total-kg figure.)
   - **Amount (₹)** — **required, > 0**; `inputmode="decimal"`. `data-testid="amount-input"`. **Phase 10:** auto-computed from `(totalWeight − deductionKg) / 100 × price` as the trader fills price/weight/deduction, but **editable** — once the trader edits the amount by hand it stays authoritative (`amountTouched`) and is never auto-overwritten. Hint `quick.amountAuto` ("Auto-calculated — edit or cross-check"). The stored amount is authoritative (never recomputed by the calc engine).
   - **Remove line** when > 1 line.
5. **Paldari (labour charge)** input — a bill-level ₹ text input (`inputmode="decimal"`), placed in the footer **below the grain lines, above `LiveTotals`**, near the live total. Optional; blank ⇒ merchant bears it. `data-testid="paldari-input"`, label `paldari.label`, hint `paldari.hint`. When > 0 it is subtracted from the total (see [Paldari, data.md](data.md#paldari-labor-charge--phase-10)).
6. **Live bill total** (`LiveTotals`, reused) — at the end of the form in normal flow (NOT sticky) = **Σ the entered line Amounts − paldari** (net payable). `data-testid="bill-total"` shows the **net** total; when paldari > 0 a subtle subtotal + paldari-deduction breakdown (`data-testid="paldari-line"`) renders just above the green box.
7. **Save** (`data-testid="save-bill"`, reused) at the end of the form. **Enabled only when** farmer name + place + purchase date are set AND every line has grainType + price > 0 + total weight > 0 + amount > 0; disabled otherwise with an inline bilingual hint (same pattern as the fresh form). `sackCount`/`deductionKg`/`paldari` are never required.

**On save:** assemble a `Bill` with `entryMode: 'summary'`, each line carrying `summary: { totalWeightKg, sackCount?, deductionKg?, amount }` (and `sackWeights: []`, `deductions: []`), plus `paldari` (only when > 0; omitted otherwise), call `repo.createBill`. **Phase 11 (create branch only):** capture the returned `Bill` and show the **Post-Save Share Prompt** (below) instead of navigating straight home; **Done** navigates to `/`. In edit mode (`/bills/quick?edit=<id>`) it loads the summary bill, pre-fills (incl. paldari), and `updateBill` (respecting the edit-lock), navigating to `/bill?id=…` **unchanged (no prompt)**. No network.

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
5. **Paldari (labour charge)** input **(Phase 10)** — a bill-level ₹ text input (`inputmode="decimal"`), in the footer **below the grain lines, above `LiveTotals`**. Optional; blank ⇒ merchant bears it. `data-testid="paldari-input"`, label `paldari.label`, hint `paldari.hint`. When > 0, subtracted from the total.
6. **Live bill total** (`LiveTotals`) — rendered **at the end of the form in normal flow (NOT sticky/fixed)**, updates on every keystroke = **Σ line amounts − paldari** (net payable). `data-testid="bill-total"` shows the net; when paldari > 0 a subtle subtotal + paldari-deduction breakdown (`data-testid="paldari-line"`) shows just above the green box. It must **not** be pinned to the viewport: while the trader is entering sacks the on-screen keyboard already occupies the bottom (see the sack-entry rationale below), so a pinned total + Save would leave almost nothing of the input visible on a phone.
7. **Save** (large primary button), **also at the end of the form in normal flow** (below the live total, not fixed). `data-testid="save-bill"`. Validation: ≥1 farmer, ≥1 grain line with ≥1 sack and a price > 0; disabled otherwise with an inline hint.

**On save:** assemble the `Bill` (incl. `paldari` only when > 0, omitted otherwise), call `repo.createBill`. **Phase 11 (create branch only):** capture the returned `Bill` and show the **Post-Save Share Prompt** (below) instead of navigating straight to `/`; **Done** navigates to `/` (list). The **edit** branch navigates to `/bill?id=…` **unchanged (no prompt)**. No network.

### Screen: Post-Save Share Prompt (Phase 11) — post-save-share

**Purpose:** after a **successful create** in either flow (`/bills/new` sack OR `/bills/quick` summary), offer to share the receipt right away instead of forcing a reopen. See [post-save-share](capabilities/post-save-share.md).

**Key elements:** a bottom-sheet `data-testid="post-save-share-sheet"` in the same visual language as the detail-page `SharePanel` sheet (positioned below the sticky top bar so the language toggle stays reachable), with:
- A short title (`postsave.title`, e.g. "Bill saved / बही सहेज ली गई").
- **Share receipt** — `data-testid="post-save-share-btn"` (`postsave.share`) → opens the reused **receipt preview + share** sheet (`ReceiptShareSheet`, testids `receipt-preview` / `receipt` / `share-image` / `share-close` / `share-fallback` / `share-error` — identical to the detail-page flow), which rasterises via `shareReceiptImage` → `navigator.share({files})` with a PNG-download fallback.
- **Done** — `data-testid="post-save-done-btn"` (`postsave.done`) → navigates to `/` (home), the same destination as before Phase 11.

**Behaviour rules:** shown **only on create success** (never on validation/save failure, never on edit); fully offline (no network added); receipt language/content follow the current toggle and the calc engine. The **detail-page** Share button (`share-receipt`) and its sheet are **unchanged** — this prompt reuses the same extracted `ReceiptShareSheet` without altering that flow.

### Screen: Bill Detail / Reopen (`/bill?id=<encoded id>`) — slice-c

**Purpose:** reopen a saved bill and see identical data.

**Branch on `entryMode` (`bill.entryMode ?? 'sacks'`) — Phase 5:**
- **`'summary'` bill** → render each grain **totals-only**: grain name, price, **total weight**, **sacks** (only if `summary.sackCount` given), **deduction kg** (only if `summary.deductionKg` given), and the **entered amount** — plus the bill total. **No sack column-grid.** Container `data-testid="detail-summary-line"` per grain; `detail-bill-total` reused. Edit link points to `/bills/quick?edit=<encoded id>`.
- **`'sacks'` bill** → renders **exactly as today** (the paper-ledger column-grid below). Edit link points to `/bills/new?edit=<encoded id>`. Provably unchanged.

**Paldari (Phase 10):** the bill-total section reads through `billBalance(bill)`. `data-testid="detail-bill-total"` now shows the **net** payable total (`balance.total`, unchanged testid). When `balance.paldari > 0`, a small breakdown renders **just above** the green total box: a "Subtotal" row (`totals.subtotal` → `linesTotal`) and a "Paldari" row (`paldari.short` → `−paldari`, `data-testid="detail-paldari"`). With no paldari the section is byte-for-byte as before (net === subtotal). PaymentsPanel outstanding is automatically net-of-paldari (it already reads `billBalance`).

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
4. **Bill grand total** ₹ = sum of the grains' Amount cells **minus paldari** (net payable), shown as a trailing **"Total" column** or a **bill-total line** under the table (`data-testid="receipt-total"`). **Paldari (Phase 10):** when `bill.paldari > 0`, a subtle breakdown renders between the summary table and the green total box — a "Subtotal" row (`receipt.subtotal` → Σ line amounts) and a "Paldari" row (`receipt.paldari` → `−paldari`, `data-testid="receipt-paldari"`) — styled with the same inline-hex colours as the rest of the receipt (never Tailwind colour classes, since the receipt is rasterized to PNG). With no paldari `netTotal === linesTotal`, so existing receipts are visually unchanged.

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

> All bilingual Hindi/English, big-button, one-handed, low-end-Android — same conventions as above. These are rendered by the **`AuthGate`** (conditional on `useAuth().status`), **not** as new App-Router routes (static-export-safe). Contracts are frozen in [architecture.md § Firebase multi-tenant redesign](architecture.md#firebase-multi-tenant-redesign-phases-69--frozen-contracts). Product detail is in the capability files ([google-auth](capabilities/google-auth.md), [first-run-role-chooser](capabilities/first-run-role-chooser.md), [business-tenancy](capabilities/business-tenancy.md), [employee-management](capabilities/employee-management.md), [activity-log](capabilities/activity-log.md), [personal-profile](capabilities/personal-profile.md)).

### India-only phone entry (`PhoneField`)

The app serves **Indian traders only**, so **every** phone field uses one shared component, `frontend/src/components/PhoneField.tsx`, rather than a free-form E.164 text box. It renders a **fixed, non-editable `🇮🇳 +91` prefix chip** next to a numeric input; the user types **only the local 10 digits**. The component's value in/out is always canonical **E.164** (`+91XXXXXXXXXX`, or `''` when empty), so callers store and validate one shape everywhere:

- **Parsing is tolerant** (`localDigits`): a stored E.164, a legacy free-form string, or a full number pasted with the country code all resolve to the same local 10 digits (a leading `91` is stripped only when the value exceeds 10 digits, so a genuine 10-digit number starting `91` survives).
- **Validation** (`isValidIndianPhone`): `/^\+91\d{10}$/` — used by JoinByCode (mobile step), Generate-code (enable Generate), Personal-profile mobile, and Business-profile phone.
- **Applies to:** JoinByCode mobile (`join-mobile-input`), Generate-code employee phone (`employee-phone-input`), Personal-profile mobile (`personal-mobile-input`), Business profile phone (`settings-phone`), and the farmer phone in `FarmerPicker`. **Login no longer has a phone field** (Google sign-in). The personal profile shows the Google **email** read-only (the identity), not a phone.

### Screen: Login (Google sign-in) — Phase 6, slice-b

Shown when `status === 'signed-out'`. Container `data-testid="login-screen"`.
1. App title + a one-line "Sign in to your grain ledger" subtitle, and the **language toggle** so a first-time user can pick Hindi/English up front.
2. A single **Continue with Google** button `data-testid="google-signin-btn"` → calls `signInWithGoogle()` (`signInWithPopup(GoogleAuthProvider)`). **No phone field, no OTP input, no reCAPTCHA container** — all removed.
3. Inline bilingual error on popup-closed / network / unauthorized-domain (mapped from the Firebase error). Never crashes; the button stays tappable to retry.

### Screen: First-run onboarding — Phase 6, slice-b

Shown when `status === 'onboarding'` (signed in, no `bizId`). A short stepped flow inside `data-testid="onboarding"`:
1. **Name prompt** (`data-testid="name-prompt"`): "What's your name?" — `data-testid="display-name-input"` **prefilled from the Google account** (editable), **Continue** `data-testid="name-continue-btn"` (required, non-blank) → `setDisplayName`.
2. **Onboarding-path chooser** (`data-testid="role-chooser"`): two large cards — **"New business"** `data-testid="choose-new-business"` and **"Business already registered"** `data-testid="choose-existing-business"` → `chooseOnboardingPath('create' | 'join')` runs the pure [onboarding route](capabilities/first-run-role-chooser.md). **Role-free wording** — the words "owner", "partner", and "employee" must not appear anywhere in onboarding.
3a. **New business → Create business** (`data-testid="create-business"`): name `data-testid="biz-trader-input"` (prefilled from Google, editable, required), shop name `data-testid="biz-shop-input"` (required), **mobile** via `PhoneField` `data-testid="biz-phone-input"` (required), address `data-testid="biz-address-input"` (optional); **Create** `data-testid="create-business-btn"` → `createOwnerBusiness` → lands in the app as **owner**.
3b. **Business already registered → Join by code** (`data-testid="join-by-code"`): a stepped flow — **step 1** code input `data-testid="join-code-input"` + **Next** `data-testid="join-code-next"` (verifies `invites/{code}` exists and is unused; else a distinct "code invalid/used" error); **step 2** mobile via `PhoneField` `data-testid="join-mobile-input"` + **Next** `data-testid="join-mobile-next"` (must match `invite.phoneKey`; else a distinct "number doesn't match" error); **step 3** name `data-testid="join-name-input"` (prefilled from Google) + **Join** `data-testid="join-submit"` → `joinByCode({ code, phoneE164, name })` → lands in the app with the **invite's role** (employee or partner). The old "ask your owner" dead-end is removed.

### Signed-in identity / account strip — Phase 6 (relocated to Settings)

When `status === 'ready'` the app shell is `TopBar` + `<main data-testid="gated-home">` (the ready-state marker) + `BottomNav`. The signed-in **identity strip is NOT rendered above every screen** — it eats vertical space that the bill list needs. It lives on the **Settings** screen only, as the top **Account strip** (`data-testid="account-strip"`):
- **Greeting + display name** `data-testid="home-user-name"`, **business name** `data-testid="home-business-name"`, and **Sign out** `data-testid="sign-out-btn"` (calls `signOut` → returns to Login). **No role badge** — the old `home-role` badge is **removed** for everyone (owners, partners, and employees); roles appear only in the Members roster.
- The shared cloud & roles ledger **shipped** (Phases 6–9 = Firestore multi-user shared store), so the old "shared cloud & roles — coming soon" banner (`stub-shared-cloud`) is **removed** — it is no longer accurate.

### Screen: Settings — Personal profile vs Business profile — Phase 8

The Settings screen splits into two sections:
1. **Personal profile** (`data-testid="personal-profile"`): the user's own **display name** (editable, `data-testid="personal-name-input"`) + **mobile** (editable, `PhoneField` `data-testid="personal-mobile-input"`, profile data only) + Google **email** (read-only, the identity) + language, with **Save** `data-testid="personal-save"`. Display name is shown in attribution. **No role badge** — the old `personal-role` badge is **removed** for everyone (owners, partners, and employees).
2. **Business profile** (`data-testid="business-profile"`, the existing form): shop/trader/phone/address — **owner-only editable**; **partners and employees alike** see it **read-only** (inputs disabled + a "only an owner can edit" note). The old `SyncSettings` base-URL/token box is **removed** (Phase 7).

The Settings nav entries that link to the **Members** and **Activity** screens are shown to **owners and partners** (managers); employees do not see those entries.

### Screen: Members (owner or partner) — Phase 8

`data-testid="employees-screen"` (reachable from Settings for **owners and partners** — managers only), with three parts. **Generate invite:** mobile `PhoneField` `data-testid="employee-mobile-input"` (no name field — the member's name comes from their Google login at claim) **+ a role picker `data-testid="invite-role-select"`** with two options **Employee / Partner** (Partner shown as **साझेदार** in Hindi) + **Generate code** `data-testid="generate-code-btn"` → writes `invites/{code}` with the picked role and shows the 6-char code **large** (`data-testid="invite-code"`) with a **Copy** button `data-testid="copy-code-btn"` to share out-of-band. **Pending invites** `data-testid="pending-invites"`: each unclaimed invite row `data-testid="pending-row"` shows its assigned mobile + **role** + code + a **Cancel** button `data-testid="cancel-invite-btn"`. **Member roster:** claimed members (name + phone + a **role badge** `data-testid="member-role"` — **Owner / Partner / Employee**), with a **Remove** button `data-testid="remove-employee-btn"` shown **only for non-owner rows** (employees and partners) — owner rows have **no Remove control**. A partner removing an employee or another partner succeeds; removing an owner is impossible (no control; Rules also reject). **This roster is the only place in the app a role is displayed.** Employees cannot see this screen.

### Screen: Activity log (owner or partner) — Phase 9

`data-testid="activity-log"` (managers only — owner or partner): a reverse-chronological list of activity entries `data-testid="activity-row"` — each shows actor name (snapshot), action (bill-create / payment / edit / delete), the bill id, and time. Read-only; append-only source. Employees never see it (enforced by Security Rules; a non-manager reaching it sees a "owners & partners only" message, not raw data).

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
