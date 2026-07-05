# Capability: PIN Lock — DEFERRED (Phase 2)

_Target phase: **Phase 2** · slice-c (UI) + slice-a (auth lib). Modelled now, built in Phase 2._

## What It Does
Requires a 4-digit PIN set at first run; the app is locked behind it on every open.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| pin (setup) | 4 digits | First-run setup | yes |
| pin (unlock) | 4 digits | Lock screen on launch | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| pin hash | string (salted SHA-256) | IndexedDB `meta` table |
| unlocked session | in-memory flag | App gate |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| WebCrypto | hash + verify PIN | Deny unlock; allow retry |

## Business Rules
- PIN stored hashed (salted SHA-256), never plaintext.
- App content is gated until the correct PIN is entered.
- First run prompts to set + confirm a PIN.

## Success Criteria
- [ ] After setting a PIN, reopening the app requires it.
- [ ] Wrong PIN denies access; correct PIN unlocks.
- [ ] PIN never appears in plaintext in storage.
