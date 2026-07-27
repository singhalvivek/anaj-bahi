# Capability: Entry Defaults (quick-first chooser · mandatory due date) — Phase 12

_Target phase: **Phase 12** (pilot readiness) · slice-a (date helper reuse + queries/repo extension + i18n) + slice-c (chooser, both entry forms, due screen)._

## What It Does
Makes the **fast path the default path** and makes **every new bill carry a due date**: Quick entry becomes the primary choice on the `+ New Bill` chooser (sack-by-sack becomes the secondary "the farmer wants every sack listed" path), and on **both** entry forms the due date is **required**, **pre-filled to `purchaseDate` + 15 days**, and freely editable. Because every new bill then has a due date, the Due screen's existing **dated-only** rule becomes complete — with one narrow, additive affordance for **pre-Phase-12 bills** that still owe money and have no due date.

## Why

**Quick entry first.** Individual sack weights **do not matter to the trader** — they are proof for the *farmer*, which is exactly why they are written on paper ([strategy §5](../../strategy/product-review-2026-07.md), intake Q11). So sack-by-sack is a **receipt generator**, not the ledger path. Today the chooser offers the slow form first; for a man transcribing a bill he has already written, that ordering is backwards. He types every bill himself, at up to ~100 bills/day at peak (Q8, Q9), so the default path has to be the fast one.

**Due date mandatory.** The Due screen only lists bills that carry a `dueDate`, and `dueDate` is optional at creation — so in real use it is empty most of the time and **silently under-reports real outstanding money** (§1.3, §9-P1.9). Strategy §9 offered two fixes: make the due date mandatory with a sane default (+15 days), or show all outstanding bills with undated ones grouped separately. **The decision taken here is the first**, because it fixes the problem at the source: the Due screen and the all-time `due` figure become complete for every bill created from now on, with no change to the dated-only principle. Commit `bb0b6a3` deliberately landed on "dated only" and that decision **stands** — this capability removes the *cause* of undated bills rather than reversing the rule.

**The one legacy exception.** Bills created before this phase may have no `dueDate` while still owing money. Those must not stay invisible — hidden outstanding money is the exact failure the mandatory due date exists to prevent. So they get **one clearly-labelled, additive group** on the Due screen with an inline "set a date" control. This is a **migration affordance for pre-Phase-12 rows, not a reversal of the dated-only principle**, and it self-empties as he works through it.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| purchase date | `string` ISO `yyyy-mm-dd` | the `purchase-date` field on either entry form (defaults today) | yes |
| due date | `string` ISO `yyyy-mm-dd` | the `due-date-input` field — pre-filled `addDaysIso(purchaseDate, 15)`, editable | **yes (now required)** |
| due-date touched flag | `boolean` (component state) | set true on any manual edit of `due-date-input` | yes |
| bills | `Bill[] \| undefined` | the existing live `useBills()` snapshot | yes (Due screen) |
| legacy due date | `string` ISO `yyyy-mm-dd` | the inline `due-set-date-input` on a no-due-date row — pre-filled `addDaysIso(bill.purchaseDate, 15)` | yes (that row only) |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| `Bill.dueDate` | `string` (ISO) — now always present on newly created bills | `businesses/{bizId}/bills/{billId}` via the unchanged `createBill` / `updateBill` |
| `Bill.dueDate` (legacy repair) | `string` (ISO) | `setBillDueDate(billId, dueDate)` — a narrow repo mutation that writes **only** `dueDate` + `updatedAt` |
| fourth due bucket | `DueBuckets.noDueDate: Bill[]` | the `due-no-date` section on `/due` |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Cloud Firestore (via `createBill`/`updateBill`) | unchanged bill write, now always carrying `dueDate` | unchanged — local-first write, queues offline |
| Cloud Firestore (via `setBillDueDate`) | set `dueDate` + `updatedAt` on one bill doc; best-effort `activity` append (`type: 'bill-edit'`) | local-first: succeeds offline and syncs on reconnect; the row's inline error uses the existing `error.generic` string; the activity append is best-effort and never blocks |

No new network surface, no schema change, no `firestore.rules` change (bills are already read/write for any member of the business).

---

## Item 1 — Quick entry becomes the default (`/bills/choose`)

- **Order:** `choice-quick` renders **first** in the `new-bill-choice` container; `choice-fresh` second. Both remain live `Link`s to `/bills/quick` and `/bills/new`.
- **Prominence:** the quick card is styled as the primary choice (filled/emphasised, the fresh card visually secondary) and carries a small **"Recommended" / "सुझाया गया"** pill, `data-testid="choice-quick-badge"`.
- **Hints reworded** so quick reads as the normal path and fresh reads as the itemised-proof path:
  - `choice.quick.hint` → "The usual way — copy the totals from your paper bill" / "रोज़ का तरीक़ा — काग़ज़ की बही से कुल आँकड़े भरें"
  - `choice.fresh.hint` → "When the farmer wants every sack listed" / "जब किसान को हर बोरे का हिसाब चाहिए"
- **Titles are NOT changed** (`choice.fresh.title` stays "Fresh bill" / "पूरी बही", `choice.quick.title` stays "Quick entry" / "झटपट प्रविष्टि") — minimum churn, and no shipped assertion depends on them.
- **`choice-quick`, `choice-fresh` and `new-bill-choice` testids are preserved verbatim**, and both journeys keep working end-to-end. Only DOM order, styling, the badge and the two hint strings change.

## Item 5 — Due date required, pre-filled at `purchaseDate + 15 days`

Applies identically to **both** `/bills/new` (sack) and `/bills/quick` (summary). This is a change of **behaviour on an existing field** — the `dueDate.label` i18n key and the `due-date-input` testid already exist on both forms.

**Prefill + touched tracking** — mirroring the shipped `amountTouched` pattern in the quick form (a stored/hand-edited value is authoritative and is never auto-overwritten):

| State | Rule |
|-------|------|
| Create, initial mount | `dueDate = addDaysIso(purchaseDate, 15)`, `dueDateTouched = false` |
| `purchaseDate` changes **and** `!dueDateTouched` | re-derive: `dueDate = addDaysIso(purchaseDate, 15)` |
| `purchaseDate` changes **and** `dueDateTouched` | leave `dueDate` alone |
| User edits `due-date-input` | `dueDateTouched = true` (and stays true) |
| Edit mode, bill **has** a `dueDate` | load it verbatim, `dueDateTouched = true` (a stored due date is authoritative) |
| Edit mode, legacy bill with **no** `dueDate` | `dueDate = addDaysIso(bill.purchaseDate, 15)`, `dueDateTouched = false` |

- **Use the existing `addDaysIso(iso, days)` from `lib/calc`** (UTC math, no DST drift) and the existing `todayIso()`. Do **not** write new date arithmetic.
- **Validation — two edits per form, both required:**
  1. `valid` gains `&& dueReady` (where `dueReady = !!dueDate`) — `/bills/quick`'s `valid = farmerReady && dateReady && linesReady`, `/bills/new`'s `valid = farmerReady && linesReady`.
  2. The `hint` if/else-if chain gains a **final `else if (!dueReady) hint = t('validation.dueDateRequired')` branch**. This is not optional: the hint is rendered as `{!valid && hint && …}`, so adding `dueReady` to `valid` **without** adding the branch would disable **Save** while showing **no explanation at all** — a dead end for the user.
  Appending both **last** leaves the precedence and wording of every existing hint unchanged.
- **No ordering constraint.** A due date **before** the purchase date is accepted. A bill is often transcribed days late with a due date already past — refusing that would block a real transaction, and the shipped `ledger-journey.spec.ts` deliberately files a bill with a due date of `2020-01-01`.
- A short hint under the field explains the default: `dueDate.hint` → "Defaults to 15 days after the purchase date — change it if needed." / "खरीद तारीख से 15 दिन बाद अपने-आप — ज़रूरत हो तो बदलें।"
- The `dueDate: dueDate || undefined` shape at both save sites is left as-is (defensive; the value is now always set).
- **Do not touch the `enterKeyHint` / phone-keyboard Next-Done wiring** on either form (shipped in `#14`). The due date is a native `type="date"` picker and is not part of that chain.

## The Due screen — dated-only stands, plus one additive legacy group

`listDueBills` gains a **fourth, separately-named** bucket. The three existing buckets' membership rules, contents and ordering are **unchanged**, so `due-overdue` / `due-soon` / `due-upcoming` and the shipped due assertions keep passing byte-for-byte.

```
noDueDate = bills where  !bill.dueDate  AND  billBalance(bill).outstanding > 0
            sorted by purchaseDate ASC (oldest first; ties by createdAt ASC)
```

- Oldest first, because an old undated unpaid bill is the more urgent one — consistent with the other three buckets, which are `dueDate`-ascending (most urgent first).
- Fully-paid undated bills never appear (same `outstanding > 0` gate as every other bucket).
- Rendered as a distinct section `due-no-date`, **visually separate from and additional to** overdue / due-soon / upcoming, headed `due.noDate` ("No due date — set one" / "देय तारीख नहीं — तय करें") with the explanatory line `due.noDate.hint`.
- The Due screen's `empty` state now requires **all four** buckets to be empty.

### "Set a date" and the edit-lock — decided, not left to the generator

A bill **locks once any payment is recorded** (`updateBill` throws `BillLockedError` when the stored bill has payments). A legacy bill with a payment against it and no due date is precisely the case that must be fixable, so the repair path **must not** go through `updateBill`.

**Decision:** a new narrow repo mutation, **`setBillDueDate(billId, dueDate)`**, writes **only** `dueDate` + `updatedAt` and is **deliberately not gated by the edit-lock**. Justification:

1. The edit-lock exists to protect **purchase figures** (weights, prices, deductions, paldari, amounts) from changing after money has moved. A due date is a **scheduling** field.
2. `billBalance` never reads `dueDate` — setting it **cannot** change any money figure, any total, or any payment.
3. The alternative (requiring the bill be unlocked) would leave outstanding money permanently hidden on exactly the bills that have partial payments — the worst possible failure.
4. The write is attributed: it appends a best-effort `activity` entry with the existing `type: 'bill-edit'` and a "due date set" summary, so it is auditable. **No new `ActivityType`**, no schema change.

**Where:** inline on the `due-no-date` row itself — a compact `type="date"` input (`due-set-date-input`, pre-filled `addDaysIso(bill.purchaseDate, 15)`) plus a **Set date** button (`due-set-date-btn`, ≥48 px). Rationale: he is already looking at the list of bills whose money is hidden; forcing a navigate-away-and-back per bill is the difference between repairing twelve legacy bills and repairing none. On success the row leaves `noDueDate` and reappears in the correct dated bucket automatically (the screen reads the live `useBills()` snapshot) — a visible, satisfying confirmation.

## Business Rules
- Both create paths keep working exactly as today apart from the due-date requirement; **no fields are removed, added, or reordered** on either form.
- Quick entry still shows **no** post-save share prompt; the fresh flow still shows it (Phase 11 unchanged).
- Legacy bills are never mutated in bulk and there is **no migration script** — the group self-empties as he sets dates.
- The legacy group is for **pre-Phase-12 rows only**; nothing in this phase can create a new undated bill.

## Testids (see [ui.md](../ui.md))
New: `choice-quick-badge`, `due-no-date`, `due-set-date-input`, `due-set-date-btn`.
Preserved unchanged: `new-bill-choice`, `choice-quick`, `choice-fresh`, `due-date-input`, `purchase-date`, `save-bill`, `due-list`, `due-row`, `due-overdue`, `due-soon`, `due-upcoming`, `post-save-share-sheet`, `post-save-done-btn`.

## Success Criteria
- [ ] On `/bills/choose`, `choice-quick` is the **first** child of `new-bill-choice`, carries `choice-quick-badge`, and still navigates to `/bills/quick`; `choice-fresh` is second and still navigates to `/bills/new`.
- [ ] On a fresh `/bills/quick` **and** a fresh `/bills/new`, `due-date-input` is pre-filled to exactly `addDaysIso(today, 15)`.
- [ ] Changing `purchase-date` re-derives `due-date-input` to `purchaseDate + 15` **while untouched**, and leaves it alone **after** a manual edit.
- [ ] Clearing `due-date-input` disables `save-bill` and shows the `validation.dueDateRequired` hint; refilling it re-enables save.
- [ ] A due date **earlier** than the purchase date is accepted and saves (no ordering validation).
- [ ] Editing a bill that already has a `dueDate` never auto-overwrites it.
- [ ] `listDueBills` returns `{ overdue, dueSoon, upcoming, noDueDate }`; the three existing buckets' contents **and ordering** are identical to before for the same input (unit-tested against the existing fixtures).
- [ ] `noDueDate` contains exactly the bills with no `dueDate` and `outstanding > 0`, oldest `purchaseDate` first; a fully-paid undated bill is absent.
- [ ] A **locked** legacy bill (has a payment, no due date, still owes) appears under `due-no-date`, its `due-set-date-input` is pre-filled to `purchaseDate + 15`, and `due-set-date-btn` succeeds — proving `setBillDueDate` bypasses the edit-lock — after which the bill appears in `due-upcoming` and `due-no-date` no longer contains it.
- [ ] `updateBill`'s edit-lock behaviour is otherwise unchanged (`edit-locked` still shown, purchase edits still rejected).
- [ ] Every new EN key has an HI counterpart (build type-checks).
- [ ] The whole flow works offline.

## Explicitly OUT OF SCOPE (do not build)
- **Do not re-add an "undated" bucket for new bills** and **do not change the dated-only principle** or the three existing buckets — commit `bb0b6a3` stands.
- **Do not make Due balance-driven** (i.e. do not list every outstanding bill regardless of date). The mandatory due date makes dated-only complete; the legacy group is the only exception.
- **No general edit/delete/correction/reversal path**, no unlocking of the edit-lock for anything other than `dueDate`, no new `ActivityType`.
- **No bulk migration** of legacy bills, no "set all due dates" action.
- **No due-date editing on the bill detail screen** — the inline Due-screen control is the only repair surface this phase.
- **No field removal or reordering to hit a 30-second entry target** — that measurement is done manually by the product owner after this build.
- **No changes to the sack-by-sack interaction, the receipt, payments, paldari, or the post-save share prompt.**
- **No new route** for the chooser or the forms; no `firestore.rules` change.
