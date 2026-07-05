# Capability: Offline Queue — DEFERRED (Phase 4)

_Target phase: **Phase 4** · slice-b (frontend)._

## What It Does
Records local mutations in an IndexedDB outbox while offline and flushes them to the sync backend automatically on reconnect.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| mutation | { entity, id, op, updatedAt } | repo writes | yes |
| online event | browser event | `navigator.onLine` / `online` | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| queued mutations | outbox rows | IndexedDB |
| flush result | pushed batch | sync engine |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Sync engine | flush outbox on reconnect | Retain in outbox; retry with backoff |

## Business Rules
- Every repo write also appends to the outbox.
- On `online`, flush in order; clear entries only on server ack.
- Idempotent by record id + `updatedAt`.

## Success Criteria
- [ ] Mutations made offline persist in the outbox.
- [ ] Reconnecting flushes them automatically.
- [ ] A failed flush leaves entries queued for retry.
