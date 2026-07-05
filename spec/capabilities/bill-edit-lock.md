# Capability: Bill Edit-Lock Rule — DEFERRED (Phase 2)

_Target phase: **Phase 2** · slice-a (rule) + slice-b/c (UI enforcement)._

## What It Does
Keeps a bill fully editable while it has no payments; once any payment is recorded, purchase data locks (payments can still be added).

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| bill | Bill | IndexedDB | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| editable flag | boolean (`payments.length === 0`) | Detail/edit UI |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| (none — derived) | — | — |

## Business Rules
- Editable iff `payments.length === 0`.
- Once locked, farmer/lines/sacks/deductions/price cannot change; only payments may be added.
- In Phase 1 all bills are editable (no payments exist yet).

## Success Criteria
- [ ] Editing is allowed before any payment.
- [ ] After the first payment, edit controls are disabled but Add-payment remains.
- [ ] The lock is derived from data, not a separate flag (no drift).
