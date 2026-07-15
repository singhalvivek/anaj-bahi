# Capability: Member Management (owner/partner invites by code / removes)

_Phase 8 · owner-or-partner roster + generate-invite-code by mobile **with a role picker**; enforced by Security Rules._

Frozen invite helpers: [architecture.md § Invite-code generation](../architecture.md#invite-code-generation--libtenancyinvitets-generation-is-pure--unit-tested).

## What It Does
Lets an **Owner or a Partner** manage who shares the business ledger: **generate a one-time invite code** for a new member (by **mobile + a chosen role — Employee or Partner**; the member's name is captured from their own Google login when they claim the code), see and re-share **pending** (unclaimed) invites or **cancel** them, and see the **claimed member roster** and **remove** members subject to the removal matrix below. **Employees cannot see or use this screen.** This roster is the **only place in the app where roles are surfaced** (Owner / Partner / Employee badges).

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| member mobile | string (E.164) | `employee-mobile-input` | yes (generate) |
| invite role | `'employee' \| 'partner'` | role picker `invite-role-select` | yes (generate) |
| cancel target | invite `code` | pending-invite `cancel-invite-btn` | yes (cancel) |
| remove target | member uid + phone + role | roster `remove-employee-btn` | yes (remove) |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| invite | `invites/{code}` (`role: 'employee' \| 'partner'` from the picker, `status: unused`, `assignedPhone`/`phoneKey`, blank `displayName` — set at claim) | Firestore |
| shown code | 6-char code, displayed **large** to copy + share out-of-band | Members screen |
| cancelled invite | `invites/{code}` deleted | Firestore |
| removed member | `businesses/{bizId}/members/{uid}` deleted | Firestore |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firestore `createInvite(actor, bizId, phoneE164, role)` | write `invites/{code}` (random code, retry on collision) with the chosen `role` | Visible error; the actor can retry |
| Firestore `listPendingInvites(bizId)` | read `invites` where `status == 'unused'` for this business | Visible error; retry |
| Firestore `cancelInvite(code)` | delete an unused invite (owner or partner) | Rules reject a non-manager; visible error |
| Firestore `listMembers(bizId)` / `removeMember(bizId, member)` | read claimed roster / delete `members/{uid}` (target must not be an owner) | Rules reject a non-manager write and any owner-removal; UI hides the screen from employees |

## Business Rules
- **Owner-OR-partner, enforced server-side** — the screen, code generation, cancel, and remove are restricted to **managers (owner or partner)** by UI **and Security Rules**. A `canManage(bizId)` helper (owner-or-partner) gates `create`/`delete`/`list` of a business's `invites` (invites `get`-by-id stays open so a member can read their one secret code pre-membership, but **`list`/enumerate is manager-only** — no signed-in user can enumerate another business's invites), and the `members` create rule admits a self-created **employee _or_ partner** doc only when it references a **matching unused invite** whose `role` equals the member doc's `role` (`bizId` + `phoneKey` + `status: 'unused'`). See [architecture § Security Rules](../architecture.md#security-rules--hardened-invites--members-model-code-generator-edits-firestorerules).
- **Role picker at invite time** — when adding a member the manager enters a **mobile** AND picks a **role: Employee or Partner**. `createInvite` writes that `role` onto `invites/{code}` (validated by Rules to be `'employee'` or `'partner'`). A **partner** created this way gains manager powers on claim.
- **Partner powers = "same as owner, minus removing an owner"** (locked scope):
  - CAN: add members (employees **and** partners) by generating invite codes; view **all** activity; remove **employees and other partners**.
  - CANNOT: remove or downgrade an **owner** (a partner can never remove an owner); edit the **business profile** (that stays owner-only — see the scope boundary below).
  - There is **no self-serve partner onboarding** — a partner exists only because an existing owner or partner invited them with the Partner role.
- **Removal matrix** (enforced by Rules, not just UI): a manager may delete a `members/{uid}` doc only when the **target's role is not `owner`**. So an **owner** removes employees and partners; a **partner** removes employees and other partners; **no one removes an owner** through the roster (owners are not removable — owner-to-owner removal stays out of scope, unchanged). No one removes themselves.
- **Scope boundary (explicit):** partner parity with owner is limited to **managing the member roster** (add/remove per the matrix) + **reading all activity**. Editing the business profile / any `businesses/{bizId}` document write stays **owner-only** — a partner sees the business profile read-only exactly like an employee (see [personal-profile](personal-profile.md)).
- **Generate code** creates `invites/{code}` with a random **6-uppercase-char, ambiguity-safe** code (alphabet excludes `O/0/I/1`), `status: 'unused'`, the member's mobile as `assignedPhone`/`phoneKey`, the picked `role`, and a **blank `displayName`**. The manager sees the code large, copies it, and shares **code + mobile** with the new member out-of-band. The member redeems it via [JoinByCode](business-tenancy.md).
- **The member's name is NOT collected by the manager** — it is captured from the member's Google login (prefilled, editable) when they claim the code, and written to `members/{uid}.displayName` + `users/{uid}` by `claimInvite`. Pending invites therefore show the **mobile + role** (not a name) until claimed.
- **Pending invites** (`status: 'unused'`) are listed with the code + assigned role visible for re-sharing and a **cancel** action; the **claimed roster** (`businesses/{bizId}/members`) lists active members with an **Owner / Partner / Employee** badge each.
- **Roles are surfaced ONLY here** — the Owner/Partner/Employee badges appear only in this roster, which only managers reach. No role tag appears in the Settings identity strip or the personal profile for anyone (see [personal-profile](personal-profile.md)).
- **Remove** deletes the member doc; Security Rules then reject the removed person's reads/writes. On that person's next load their client detects they are no longer a member and clears their own `users/{uid}.bizId`, returning them to onboarding (see [architecture § removal-safety](../architecture.md#auth--session-contract--libauth)). Their **past attribution snapshots remain** (history stays truthful).
- **One person → one business** still holds — a user already in a business can never redeem a code (they never reach JoinByCode). An invite whose mobile belongs to someone already in a business simply stays `unused`/never claimable by them.

## Success Criteria
- [ ] A **manager (owner or partner)** generates an invite by mobile alone plus a **role pick (Employee / Partner)**; the 6-char code appears large to copy, and `invites/{code}` exists with `status:'unused'`, the correct `phoneKey`, and the picked `role`.
- [ ] That code + mobile, entered by the invited person on sign-in, joins the business with the **invite's role** (employee or partner) and shares the ledger; the invite flips to `claimed`.
- [ ] A **partner** can open the Members screen, generate an invite (for an employee **and** for a partner), and the invited person joins with the correct role.
- [ ] A **partner removes an employee** and **removes another partner** — both deletions succeed (verified against the Firestore emulator).
- [ ] A **partner cannot remove an owner** — the owner has no Remove control in the roster and any direct `members/{ownerUid}` delete by a partner is rejected by Rules.
- [ ] An **owner removes a partner** — the deletion succeeds.
- [ ] A manager sees pending (unclaimed) invites with their codes **and assigned role** and can **cancel** one (the `invites/{code}` is deleted and can no longer be redeemed).
- [ ] The roster shows an **Owner / Partner / Employee** badge per member; this is the **only** screen in the app that shows a role tag.
- [ ] An **employee** cannot open the Members screen and any direct `invites`/`members` write is rejected by Rules.
- [ ] Removing a member leaves their past bill/activity attribution snapshots intact.
