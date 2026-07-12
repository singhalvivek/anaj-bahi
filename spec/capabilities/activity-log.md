# Capability: Activity Log (owner-only audit trail)

_Phase 9 · owner-only append-only log + hardened Security Rules._

## What It Does
Records an **append-only** trail of ledger actions — **bill-create, payment, edit/delete** — each stamped with the **actor** (uid + phone + name snapshot) and a timestamp, and shows it to **owners only**. Read access is enforced by **Firestore Security Rules**, not just the UI.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| action event | `{ type, billId?, summary }` | `repo.createBill`/`addPayment`/`updateBill`/delete | yes (written by the mutation) |
| actor | `{ uid, phone, name snapshot }` | `useAuth()` current user | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| activity entry | `businesses/{bizId}/activity/{id}` (append-only) | Firestore |
| owner view | reverse-chronological list | Activity screen (`activity-log`) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firestore create `activity/{id}` | append on each mutation | Best-effort append; the mutation itself must not be blocked/rolled back by a failed log write (log is additive) |
| Firestore read `activity` (owner only) | list for the owner view | Rules reject non-owner reads; UI hides the screen from employees |

## Business Rules
- **Append-only:** entries are **create-only** — no update, no delete (enforced by Rules). The log cannot be edited or scrubbed.
- **Actor name is a snapshot** at the time of the action, so the log stays truthful after renames or removals.
- **Owner-only read** — employees can write actions (which append entries) but **cannot read** the log; enforced by Security Rules (a non-owner reaching the screen sees "owners only", never raw data).
- Every bill-create, payment, and edit/delete appends exactly one entry attributed to the acting member.
- This phase also **finalizes/hardens** the Security Rules for all role boundaries (business profile, membership, ledger, activity) and does end-of-redesign cleanup.

## Success Criteria
- [ ] Creating a bill, recording a payment, and editing/deleting a bill each append one attributed activity entry.
- [ ] An **owner** sees the reverse-chronological log with actor name + action + bill id + time.
- [ ] An **employee** cannot read the activity log — the screen is hidden and a direct read is rejected by Rules (verified against real Firestore).
- [ ] Activity entries cannot be updated or deleted (append-only, enforced by Rules).
- [ ] Attribution snapshots survive a later rename/removal of the actor.
