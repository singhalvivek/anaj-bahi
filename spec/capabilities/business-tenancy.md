# Capability: Business Tenancy (create business + membership)

_Phase 6 · slice-a (`lib/tenancy/business.ts` + wiring) + slice-b (owner create-business / employee ask-owner UI)._

Frozen tenancy helpers + collection paths: [architecture.md § Tenancy write helpers](../architecture.md#tenancy-write-helpers--libtenancybusinessts) and [§ Firestore data model](../architecture.md#firestore-data-model--frozen-collection-path-map).

## What It Does
Establishes the multi-tenant spine: an **Owner** self-serve **creates a new business** (a Firestore tenant with themselves as owner), and an **Employee** whose phone an owner already added **joins** that same business. Guarantees **one person → one business**, all business data **scoped under `businesses/{bizId}`**.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| new-business profile | `{ shopName, traderName, phone?, address? }` | create-business form | yes (shopName) |
| signed-in user | `AppUser` (uid + phone + displayName) | `useAuth()` | yes |
| target bizId (employee join) | string | matched `memberships/{phoneKey}` | yes (join only) |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| business doc | `businesses/{bizId}` (profile + createdBy snapshot) | Firestore |
| owner/employee member | `businesses/{bizId}/members/{uid}` (`active`) | Firestore |
| membership lookup | `memberships/{phoneKey}` (role, status, bizId, uid) | Firestore |
| user record | `users/{uid}` (`bizId`, `role`) | Firestore |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firestore `createBusiness(owner, input)` | write business + members + memberships + users (one logical unit) | Visible error; stay on the form; no partial "half-created" business is left navigable (the user record's `bizId` is set **last**, so onboarding only completes when all writes land) |
| Firestore `claimEmployeeMembership(user, bizId)` | set uid/active on membership, write member + users | Visible error; retry; membership stays `invited` until claimed |
| Firestore `findMembershipByPhone(phone)` | lookup by phoneKey | Visible error; retry |

## Business Rules
- **phoneKey** = E.164 without the leading `+` (`+911111111111` → `911111111111`) — the Firestore doc id for the phone→business lookup.
- Creating a business writes the owner's own `memberships/{phoneKey}` (`role: owner`, `status: active`, `uid` set) so a returning owner is recognised on any device.
- An employee **join** claims the pre-existing **`invited`** membership (owner added the phone earlier) → sets `uid`, `status: active`, `claimedAt`.
- **One person → one business:** a phone with an existing membership can never create a second business (the [membership decision](first-run-role-chooser.md) blocks it before this capability is reached).
- Multiple **owners** per business are allowed; all members share the business's ledger.
- Attribution: `createdByName`/`displayName` are **snapshots** at write time.

## Success Criteria
- [ ] An Owner creates a business (shop name required) and immediately lands in the app as **owner** of that business; `businesses/{bizId}`, its `members/{uid}`, `memberships/{phoneKey}`, and `users/{uid}` are all written.
- [ ] Signing the same owner in again (even a fresh browser) routes **straight into their business** via `users/{uid}` / `memberships/{phoneKey}` — no re-onboarding.
- [ ] An Employee whose phone was pre-added joins the **same** business and lands in the app as **employee**.
- [ ] A phone already tied to a business cannot create a second business (one-person-one-business).
- [ ] All ledger data written after onboarding lives under `businesses/{bizId}/…` (business-scoped), never at a global path.
