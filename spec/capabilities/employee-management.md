# Capability: Employee Management (owner invites by code / removes)

_Phase 8 · owner-only roster + generate-invite-code by name + mobile; enforced by Security Rules._

Frozen invite helpers: [architecture.md § Invite-code generation](../architecture.md#invite-code-generation--libtenancyinvitets-generation-is-pure--unit-tested).

## What It Does
Lets an **Owner** manage who shares the business ledger: **generate a one-time invite code** for a new employee (by name + mobile), see and re-share **pending** (unclaimed) invites or **cancel** them, and see the **claimed member roster** and **remove** a member. Employees cannot see or use this screen.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| employee name label | string | `employee-name-input` | yes (generate) |
| employee mobile | string (E.164) | `employee-phone-input` | yes (generate) |
| cancel target | invite `code` | pending-invite `cancel-invite-btn` | yes (cancel) |
| remove target | member uid + phone | roster `remove-employee-btn` | yes (remove) |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| invite | `invites/{code}` (`role: employee`, `status: unused`, `assignedPhone`/`phoneKey`, owner's `displayName` label) | Firestore |
| shown code | 6-char code, displayed **large** to copy + share out-of-band | Employees screen |
| cancelled invite | `invites/{code}` deleted | Firestore |
| removed member | `businesses/{bizId}/members/{uid}` deleted | Firestore |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firestore `createInvite(owner, bizId, name, phoneE164)` | write `invites/{code}` (random code, retry on collision) | Visible error; owner can retry |
| Firestore `listPendingInvites(bizId)` | read `invites` where `status == 'unused'` for this business | Visible error; retry |
| Firestore `cancelInvite(code)` | delete an unused invite (owner only) | Rules reject non-owner; visible error |
| Firestore `listMembers(bizId)` / `removeEmployee(bizId, member)` | read claimed roster / delete `members/{uid}` | Rules reject non-owner writes; UI hides the screen from employees |

## Business Rules
- **Owner-only, enforced server-side** — the screen, code generation, cancel, and remove are restricted to owners by UI **and Security Rules**: only an **owner** may `create`/`delete`/`list` a business's `invites` (invites `get`-by-id stays open so an employee can read their one secret code pre-membership, but **`list`/enumerate is owner-only** — no signed-in user can enumerate another business's invites), and the `members` create rule only admits a self-created employee doc when it references a **matching unused invite** (`bizId` + `phoneKey`). See [architecture § Security Rules](../architecture.md#security-rules--hardened-invites--members-model-code-generator-edits-firestorerules).
- **Generate code** creates `invites/{code}` with a random **6-uppercase-char, ambiguity-safe** code (alphabet excludes `O/0/I/1`), `status: 'unused'`, the employee's mobile as `assignedPhone`/`phoneKey`, and the owner's label as `displayName`. The owner sees the code large, copies it, and shares **code + mobile** with the employee out-of-band. The employee redeems it via [JoinByCode](business-tenancy.md).
- The **name label** is a snapshot; once the employee sets their own display name on sign-in, attribution uses the employee's own name for their actions.
- **Pending invites** (`status: 'unused'`) are listed with the code visible for re-sharing and a **cancel** action; the **claimed roster** (`businesses/{bizId}/members`) lists active members as today.
- **Remove** deletes the member doc; Security Rules then reject the removed person's reads/writes. On that person's next load their client detects they are no longer a member and clears their own `users/{uid}.bizId`, returning them to onboarding (see [architecture § removal-safety](../architecture.md#auth--session-contract--libauth)). Their **past attribution snapshots remain** (history stays truthful).
- **One person → one business** still holds — a user already in a business can never redeem a code (they never reach JoinByCode). An invite whose mobile belongs to someone already in a business simply stays `unused`/never claimable by them.
- Multiple owners allowed; an owner invites employees only (promoting to owner is out of scope for this phase).

## Success Criteria
- [ ] An owner generates an invite by name + mobile; the 6-char code appears large to copy, and `invites/{code}` exists with `status:'unused'` and the correct `phoneKey`.
- [ ] That code + mobile, entered by an employee on sign-in, joins the business and shares the ledger; the invite flips to `claimed`.
- [ ] The owner sees pending (unclaimed) invites with their codes and can **cancel** one (the `invites/{code}` is deleted and can no longer be redeemed).
- [ ] An owner removes a claimed member; the removed account loses read/write access (Rules reject), verified against the Firestore emulator.
- [ ] An **employee** cannot open the employees screen and any direct `invites`/`members` write is rejected by Rules.
- [ ] Removing a member leaves their past bill/activity attribution snapshots intact.
