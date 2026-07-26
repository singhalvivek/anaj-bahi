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

**Phase 12 — three surfaces mount ABOVE the existing `SearchBar`**, in this order, all **outside** the `bill-list` container (which doubles as the empty-state container): `unsynced-badge` (only when count > 0) → `month-strip` → `today-card`. The bill list, `bill-list`, `bill-card`, `new-bill-btn`, `SearchBar` and `search-no-results` are otherwise **untouched**. See [Phase-12 rollup surfaces](#phase-12-rollup-surfaces-home--rollup) below.

### Screen: New Bill Chooser (`/bills/choose`) — slice-b _(Phase 5; reordered Phase 12)_

**Purpose:** let the trader pick how to create a bill. `+ New Bill` (`new-bill-btn`) now routes here instead of straight to the fresh form.

**Key elements:**
- Two large, thumb-reachable, bilingual choice cards (≥56 px tall, big touch targets), stacked vertically in a container `data-testid="new-bill-choice"`. **Phase 12 reorders them — quick entry is the default path** (sack weights are the *farmer's* proof, not the trader's ledger — see [entry-defaults](capabilities/entry-defaults.md)):
  1. **Quick entry** — **FIRST and primary** (`data-testid="choice-quick"`, a `Link` to `/bills/quick`), visually emphasised, with a small **"Recommended" / "सुझाया गया"** pill `data-testid="choice-quick-badge"`. Hint reworded to "The usual way — copy the totals from your paper bill / रोज़ का तरीक़ा — काग़ज़ की बही से कुल आँकड़े भरें". Opens the summary form.
  2. **Fresh bill** — **second and secondary** (`data-testid="choice-fresh"`, a `Link` to `/bills/new`). Hint reworded to "When the farmer wants every sack listed / जब किसान को हर बोरे का हिसाब चाहिए". Lands in **exactly today's unchanged sack form**.
- **Titles are unchanged** ("Quick entry / झटपट प्रविष्टि", "Fresh bill / पूरी बही") and **both testids and both link targets are preserved verbatim** — only DOM order, emphasis, the new badge and the two hint strings change. Both journeys keep working end-to-end.
- Back link to home. No stubs; both options are live.

### Screen: Quick-Entry Bill (`/bills/quick`) — slice-b _(Phase 5)_

**Purpose:** transcribe a summary bill already written on paper — per-grain totals only, entered money amount authoritative. See [quick-bill-entry](capabilities/quick-bill-entry.md).

**Layout (top → bottom, single scroll) — mirrors the fresh form's bill-level chrome:**
1. **Farmer picker** (`FarmerPicker`, reused) — name **required**, place/village **required**, phone optional; same autocomplete. `data-testid="farmer-input"`.
2. **Purchase date** (defaults today, required) `data-testid="purchase-date"`; **Due date** `data-testid="due-date-input"` — **Phase 12: REQUIRED**, pre-filled to `addDaysIso(purchaseDate, 15)`, freely editable, re-derived when the purchase date changes **until** the trader hand-edits it (`dueDateTouched`, mirroring the `amountTouched` pattern below). Hint `dueDate.hint`. See [Phase-12 due-date behaviour](#phase-12-due-date-behaviour-both-entry-forms).
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
2. **Purchase date** — date field defaulting to **today**. `data-testid="purchase-date"`. **Due date** `data-testid="due-date-input"` — **Phase 12: REQUIRED**, pre-filled to `addDaysIso(purchaseDate, 15)`, freely editable, re-derived on purchase-date change until hand-edited (`dueDateTouched`). Hint `dueDate.hint`. See [Phase-12 due-date behaviour](#phase-12-due-date-behaviour-both-entry-forms).
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

## Phase-12 pilot-readiness surfaces

> The reader is a **50–60 year old grain trader on a low-end Android, in Hindi, one-handed**. These are the first screens in the app that show a figure spanning more than one bill, so readability and trust are the whole point. Product rationale: [home-rollups](capabilities/home-rollups.md), [entry-defaults](capabilities/entry-defaults.md); frozen signatures: [architecture.md § Phase-12 contract](architecture.md#phase-12-pilot-readiness-contract-frozen).

### Display rules — non-negotiable

- **Big numbers, Indian digit grouping** (`₹4,20,000`) via the **new** `formatRupeesIndian`. **`formatRupees` (2 dp, no separators) is unchanged** and stays the formatter for the bill card, bill detail, payments and the receipt.
- **Whole rupees on every rollup surface.** No paise anywhere in this phase's figures.
- **No lakh/crore shorthand** (`₹8.4L`, `₹1.2Cr`) anywhere — strategy §10 floats it, and it is **rejected here**: an abbreviated figure cannot be added by hand and would break the sum-of-visible-parts invariant that the whole feature's credibility rests on. Full grouped figures only.
- **Type size floor:** rollup figures render at `text-xl`/`text-2xl` bold with `tabular-nums` (labels small, above). A figure must **never** shrink below `text-lg` to fit — if three grouped values will not fit one row on a 390 px-wide portrait viewport, the strip **wraps to a second row** rather than shrinking the type.
- **Any visible total must equal the sum of the visible parts.** Each per-bill figure is rounded to a whole rupee **first**, then the rounded figures are added — never `round(true sum)`. He adds the column by hand; a ₹1 mismatch kills every number on the screen. (Same discipline as [data.md § Rounding decision](data.md#rounding-decision).)
- **Number density:** at most **three hero-sized figures** on home (the month strip). Today's four figures render as **one compact secondary line**. The badge is a status chip, not a figure.
- **≥48 px touch targets** (primary actions ≥56 px), thumb-reachable, mobile-first portrait, existing **stone/green** visual language. **No charts, no graphs, no sparklines.**
- **Never an empty screen.** A period with no data says so warmly in one line — never blank, never a bare zero with no context.
- **Never a misleading zero.** While `useBills()` is `undefined` ("not loaded yet") every figure renders a **skeleton bar** (matching the home list's existing skeleton), never `₹0`.
- **All** new strings go through `t()` with **both EN and HI** keys in `lib/i18n/dictionary.ts` (typed `Record<TKey,string>` — a missing HI key **fails the build**).
- **Every money figure carries a numeric `data-amount`** (whole rupees) and **every count a numeric `data-count`**, so E2E asserts values and the sum-equals-headline invariant without parsing grouped, translated text.

### Phase-12 rollup surfaces (Home + `/rollup`)

#### Surface: Unsynced badge — `data-testid="unsynced-badge"` (home, topmost)

Rendered **only when** the unsynced bill count is `> 0`, at the very top of home so it cannot be missed. Amber chip in the existing warning language, full width, ≥48 px, tappable:
- Text: `"<n> " + t('unsynced.bills')` ("3 bills not yet backed up / 3 बही का बैकअप बाकी") plus the reassurance line `unsynced.hint` ("These are saved on this phone. They upload automatically when you are online.") and `unsynced.tapToSee`.
- `data-count="<n>"`.
- **Clears only at zero** — no dismiss control, no snooze.
- **Anti-flicker:** appears only once `count > 0` has held continuously for `UNSYNCED_BADGE_DELAY_MS` (1500 ms), hides **immediately** at 0 — otherwise every save flashes a scary "not backed up" chip while online.
- Tap → `/rollup?metric=unsynced`.
- The Settings **Sync** section (`sync-status` and its testids) is **unchanged**.

#### Surface: "This month" strip — `data-testid="month-strip"` (home)

The hero block: a heading `rollup.month.title` ("This month / इस महीना") over **three** large figures, side by side, each an independent ≥48 px tap target with a `data-amount`:

| Element | Label | Value | Taps to |
|---------|-------|-------|---------|
| `month-bought` | `rollup.bought` ("Bought / खरीद") | `bought(current month)` | `/rollup?metric=bought-month` |
| `month-paid` | `rollup.paid` ("Paid / भुगतान") | `paid(current month)` | `/rollup?metric=paid-month` |
| `month-due` | `rollup.due` (**"Due (all) / कुल बकाया"** — the all-time scope is on the label, deliberately) | `due` (**all-time**, clamped per bill) | `/rollup?metric=due-all` |

- When the month has no bills: the three figures still read `₹0` **plus** a warm one-liner `month-empty` (`rollup.month.empty` — "No bills this month yet — add one and these numbers fill up"). The strip **never silently substitutes another month** — a strip labelled "This month" showing other numbers would be actively misleading. Period switching is Phase 13.

#### Surface: Close-of-day line — `data-testid="today-card"` (home)

**One compact secondary line** (not four tiles), exactly as strategy §9-P0.4 phrases it: `Today · 3 bills · ₹7,689 bought · ₹6,742 paid · ₹1,201 pending`, heading `rollup.today.title`. Elements `today-count` (`data-count`), `today-bought`, `today-paid`, `today-pending` (each `data-amount`). **The whole line is a single tap target** → `/rollup?metric=bought-today` (four sub-targets would each be under 48 px). With no bills today it shows the warm line `today-empty` (`rollup.today.empty`).

`paid(today)` and `pending(today)` have **no drill-down of their own**, by decision: their drillable counterparts `paid-month` and `due-all` are strict supersets containing the same bills, so every figure on home is either itself drillable or fully contained in one that is.

#### Screen: Rollup drill-down (`/rollup?metric=…`) — **new**

**Purpose:** the trust surface. *He will not believe a total he cannot check* (strategy §10). Query-param driven like `/bill?id=`, wrapped in `<Suspense>` for `useSearchParams` under static export (as `/bills/quick` does). Container `data-testid="rollup-screen"`.

`metric ∈ bought-month | paid-month | due-all | bought-today | unsynced`; an unknown or missing value falls back to `bought-month`.

**Layout (top → bottom):**
1. Sub-header: back link (`action.back`) + the metric's title (`rollup.title.boughtMonth` / `.paidMonth` / `.dueAll` / `.boughtToday` / `.unsynced`).
2. **`rollup-headline`** — the figure, hero-sized, Indian-grouped, with `data-amount`. For `unsynced` it is the **count** (`data-count`), not money.
3. **`rollup-count`** — "N bills" (`rollup.bills`), the honesty signal next to every total.
4. A one-line trust note `rollup.addsUp` ("These add up to the total above / ये जोड़कर ऊपर का कुल बनता है").
5. The rows — one `rollup-row` per contributing bill: farmer name + place, bill id + date, and **`rollup-row-amount`** (`data-amount`) on the right. Each row is a `Link` to `/bill?id=<encoded id>`. For `unsynced` the row amount is the bill's payable total (identification only, no sum invariant).
6. `rollup-empty` — a warm one-liner (`rollup.empty`) when there are no contributing rows. Never blank.

**Invariant, asserted in E2E:** `Σ (rollup-row-amount data-amount) === rollup-headline data-amount`, exactly, for every money metric — and the headline equals the `data-amount` of the home figure that was tapped.

Row order: `due-all` → amount descending (biggest exposure first); all others → newest first (matching the home list).

### Phase-12 due-date behaviour (both entry forms)

Identical on `/bills/new` (sack) and `/bills/quick` (summary). This is a **behaviour** change to an existing field — `due-date-input` and the `dueDate.label` key already ship on both forms.

- **Required.** Added to the save-enabled condition, appended **last** so the precedence and wording of every existing validation hint is unchanged. Its hint is `validation.dueDateRequired` ("Set a due date / देय तारीख भरें"), shown inline in the current language with `save-bill` disabled — the existing pattern.
- **Pre-filled** to `addDaysIso(purchaseDate, 15)` on mount (create), and **re-derived** whenever `purchaseDate` changes — **unless** the trader has hand-edited it (`dueDateTouched`, the same shape as the shipped `amountTouched` on the quick form's amount field). In edit mode a **stored** due date loads verbatim and is treated as touched (never auto-overwritten); a legacy bill with no stored due date pre-fills from its own `purchaseDate + 15`.
- **Freely editable, with no ordering constraint** — a due date **earlier** than the purchase date is accepted and saves. Bills are often transcribed days late with a date already past, and refusing that would block a real transaction (the shipped ledger E2E files bills due `2020-01-01`).
- Hint under the field: `dueDate.hint` ("Defaults to 15 days after the purchase date — change it if needed").
- The phone-keyboard **Next/Done** (`enterKeyHint`) wiring shipped in `#14` is **not touched** — the due date is a native `type="date"` picker, outside that chain.

### Screen: Due (`/due`) — Phase-12 legacy no-due-date group

The Due screen keeps its **dated-only** principle and its **three** existing buckets — `due-overdue`, `due-soon`, `due-upcoming` — with unchanged membership, contents, ordering and testids (a deliberate product decision from commit `bb0b6a3` that **stands**). Phase 12 adds **one additional, visually distinct section**:

- **`data-testid="due-no-date"`** — heading `due.noDate` ("No due date — set one / देय तारीख नहीं — तय करें") plus the explanatory line `due.noDate.hint` ("These older bills still owe money but have no due date"). Contains only **pre-Phase-12** bills: no `dueDate` **and** `outstanding > 0`, oldest `purchaseDate` first. From Phase 12 on nothing can create a new undated bill, so this group self-empties as he works through it.
- Each row shows the same identity + outstanding figure as a `due-row`, plus an inline repair control (`SetDueDateRow`): a compact `type="date"` input **`due-set-date-input`** pre-filled to `addDaysIso(bill.purchaseDate, 15)` and a ≥48 px **Set date** button **`due-set-date-btn`** (`due.setDate`) → `setBillDueDate`. On success a brief `due.dateSet` confirmation shows and the row **leaves this group and reappears in the correct dated bucket** automatically (the screen reads the live `useBills()` snapshot) — a visible, satisfying confirmation.
- **This works on a payment-locked bill**, deliberately: a due date changes no money figure, and a legacy bill with a partial payment is exactly the case whose outstanding money must not stay hidden.
- Inline repair is on the Due row itself (not behind a navigation to the bill) because forcing a navigate-away-and-back per bill is the difference between repairing twelve legacy bills and repairing none.
- The Due screen's **empty** state now requires **all four** buckets to be empty.

### Phase-12 testid summary

**New:** `month-strip`, `month-bought`, `month-paid`, `month-due`, `month-empty`, `today-card`, `today-count`, `today-bought`, `today-paid`, `today-pending`, `today-empty`, `unsynced-badge`, `rollup-screen`, `rollup-headline`, `rollup-count`, `rollup-row`, `rollup-row-amount`, `rollup-empty`, `choice-quick-badge`, `due-no-date`, `due-set-date-input`, `due-set-date-btn`.

**Preserved unchanged (must all still pass):** `choice-quick`, `choice-fresh`, `new-bill-choice`, `due-date-input`, `purchase-date`, `bill-list`, `bill-card`, `new-bill-btn`, `search-input`, `search-clear`, `search-no-results`, `filter-grain`, `due-list`, `due-row`, `due-overdue`, `due-soon`, `due-upcoming`, `sync-status`, `sync-pending-indicator`, `sync-online-indicator`, `sync-now-btn`, `save-bill`, `bill-total`, `paldari-input`, `post-save-share-sheet`, `post-save-done-btn`, `detail-bill-total`, `outstanding-balance`, `paid-total`, `edit-locked`, `payment-amount`, `payment-date`, `payment-add`.

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
