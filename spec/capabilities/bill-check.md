# Capability: Bill Check (photo → read → verify)

_Phase 13 · slice-a (pure verify + parse) → slice-b (reader + image) → slice-c (screen + E2E)_

## What It Does
Adds a **third, non-destructive** use of the app: the trader photographs a bill he has
**already written on paper**, an LLM **reads the handwriting**, and the app **checks the
arithmetic** with its own pure `lib/calc` engine. The result is a tabular read-back of the
bill plus two explicit verdicts — **line math** and **addition** — with every number the
model was unsure about flagged for correction.

**Nothing is saved.** No `Bill`, no farmer, no Firestore write, no payment. This capability
is read-only against the ledger; it is a calculator with eyes.

## Why (user problem)
Two reasons, in order of value.

1. **Arithmetic is what paper is worst at.** It is the first line of
   [roadmap.md](../roadmap.md) § Core Problem (*"error-prone arithmetic (sack weights,
   deductions, per-quintal pricing)"*) and it is still unaddressed: today the app only
   computes correctly for bills typed *into* the app, which is the one case where the
   trader has already stopped using paper.
2. **It needs no adoption.** Entry speed is the measured pilot blocker —
   [plan.md](../../strategy/plan.md) § A2 measured **55s → ~45s practised against a <30s
   target**, and concluded: *"field-trimming alone will not make self-entry comfortable
   and the answer is batch evening entry or a different capture mode (photo of the paper
   page, transcribe later)."* Bill Check is that capture mode's first half. A trader gets
   value in 10 seconds without an account habit, without trusting our storage, and
   **without breaking the habit of writing on paper** — which is the switching cost that
   stopped the product owner's father from piloting at all.

## Scope boundary (what this capability deliberately is NOT)
| Not in scope | Why |
|---|---|
| Saving the read as a `Bill` | Deferred on purpose. Entry replacement is the *second* product; shipping it in this phase would couple an unproven OCR accuracy figure to the shipped `quick-bill-entry` contract. Revisit once the pilot yields a real confident-and-wrong rate. |
| Drawing boxes over the doubtful numbers on the photo | Needs bounding-box output from the model, unverified on real bills. v1 flags the **cell** in the table instead (amber + tap to correct) — most of the value, none of the coordinate risk. Revisit only if the confidence flags prove to correlate with being wrong. |
| The LLM doing any arithmetic | See § The LLM is eyes only. Non-negotiable. |
| Storing the photo anywhere but the device | Keeps Firebase on **Spark** (no Storage, no Blaze) and keeps other people's farmers' bills off any server of ours. |
| Reading a *printed* bill, a sale bill, or a multi-bill page | v1 reads one handwritten purchase bill per photo. Anything else degrades to the normal "couldn't read it" path. |

## The LLM is eyes only — the load-bearing design rule
The model returns **only what it read**. Every rupee is computed afterwards by the existing
pure [deductions-and-totals-calc](deductions-and-totals-calc.md) engine.

```
photo ──► LLM ──► { numbers read, per-field confidence }   ← non-deterministic, untrusted
                            │
                            ▼
                     lib/calc (pure)                        ← deterministic, unit-tested
                            │
                            ▼
              computed amounts  vs  what the paper claimed
```

Rationale, from [plan.md](../../strategy/plan.md) § UI rules: *"Any visible total = the sum
of the visible parts. Round each figure first, then add. He adds the column by hand; **if
your total is off by 0.01, every number on the screen dies with it.**"* A non-deterministic
model doing rupee arithmetic is the worst available choice against that rule. Routing the
numbers through `lib/calc` also means this capability inherits every rounding guarantee,
`roundRupees` boundary case and worked example already proven in Phases 1–12 — and the model
only has to be good at **reading handwriting**, which collapses model selection to one
measurable axis.

## User Flow
1. Home → **`bill-check-btn`** ("काग़ज़ की बही जाँचें" / "Check a paper bill"), directly under
   the Phase-12 today line, above the search bar. The bill list and `new-bill-btn` are
   untouched.
2. `/bills/check` → **`check-photo-btn`** opens the camera (`capture="environment"`) or the
   gallery.
3. The photo renders immediately as a local preview (`check-photo-preview`). It is
   downscaled on-device before anything leaves the phone.
4. **`check-read-btn`** sends it. While in flight: `check-reading` with a bilingual
   "reading your bill" line. On failure: `check-error` plus a retry, and the photo is
   **kept** (never makes him re-shoot).
5. Result: `check-result` — a per-grain table (`check-line-row`) and the verdict card
   (`check-verdict`). Low-confidence cells carry `check-cell-unsure` and are tappable.
6. Correcting any cell **re-runs `lib/calc` locally and instantly** — no second API call.
   This is the whole reason the model is not allowed to do the math.
7. **`check-accept-paper`** ("काग़ज़ सही है" / "The paper is right") dismisses the verdict
   without changing a number, and the screen stops flagging that photo.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| photo | `File` (image/jpeg\|png\|webp) | `<input type="file" capture="environment">` | yes |
| apiKey | string | `NEXT_PUBLIC_GEMINI_API_KEY` (build-time inlined) | yes — absent ⇒ the screen renders a labelled **not configured** state, never a crash |
| model | string | `NEXT_PUBLIC_GEMINI_MODEL`, default `gemini-flash-lite-latest` | no |
| corrections | per-field numbers | the trader tapping an amber cell | no |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| `ReadBill` | parsed + validated model output | React state only — **never persisted** |
| `BillCheckResult` | pure verdict (see § Verify contract) | rendered; never persisted |
| photo | downscaled JPEG blob | in-memory for the session only; discarded on navigate away |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Gemini `generativelanguage.googleapis.com` `:generateContent` | one request per read: inline downscaled image + a frozen prompt + a strict `responseSchema` | **Visible, specific, bilingual** error; the photo is retained and the read is retryable. Offline gets its own distinct message. Never a silent failure, never a partial result. |

**This is the app's first external API call and first online-only feature.** Everything
else in Anaj Bahi works offline, so the screen must say *why* it cannot work rather than
appearing broken — `navigator.onLine === false` gets its own message
(`check.error.offline`) ahead of any network attempt.

## Verify contract (pure — `lib/billcheck/verify.ts`)
For each read line, with `rate`, `weightKg`, `deductionKg?` and the line's **written**
`amount`:

```
net             = max(0, weightKg − (deductionKg ?? 0))
computedAmount  = roundRupees(net / 100 × rate)      ← via lib/calc.computeGrainLine
lineDiff        = roundRupees(writtenAmount − computedAmount)
```

At bill level, three figures and **two independent diffs** — because they are two different
mistakes and the trader fixes them differently:

```
sumWritten    = roundRupees(Σ written line amounts)
sumComputed   = roundRupees(Σ computedAmount)          ← computeBillTotal of the read lines
paperTotal    = the grand total written at the bottom  (may be absent)

mathDiff      = roundRupees(sumWritten − sumComputed)  ← his per-line rate × weight was off
additionDiff  = roundRupees(paperTotal − sumWritten)   ← he added his own column wrong
```

- `paldari`, when read, is subtracted from `sumComputed` through the same `billBalance`
  path the rest of the app uses, so the figure is net-of-paldari exactly as everywhere else.
- **No tolerance, no heuristics.** Diffs are reported exactly as computed. A trader who
  rounded to the nearest ₹5 on purpose presses `check-accept-paper`; the app does not guess
  at his intent. (Warn, never block — [plan.md](../../strategy/plan.md) § Track E.)
- `verdict` = `'ok'` when both diffs are `0`; `'check'` when either is non-zero;
  `'incomplete'` when an amount-bearing field could not be read at all.

## Business Rules
- **The paper is never silently corrected.** The written figure and the computed figure are
  shown **side by side with the difference named**. There is no auto-fix, no pre-selected
  "use the app's number", and no write of any kind. This is the direct consequence of the
  shipped [quick-bill-entry](quick-bill-entry.md) rule that *"the entered amount is
  authoritative and the app never recomputes it"* — Bill Check may **disagree** with the
  paper out loud, but never **overrule** it.
- **The trader may be right and the app wrong** (paldari, a verbal discount, a deliberate
  round-off). `check-accept-paper` is therefore as prominent as the verdict itself, and
  pressing it must not nag again for that photo.
- Low confidence is surfaced, not hidden: any field the model flags below the confidence
  threshold renders amber with a tap-to-correct affordance, and the verdict is held at
  `'incomplete'` while an **amount-bearing** field is still unreadable.
- **Never trust the model's JSON.** Every response is parsed through a strict validator
  (`lib/billcheck/parse.ts`) that coerces, range-checks and rejects. A malformed, truncated
  or hallucinated-shape response is a clean typed error, never a rendered `NaN`.
- The photo is downscaled to **max 1600 px on the long edge, JPEG q0.82** before upload — a
  12 MP Android photo is otherwise ~5 MB of someone's mobile data per bill, and the extra
  pixels buy no accuracy.
- Bilingual throughout (Hindi default), big touch targets, mobile portrait — unchanged
  Phase-1 discipline.

## Security posture — recorded decision
The key ships **in the client bundle** as `NEXT_PUBLIC_GEMINI_API_KEY`, which makes it
**publicly readable by anyone who views the deployed JavaScript**. This was chosen
deliberately over a key-holding proxy to avoid standing up a new deploy surface for the
pilot. See [architecture.md § Bill Check](../architecture.md#bill-check-phase-13--frozen)
for the full trade-off, the required mitigations (an AI-Studio key restricted by HTTP
referrer, a hard quota cap, and a key used for nothing else), and the migration path to a
Cloudflare Worker proxy before any wider release.

## Success Criteria
- [ ] Home shows `bill-check-btn`; it routes to `/bills/check`. The bill list, `new-bill-btn`,
      the Phase-12 rollup surfaces and the bottom nav are **unchanged**.
- [ ] With `NEXT_PUBLIC_GEMINI_API_KEY` unset, `/bills/check` renders `check-unconfigured`
      with a bilingual explanation — and **no crash, no blank screen, no console throw**.
- [ ] Choosing a photo renders `check-photo-preview` before any network call; `check-read-btn`
      is disabled until a photo exists.
- [ ] `verify.test.ts` (pure, no network): a clean bill verifies `verdict: 'ok'` with both
      diffs `0`; a line whose written amount is ₹13.32 above `rate × net` yields that exact
      `lineDiff` and `mathDiff`; a correct-lines/wrong-addition bill yields `mathDiff: 0`
      with a non-zero `additionDiff` (the two diffs proven **independent**); a missing
      `paperTotal` yields `additionDiff: null`, never `0`; `net` clamps at 0; `paldari` is
      subtracted once and only once; `verdict: 'incomplete'` when an amount-bearing field is
      unreadable.
- [ ] `parse.test.ts` (pure, fixture JSON — **no API key, no network**): a well-formed
      response parses; a truncated response, a non-numeric rate, a null amount, a missing
      `lines` array, an empty `lines` array, extra unexpected keys, and numbers arriving as
      strings each produce the documented typed outcome and **never** a rendered `NaN`.
- [ ] `pnpm build` type-checks every new i18n key in **both** EN and HI (a missing HI key
      fails the build, per the `Record<TKey, string>` typing).
- [ ] E2E `bill-check.spec.ts` — the full screen path with the **Gemini HTTP call
      intercepted by `page.route`**, so the real parse → verify → render path is exercised
      with **zero real API calls and no test-only hooks in production code**: upload a
      fixture image → stubbed response → `check-result` shows one `check-line-row` per grain
      → `check-verdict` names the exact rupee difference → tap an amber `check-cell-unsure`,
      correct it, and the verdict **re-computes locally with no second network request**
      (asserted by request count) → `check-accept-paper` dismisses the verdict.
- [ ] E2E also covers the failure paths: a 500 from the API, a malformed-JSON 200, and
      `context.setOffline(true)` each produce their own distinct visible `check-error`
      message, with the photo retained and the read retryable.
- [ ] Every shipped spec still passes untouched — in particular `pilot-readiness.spec.ts`
      (home surfaces) and `quick-bill-journey.spec.ts` (the entry contract this capability
      must not disturb).
