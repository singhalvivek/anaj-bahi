# Capability: Payments & Outstanding Balance — DEFERRED (Phase 2)

_Target phase: **Phase 2** · slice-b (UI) + slice-a (data). Payment shape modelled now in [data.md](../data.md)._

## What It Does
Records any number of partial payments against a bill (amount + date) and shows paid-to-date and outstanding balance.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| payment | { amount, date, note? } | Payment entry form | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| payment record | Payment | Bill.payments in IndexedDB |
| balance | { paid, outstanding } | Bill detail display |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| IndexedDB (Dexie) | append payment, recompute balance | Visible error; no partial write |

## Business Rules
- `paid = Σ payments.amount`; `outstanding = billTotal − paid`.
- Payments are always addable (even after the bill locks — see [bill-edit-lock](bill-edit-lock.md)).
- History shows each payment's amount + date.

## Success Criteria
- [ ] Adding payments reduces outstanding by the exact amount.
- [ ] Payment history lists each payment with its date.
- [ ] Balance is correct across multiple partial payments.
