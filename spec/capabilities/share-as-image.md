# Capability: Share Receipt as Image — DEFERRED (Phase 3)

_Target phase: **Phase 3** · slice-c._

## What It Does
Captures the rendered receipt to a PNG and shares it via the phone's native share sheet (WhatsApp etc.), with a download fallback.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| receipt node | DOM node | [receipt-render](receipt-render.md) | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| PNG image | File/Blob | `navigator.share` (or download) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| html-to-image | DOM → PNG | Visible error |
| `navigator.share` | share image file | Fall back to download link |

## Business Rules
- Image contains the full receipt (header, all sacks, per-grain amounts, total), in the current language.
- If `navigator.share` (or file share) is unsupported, download the PNG instead.

## Success Criteria
- [ ] Sharing produces a legible PNG matching the on-screen receipt.
- [ ] The native share sheet opens with the image attached (or downloads on fallback).
- [ ] Language of the image follows the current toggle.
