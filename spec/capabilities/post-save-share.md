# Capability: Post-Save Share Prompt — Phase 11

_Target phase: **Phase 11** · one frontend slice._

## What It Does
Immediately after a trader **saves a new bill** (the from-scratch / fresh-sack create flow only — **not** quick entry), offers a **"Share receipt"** action (and a **"Done"** dismiss that goes home) — so sharing no longer requires reopening the bill and tapping Share. Purely additive, back-compatible, frontend-only, offline; **no LLM, no backend, no live/public link**.

## Why
Today both create flows call `router.push('/')` on a successful create and land on the home list; to share, the trader must reopen the bill and tap **Share** on the detail page. Offering the share option right after saving removes that round-trip for the most common next action (sending the farmer his receipt).

## Scope: fresh-sack CREATE only
The prompt appears **only in the from-scratch (fresh sack) flow** (`bills/new`), and **only on its create branch** — the `router.push('/')` after `createBill(...)`. **Quick/summary entry (`bills/quick`) does NOT show the prompt** — a quick bill transcribes a paper bill the farmer already holds, so a save-time receipt is redundant; it keeps its original `router.push('/')`. The **edit** branch (which navigates to `/bill?id=...` after `updateBill`) is **unchanged**: editing an existing bill still returns to the detail screen, no prompt.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| saved bill | `Bill` | the value returned by `createBill(...)` at the call site | yes |
| farmer phone | `string?` | the create form's resolved farmer (`farmer.phone`) | no |
| grainName resolver | `(id: string) => string` | built from the page's `grainTypes` state + current `lang` (mirrors the detail page) | yes |
| business profile | `BusinessProfile` | `getProfile()` (via `useLiveQuery`), inside the reused share sheet | yes (loaded by the sheet) |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| PNG image | File/Blob | `navigator.share({ files })` (or download fallback) — via `shareReceiptImage` |
| navigation | route change | `/` (home) on **Done** (or after a completed share, the trader taps Done) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| html-to-image (`shareReceiptImage`) | DOM → PNG | surface `t('share.error')` in the sheet (unchanged behavior) |
| `navigator.share` | share image file | fall back to PNG download + `t('share.unsupported')` note (unchanged behavior) |

No network is introduced. `getProfile()` reads local `meta`; rasterise + share are client-side. **Works fully offline.**

## Reuse contract (do NOT invent a new share mechanism)
Reuse the exact current pieces, verified against source:

- **`Receipt`** — `frontend/src/components/receipt/Receipt.tsx`, `React.forwardRef<HTMLDivElement, ReceiptProps>`, props `{ bill: Bill; profile: BusinessProfile; farmerPhone?: string; grainName?: (id: string) => string }`, renders `data-testid="receipt"`. Rendered to a ref, exactly as the detail page does.
- **`shareReceiptImage(node: HTMLElement, filename: string): Promise<ShareResult>`** — `frontend/src/lib/share/shareImage.ts`, `ShareResult = 'shared' | 'downloaded'` (html-to-image → PNG → `navigator.share({ files })`, download fallback, AbortError treated as `'shared'`). Filename mirrors the detail page: `receipt-${bill.id.replace(/\//g, '-')}.png`.
- **`getProfile(): Promise<BusinessProfile>`** — `frontend/src/lib/settings/profile.ts` (normalises to safe defaults, so the receipt header never blanks). Loaded via `useLiveQuery(() => getProfile(), [])` inside the share sheet, as `SharePanel` does today.
- **grainName resolver** — built the same way the detail page builds it: find the grain type in `grainTypes` and return `lang === 'hi' ? g.nameHi : g.nameEn`, falling back to the raw id.
- **farmer phone** — the create form already holds the resolved farmer (`farmer` state, non-null past the save guard); pass `farmer.phone`.
- **saved bill** — capture the `Bill` returned by `createBill(...)`: change `await createBill({...})` to `const saved = await createBill({...})` and feed `saved` to the prompt instead of navigating immediately.

## DRY component decision
Extract the receipt-preview + share body from the detail page's `SharePanel` into a **reusable controlled sheet** and have BOTH the detail page and the new post-save prompt consume it:

- **`frontend/src/components/receipt/ReceiptShareSheet.tsx`** (new, extracted) — a controlled bottom-sheet with props `{ bill: Bill; farmerPhone?: string; grainName: (id: string) => string; open: boolean; onClose: () => void }`. It owns the profile load (`useLiveQuery(getProfile)`), the `<Receipt ref>` preview, the rasterise/share button, and the fallback/error messaging. It **preserves the existing testids byte-for-byte**: `receipt-preview`, `receipt`, `share-image`, `share-close`, `share-fallback`, `share-error`, and the existing i18n keys (`share.preview`, `share.button`, `share.generating`, `share.unsupported`, `share.error`, `share.close`).
- **`SharePanel`** (in `frontend/src/app/bill/page.tsx`) is refactored to render its **unchanged** `share-receipt` trigger button + this extracted sheet. **The in-bill Share button/flow on the detail page MUST remain identical in behavior and DOM** — this is proven by keeping `frontend/tests/e2e/receipt-share.spec.ts` green **unchanged**.
- **`frontend/src/components/receipt/PostSaveSharePrompt.tsx`** (new) — props `{ bill: Bill; farmerPhone?: string; grainName: (id: string) => string; onDone: () => void }`. Renders the bottom-sheet `post-save-share-sheet` (same visual language as `SharePanel`'s sheet, positioned below the sticky top bar) with a **"Share receipt"** button (`post-save-share-btn`, opens the embedded `ReceiptShareSheet`) and a **"Done"** button (`post-save-done-btn`, calls `onDone`). It consumes `ReceiptShareSheet` for the actual preview + rasterise + share.

> If, in implementation, extracting `ReceiptShareSheet` is judged to risk the frozen detail behavior, the acceptable fallback is a focused **new** component that reuses `Receipt` + `shareReceiptImage` + `getProfile` directly (no change to `SharePanel`). Either way, the detail-page Share flow stays byte-for-byte and `receipt-share.spec.ts` stays green unchanged.

## Call-site integration (fresh-sack create flow only)
- **`frontend/src/app/bills/new/page.tsx`** (sack flow; `handleSave` ~253–344): in the **create** branch (~322–335) capture `const saved = await createBill({...})`; instead of `router.push('/')` (~335), set state (e.g. `setSavedBill(saved)`) so the page renders `<PostSaveSharePrompt bill={savedBill} farmerPhone={farmer?.phone} grainName={grainName} onDone={() => router.push('/')} />`.
- **`frontend/src/app/bills/quick/page.tsx`** (summary flow) is **unchanged** — it keeps its original `router.push('/')` on create; no prompt.
- The `bills/new` page already holds `grainTypes` state and `useI18n()` (for `lang`) to build the resolver, and `farmer` state for the phone.

## Bilingual keys (EN + HI, type-enforced)
Add paired keys to `frontend/src/lib/i18n/dictionary.ts`. The HI object is `Record<TKey, string>` (`TKey = keyof typeof EN`), so **every new EN key requires its HI counterpart or the build fails**:

| Key | EN (example) | HI (example) |
|-----|--------------|--------------|
| `postsave.title` | Bill saved | बही सहेज ली गई |
| `postsave.share` | Share receipt | रसीद साझा करें |
| `postsave.done` | Done | हो गया |

(Reuse the existing `share.*` keys inside `ReceiptShareSheet`; the only new keys are the three `postsave.*` above. Any additional label added during build must also be paired.)

## Business Rules
- The prompt appears **only after a successful create** (not on validation failure, not on save error, not on edit).
- **Done** navigates to `/` — the same destination as today; the trader's flow is never worse than before.
- Rasterisation/share/fallback semantics are **exactly** those of `shareReceiptImage` (no reimplementation).
- Receipt language and content follow the current toggle and the calc engine, unchanged.
- Offline: no network dependency added; the whole prompt + share works in airplane mode.

## Testids (see [ui.md](../ui.md))
- `post-save-share-sheet` — the post-save bottom-sheet container.
- `post-save-share-btn` — the "Share receipt" action (opens the receipt preview / share sheet).
- `post-save-done-btn` — the "Done" dismiss (navigates home).
- Reused inside the preview: `receipt-preview`, `receipt`, `share-image`, `share-close`, `share-fallback`, `share-error`.

## Success Criteria
- [ ] After saving a **new sack bill**, the `post-save-share-sheet` appears (the page does not jump straight to home).
- [ ] After saving a **new quick/summary bill**, **no** prompt appears — it lands on the home list as before.
- [ ] Tapping **Share receipt** opens the receipt preview and `share-image` rasterises a PNG `File` handed to `navigator.share` (stubbed in E2E), with the download fallback + `share-fallback` note when native share is unsupported.
- [ ] Tapping **Done** navigates to `/`.
- [ ] The **detail-page** Share button/flow is unchanged in behavior/DOM/testids. `frontend/tests/e2e/receipt-share.spec.ts` needs only a small edit because its bill-creation helpers use the **fresh-sack** flow (which now shows the prompt): they tap `post-save-done-btn` after save; the detail-page share assertions themselves are unchanged.
- [ ] Every new EN i18n key has an HI counterpart (build type-checks).
- [ ] The whole prompt + share path works offline (no new network call).

## Explicitly OUT OF SCOPE (do not build)
- No live/public share **link**, no public read page, no share **token**.
- No **Firestore Security-Rules** changes.
- No **finalize/lock** field.
- No **WhatsApp-direct** button.
- The existing **in-bill Share button** on the detail page stays exactly as-is.
