# Capability: First-Run Name & Role Chooser

_Phase 6 · slice-a (pure `lib/auth/membership` + wiring) + slice-b (onboarding UI)._

Frozen decision logic: [architecture.md § Membership decision logic](../architecture.md#membership-decision-logic--libauthmembershipts).

## What It Does
Guides a newly signed-in phone through first-run onboarding: capture a **display name** (a phone carries no name), then choose **"I am an Owner"** or **"I am an Employee"**, and route to the correct next step using a **pure membership-decision function**.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| display name | string (non-blank) | `display-name-input` | yes |
| role choice | `'owner' \| 'employee'` | `role-owner` / `role-employee` | yes |
| phone→membership lookup | `MembershipLookup \| null` | `memberships/{phoneKey}` (Firestore) | yes (may be null) |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| decision | `owner \| employee-joined \| employee-unadded \| new` | drives the next onboarding screen |
| displayName | string | `users/{uid}.displayName` (+ name snapshots) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firestore `memberships/{phoneKey}` | read lookup on role choice | Visible error; user can retry; never routes on stale/error data |
| Firestore `users/{uid}` | persist display name | Visible error; retry |

## Business Rules
- **`decideMembership(chosenRole, lookup)`** is pure and unit-tested (all four branches):
  - existing **owner** membership → `owner` (enter that business as owner);
  - existing **employee** membership → `employee-joined` (join that business);
  - no membership + chose **owner** → `new` (go to create-business);
  - no membership + chose **employee** → `employee-unadded` (show "ask your owner").
- **An existing membership always wins over the fresh choice** — this enforces **one person → one business** (a phone already tied to a business can't create a second).
- Returning users (a `users/{uid}` with a `bizId`) **skip the chooser** entirely and go straight into the app.
- Display name is stored as a **snapshot** with attribution so it survives later renames/removal.

## Success Criteria
- [ ] A brand-new phone is prompted for a name (required, non-blank) before the role choice.
- [ ] Choosing **Owner** with no prior membership routes to **create-business** (`new`).
- [ ] Choosing **Employee** whose phone an owner **already added** routes to **join** (`employee-joined`) and lands in that business.
- [ ] Choosing **Employee** whose phone is **not** added routes to the **ask-your-owner** screen (`employee-unadded`) with no app access.
- [ ] A phone that already belongs to a business is routed by its **existing** membership regardless of the button tapped (one-person-one-business).
- [ ] `decideMembership` unit tests cover all four branches plus the "existing membership overrides choice" edges.
