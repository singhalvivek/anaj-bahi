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

## Phase 4 — Cloud sync & backup (deferred)

| Capability | File |
|-----------|------|
| Cloud Sync | [cloud-sync.md](cloud-sync.md) |
| Offline Queue | [offline-queue.md](offline-queue.md) |
| Backup & Restore | [backup-restore.md](backup-restore.md) |

## Notes

- This project uses **no agent framework / no LLM** — see [../agent.md](../agent.md).
- Adding a new capability: create `<name>.md` here, update this index, and touch architecture/data/roadmap only if affected.
