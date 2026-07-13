# Capability: First-Run Name & Role Chooser

_Phase 6 · slice-a (pure `lib/auth/membership` route + `lib/tenancy/invite` check + wiring) + slice-b (onboarding UI)._

Frozen routing + invite logic: [architecture.md § Role routing + invite logic](../architecture.md#role-routing--invite-logic--libauthmembershipts-pure-unit-tested).

## What It Does
Guides a **genuinely new** signed-in user (one whose `users/{uid}.bizId` is not yet set) through first-run onboarding: capture a **display name** (prefilled from the Google account, editable), then choose **"I am an Owner"** or **"I am an Employee"**, and route to the correct next step. Returning users are recognized upstream by `users/{uid}.bizId` and **never see this chooser**.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| display name | string (non-blank; prefilled from Google) | `name-input` | yes |
| role choice | `'owner' \| 'employee'` | `role-owner` / `role-employee` | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| route | `create` (owner) \| `join` (employee) | drives the next onboarding screen |
| displayName | string | `users/{uid}.displayName` (+ name snapshots) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firestore `users/{uid}` | persist display name | Visible error; retry |

_(The role chooser itself no longer reads any phone→business lookup — recognition of returning users happens before onboarding via `users/{uid}.bizId`.)_

## Business Rules
- **`routeRole(chosenRole)`** is pure and unit-tested: `'owner'` → `create` (go to create-business), `'employee'` → `join` (go to JoinByCode). No membership lookup — one-person-one-business is enforced upstream (a user with a `bizId` never reaches onboarding).
- Display name defaults to the Google `displayName` and is editable; it is stored as a **snapshot** with attribution so it survives later renames/removal.
- Returning users (a `users/{uid}` with a `bizId`) **skip the chooser entirely** and go straight into the app — on any device, because the `uid` is stable per Google account.
- The old **"ask your owner"** dead-end screen is **removed**; choosing Employee now leads to the actionable **JoinByCode** flow (enter code + mobile + name). See [business-tenancy](business-tenancy.md).

## Success Criteria
- [ ] A brand-new Google account is prompted for a name (required, non-blank, **prefilled** from Google) before the role choice.
- [ ] Choosing **Owner** routes to **create-business** (`create`).
- [ ] Choosing **Employee** routes to the **JoinByCode** screen (`join`), never a dead-end "ask your owner" screen.
- [ ] A Google account already tied to a business is routed **straight into that business** on sign-in and never sees the chooser (one-person-one-business).
- [ ] `routeRole` unit tests cover both branches; the invite-check logic (`checkInvite`) is unit-tested for `ok` / `not-found` / `phone-mismatch`.
