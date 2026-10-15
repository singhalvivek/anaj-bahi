# Capabilities Index — Anaj Bahi

One file per capability. Phase 1 delivers the full local purchase-capture journey; later phases are modelled now and built per the [roadmap](../roadmap.md).

## Phase 1 — Local purchase capture (built)

| Capability | File | Slice |
|-----------|------|-------|
| Create Bill | [create-bill.md](create-bill.md) | b + a |
| Sack-by-Sack Weight Entry | [sack-by-sack-entry.md](sack-by-sack-entry.md) | b |
| Deductions & Totals Calculation | [deductions-and-totals-calc.md](deductions-and-totals-calc.md) | a |
| Farmer Autocomplete | [farmer-autocomplete.md](farmer-autocomplete.md) | b + a |
| Bill List & Reopen | [bill-list-and-reopen.md](bill-list-and-reopen.md) | c + a |
| Bilingual Hindi/English Toggle | [i18n-toggle.md](i18n-toggle.md) | a + c |
| Installable PWA Shell | [pwa-shell.md](pwa-shell.md) | c |

## Phase 2 — Payments & finding bills (deferred)

| Capability | File |
|-----------|------|
| Payments & Outstanding Balance | [payments.md](payments.md) |
| Due / Outstanding List | [due-list.md](due-list.md) |
| Bill Edit-Lock Rule | [bill-edit-lock.md](bill-edit-lock.md) |
| Search & Filter Bills | [search-filters.md](search-filters.md) |

## Phase 3 — Shareable image receipt (deferred)

| Capability | File |
|-----------|------|
| Business Profile | [business-profile.md](business-profile.md) |
| Receipt Render | [receipt-render.md](receipt-render.md) |
| Share Receipt as Image | [share-as-image.md](share-as-image.md) |

## Phase 4 — Cloud sync & backup (⚠️ SHIPPED, then SUPERSEDED / removed in Phase 7)

| Capability | File | Status |
|-----------|------|--------|
| Cloud Sync | [cloud-sync.md](cloud-sync.md) | REPLACED-BY-Firestore |
| Offline Queue | [offline-queue.md](offline-queue.md) | REPLACED-BY-Firestore |
| Backup & Restore | [backup-restore.md](backup-restore.md) | REPLACED-BY-Firestore |

## Phase 5 — Quick-entry (summary) bills

| Capability | File | Slice |
|-----------|------|-------|
| Quick-Entry (Summary) Bills | [quick-bill-entry.md](quick-bill-entry.md) | a (data + calc) + b (chooser + quick form) + c (summary detail + receipt) |

---

## Firebase multi-tenant redesign (Phases 6–9)

> Anaj Bahi becomes **multi-tenant, multi-user**: many businesses, each with owners, **partners (co-owners)**, and employees sharing one ledger. Firebase Auth (**Google sign-in**) + Cloud Firestore replace the retired FastAPI backend. Still **no AI/LLM** — see [../agent.md](../agent.md).

### Phase 6 — Auth + role + business spine (the smallest first-time-right win)

| Capability | File | Slice |
|-----------|------|-------|
| Google Sign-In | [google-auth.md](google-auth.md) | a (lib) + b (login UI) + c (gate) |
| First-Run Name & Onboarding-Path Chooser | [first-run-role-chooser.md](first-run-role-chooser.md) | a (pure decision) + b (onboarding UI) |
| Business Tenancy (create + join-by-code) | [business-tenancy.md](business-tenancy.md) | a (tenancy lib) + b (create/join-by-code UI) |

### Phase 7 — Firestore shared store, offline persistence, migration; remove old backend

| Capability | File |
|-----------|------|
| Firestore Shared Store (offline-persistent data layer) | [firestore-store.md](firestore-store.md) |

### Phase 8 — Attribution, employee management, profiles, Security Rules

| Capability | File |
|-----------|------|
| Member Management (owner/partner adds/removes; partner role) | [employee-management.md](employee-management.md) |
| Personal vs Business Profile | [personal-profile.md](personal-profile.md) |
| (per-action attribution snapshots on bills/payments — see [firestore-store](firestore-store.md) / [data.md](../data.md)) | — |

### Phase 9 — Owner-only activity log + hardened rules + cleanup

| Capability | File |
|-----------|------|
| Activity Log (owner/partner audit trail) | [activity-log.md](activity-log.md) |

## Phase 11 — Post-save share prompt (additive UX)

| Capability | File | Slice |
|-----------|------|-------|
| Post-Save Share Prompt | [post-save-share.md](post-save-share.md) | a (single frontend slice) |

## Phase 12 — Pilot readiness (first cross-bill figures + the fast default path)

> The pilot (3–5 real traders, two weeks) needs exactly two things true: **entry is fast**, and **something visible comes back after every entry**. These two capabilities are the smallest set that makes that true. Still no AI/LLM, no backend, offline-first, bilingual, **no schema change**.

| Capability | File | Slice |
|-----------|------|-------|
| Home Rollups (this month · today · not-backed-up) | [home-rollups.md](home-rollups.md) | a (pure rollup + Indian-format helpers + unsynced count) + b (home surfaces + `/rollup` drill-down) |
| Entry Defaults (quick-first chooser · mandatory due date) | [entry-defaults.md](entry-defaults.md) | a (queries/repo extension + i18n) + c (chooser, both entry forms, Due screen, E2E) |

**Why two capability files and not one:** they share the phase goal but nothing else. The rollups are **derived-read + display** (their failure mode is a wrong number that destroys trust in every number); the entry defaults are **write-path + validation** (their failure mode is a blocked or mis-defaulted save). Disjoint surfaces, disjoint success criteria, disjoint slices — so each generator owns exactly one capability file.

## Phase 13 — Bill Check (photo → read → verify)

> The first capability that works **with** the paper instead of replacing it: photograph a bill already written by hand, have an LLM **read** it, and have the app's own pure `lib/calc` **check the arithmetic**. Entry speed was the measured pilot blocker (~45s practised vs a <30s target), and this sidesteps typing entirely. **Nothing is saved** — no bill, no farmer, no write — so it cannot corrupt a ledger. Additive, frontend-only, bilingual; the project's first external API call and only LLM call.

| Capability | File | Slice |
|-----------|------|-------|
| Bill Check (photo → read → verify) | [bill-check.md](bill-check.md) | a (pure verify + parse + prompt + i18n) + b (image downscale + the single `fetch`) + c (screen, components, home button, E2E) |

**Why the LLM is confined to reading:** every rupee is computed by `lib/calc`, not by the model — see [bill-check.md § The LLM is eyes only](bill-check.md) and [../agent.md](../agent.md). This keeps the figures deterministic and hand-checkable, keeps the whole verify path unit-testable with no API key, and makes a corrected digit re-verify locally with no second network call.

## Notes

- This project uses **no agent framework** — no graph, no agent loop, no tools, no multi-turn. Phases 1–12 had **no LLM at all**; Phase 13 adds exactly **one stateless vision call** on **one screen**, for handwriting transcription only. See [../agent.md](../agent.md).
- Adding a new capability: create `<name>.md` here, update this index, and touch architecture/data/roadmap only if affected.
