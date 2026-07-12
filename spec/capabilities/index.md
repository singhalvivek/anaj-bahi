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
| Due-Soon / Overdue List | [due-list.md](due-list.md) |
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

> Anaj Bahi becomes **multi-tenant, multi-user**: many businesses, each with owners + employees sharing one ledger. Firebase Auth (phone/OTP) + Cloud Firestore replace the retired FastAPI backend. Still **no AI/LLM** — see [../agent.md](../agent.md).

### Phase 6 — Auth + role + business spine (the smallest first-time-right win)

| Capability | File | Slice |
|-----------|------|-------|
| Phone Sign-In (SMS OTP) | [phone-auth.md](phone-auth.md) | a (lib) + b (login UI) + c (gate) |
| First-Run Name & Role Chooser | [first-run-role-chooser.md](first-run-role-chooser.md) | a (pure decision) + b (onboarding UI) |
| Business Tenancy (create + membership) | [business-tenancy.md](business-tenancy.md) | a (tenancy lib) + b (create/ask-owner UI) |

### Phase 7 — Firestore shared store, offline persistence, migration; remove old backend

| Capability | File |
|-----------|------|
| Firestore Shared Store (offline-persistent data layer) | [firestore-store.md](firestore-store.md) |

### Phase 8 — Attribution, employee management, profiles, Security Rules

| Capability | File |
|-----------|------|
| Employee Management (owner adds/removes) | [employee-management.md](employee-management.md) |
| Personal vs Business Profile | [personal-profile.md](personal-profile.md) |
| (per-action attribution snapshots on bills/payments — see [firestore-store](firestore-store.md) / [data.md](../data.md)) | — |

### Phase 9 — Owner-only activity log + hardened rules + cleanup

| Capability | File |
|-----------|------|
| Activity Log (owner-only audit trail) | [activity-log.md](activity-log.md) |

## Notes

- This project uses **no agent framework / no LLM** — see [../agent.md](../agent.md). The Firebase redesign does not change this.
- Adding a new capability: create `<name>.md` here, update this index, and touch architecture/data/roadmap only if affected.
