# Capability: Employee Management (owner adds/removes members)

_Phase 8 · owner-only roster + add/remove by phone + name; enforced by Security Rules._

## What It Does
Lets an **Owner** manage who shares the business ledger: view the member **roster**, **add** an employee by **phone number + name label** (creating an `invited` membership the employee later claims by signing in), and **remove** an employee. Employees cannot see or use this screen.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| employee phone | string (E.164) | `employee-phone-input` | yes |
| employee name label | string | `employee-name-input` | yes |
| remove target | member uid / phoneKey | roster `remove-employee-btn` | yes (remove) |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| invited membership | `memberships/{phoneKey}` (`role: employee`, `status: invited`) | Firestore |
| per-business member | `businesses/{bizId}/members/{uid}` (on claim) | Firestore |
| removed member | membership + member docs deleted | Firestore |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firestore write `memberships/{phoneKey}` + `members/{…}` | add / remove (owner only) | Rules reject non-owner writes; UI hides the screen from employees; visible error on failure |

## Business Rules
- **Owner-only** — the screen and its writes are restricted to owners (UI + **Security Rules**).
- **Add** creates an `invited` membership keyed by the employee's **phoneKey**; when that phone signs in and chooses Employee, the [membership decision](first-run-role-chooser.md) resolves to `employee-joined` and [business-tenancy](business-tenancy.md) claims it.
- The **name label** the owner enters is a snapshot; once the employee sets their own display name on sign-in, attribution uses the employee's own name for their actions.
- **Remove** revokes access (deletes the membership + member doc); the removed person can no longer read/write the business (Rules). Their **past attribution snapshots remain** (history stays truthful).
- One person → one business still holds: adding a phone that already belongs to another business is refused.
- Multiple owners allowed; an owner may add employees only (promoting to owner is out of scope for this phase).

## Success Criteria
- [ ] An owner adds an employee by phone + name; that phone, on sign-in as Employee, joins the business and shares the ledger.
- [ ] An owner removes an employee; the removed phone loses read/write access (Rules reject), verified against real Firestore.
- [ ] An **employee** cannot open the employees screen and any direct membership write is rejected by Rules.
- [ ] Adding a phone already tied to another business is refused.
- [ ] Removing an employee leaves their past bill/activity attribution snapshots intact.
