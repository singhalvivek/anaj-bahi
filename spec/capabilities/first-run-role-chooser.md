# Capability: First-Run Name & Onboarding-Path Chooser

_Phase 6 · slice-a (pure `lib/auth/membership` route + `lib/tenancy/invite` check + wiring) + slice-b (onboarding UI)._

Frozen routing + invite logic: [architecture.md § Role routing + invite logic](../architecture.md#role-routing--invite-logic--libauthmembershipts-pure-unit-tested).

## What It Does
Guides a **genuinely new** signed-in user (one whose `users/{uid}.bizId` is not yet set) through first-run onboarding: capture a **display name** (prefilled from the Google account, editable), then choose **"New business"** or **"Business already registered"**, and route to the correct next step. Onboarding is **role-free** — it never mentions "owner", "partner", or "employee"; the joiner's role is decided by the invite, not by them. Returning users are recognized upstream by `users/{uid}.bizId` and **never see this chooser**.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| display name | string (non-blank; prefilled from Google) | `name-input` | yes |
| onboarding-path choice | `'create' \| 'join'` (**New business** / **Business already registered**) | `choose-new-business` / `choose-existing-business` | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| route | `create` (New business → becomes owner) \| `join` (Business already registered → role from invite) | drives the next onboarding screen |
| displayName | string | `users/{uid}.displayName` (+ name snapshots) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firestore `users/{uid}` | persist display name | Visible error; retry |

_(The role chooser itself no longer reads any phone→business lookup — recognition of returning users happens before onboarding via `users/{uid}.bizId`.)_

## Business Rules
- **`routeOnboarding(choice)`** is pure and unit-tested: `'create'` → `create` (go to create-business; the creator becomes **owner**), `'join'` → `join` (go to JoinByCode; the joiner's role — **employee** or **partner** — comes from the redeemed invite, not this choice). No membership lookup — one-person-one-business is enforced upstream (a user with a `bizId` never reaches onboarding).
- **Role-free wording:** the two buttons read **"New business"** and **"Business already registered"** — neither the word "owner", "partner", nor "employee" appears anywhere in onboarding. The role a joiner receives is set by the invite the owner/partner generated for them.
- Display name defaults to the Google `displayName` and is editable; it is stored as a **snapshot** with attribution so it survives later renames/removal.
- Returning users (a `users/{uid}` with a `bizId`) **skip the chooser entirely** and go straight into the app — on any device, because the `uid` is stable per Google account.
- The old **"ask your owner"** dead-end screen is **removed**; choosing **Business already registered** leads to the actionable **JoinByCode** flow (enter code + mobile + name). See [business-tenancy](business-tenancy.md).

## Success Criteria
- [ ] A brand-new Google account is prompted for a name (required, non-blank, **prefilled** from Google) before the onboarding-path choice.
- [ ] The two onboarding buttons read **"New business"** and **"Business already registered"** — no "owner"/"partner"/"employee" wording appears anywhere in onboarding.
- [ ] Choosing **New business** routes to **create-business** (`create`) and the creator lands as **owner**.
- [ ] Choosing **Business already registered** routes to the **JoinByCode** screen (`join`), never a dead-end "ask your owner" screen; the joiner's role is taken from the invite (employee or partner).
- [ ] A Google account already tied to a business is routed **straight into that business** on sign-in and never sees the chooser (one-person-one-business).
- [ ] `routeOnboarding` unit tests cover both branches; the invite-check logic (`checkInvite`) is unit-tested for `ok` / `not-found` / `phone-mismatch`.
