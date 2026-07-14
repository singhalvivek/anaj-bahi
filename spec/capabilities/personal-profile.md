# Capability: Personal Profile (display name) vs Business Profile

_Phase 8 · Settings split + owner-only business profile + attribution snapshots._

## What It Does
Splits Settings into a **personal profile** (the user's own **display name** — editable — their **mobile number** (editable, profile/verification data only), their read-only Google **email** identity, and language) and the existing **business profile** (shop/trader/phone/address), which becomes **owner-only editable** (employees see it read-only). The display name feeds **per-action attribution** on bills/payments/activity.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| display name | string (non-blank) | `personal-name-input` | yes |
| mobile number | string (E.164) | `personal-mobile-input` | optional (profile data) |
| business profile | `{ shopName, traderName, phone, address? }` | `business-profile` form | owner only |
| current role | `owner \| employee` | `useAuth()` | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| updated display name | string | `users/{uid}.displayName` (+ future name snapshots) |
| updated mobile | string | `users/{uid}.phone` (profile data only) |
| updated business profile | fields | `businesses/{bizId}` (owner write) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firestore `users/{uid}` | update displayName / mobile | Visible error; retry |
| Firestore `businesses/{bizId}` | update profile (owner only) | Rules reject a non-owner write (defense-in-depth); UI also disables the form for employees |

## Business Rules
- **Personal profile** is always editable by the user (their own name and mobile). **Identity is the Google account** (`uid` + `email`) — the **email is shown read-only**; the mobile is ordinary editable profile/verification data, **not** an auth factor.
- **Business profile** is **owner-only editable**; employees see the same fields **disabled** with an "only an owner can edit" note. Enforced by **Firestore Security Rules** (not just the UI).
- Renaming yourself updates future attribution; **past** attribution keeps its **snapshot** (unchanged), so history stays truthful.
- The old `SyncSettings` base-URL/token box is gone (removed Phase 7); Settings now shows the personal + business sections (+ the sync-status/"Sync now" indicator).

## Success Criteria
- [ ] A user edits their display name and it persists; their attribution on new actions shows the new name.
- [ ] A user edits their mobile number and it persists to `users/{uid}.phone` (profile data; sign-in is unaffected).
- [ ] An **owner** can edit the business profile and it saves; an **employee** sees it read-only (form disabled) and any direct write is rejected by Rules.
- [ ] The user's Google **email** is shown read-only in the personal profile.
- [ ] Past activity/bill attribution snapshots are unaffected by a later rename.
