# Capability: Receipt Render — DEFERRED (Phase 3)

_Target phase: **Phase 3** · slice-b._

## What It Does
Renders a bill as a clean, bilingual on-screen receipt: business header, full sack-by-sack breakdown per grain, per-grain amounts, and bill total.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| bill | Bill | IndexedDB | yes |
| profile | business profile | [business-profile](business-profile.md) | yes |
| lang | 'hi' \| 'en' | i18n context | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| receipt node | rendered DOM | Screen (input to share) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| (none — render only) | — | — |

## Business Rules
- Shows header (shop + phone), each grain with every sack weight in entry order, gross/deductions/net, per-grain amount, and the bill total.
- Language follows the current toggle; amounts use the same rounding as [data.md](../data.md).

## Success Criteria
- [ ] Receipt lists every sack weight for every grain in order.
- [ ] Per-grain amounts sum to the printed bill total.
- [ ] Renders correctly in both Hindi and English.
