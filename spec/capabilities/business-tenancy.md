# Capability: Business Tenancy (create business + join by code)

_Phase 6 · slice-a (`lib/tenancy/business.ts` + `lib/tenancy/invite.ts` + wiring) + slice-b (owner create-business / employee join-by-code UI)._

Frozen tenancy helpers + collection paths: [architecture.md § Role routing + invite logic](../architecture.md#role-routing--invite-logic--libauthmembershipts-pure-unit-tested), [§ Tenancy write helpers](../architecture.md#tenancy-write-helpers--libtenancybusinessts), and [§ Firestore data model](../architecture.md#firestore-data-model--frozen-collection-path-map).

## What It Does
Establishes the multi-tenant spine: someone choosing **New business** self-serve **creates a new business** (a Firestore tenant with themselves as **owner**), and an invited member **joins** that business by redeeming a one-time **invite code + mobile**. The joiner's role — **employee** or **partner** — is **carried by the invite** (set by the owner/partner who generated it), not chosen by the joiner. Guarantees **one person → one business** (enforced by the Firebase `uid`), all business data **scoped under `businesses/{bizId}`**.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| new-business profile | `{ shopName, traderName, phone (mobile), address? }` | create-business form | yes (shopName, traderName, mobile) |
| signed-in user | `AppUser` (uid + email + displayName from Google) | `useAuth()` | yes |
| invite code | string (6 uppercase chars) | JoinByCode step 1 | yes (join only) |
| mobile number | string (E.164) | JoinByCode step 2 — must match `invite.phoneKey` | yes (join only) |
| display name | string | JoinByCode step 3 (prefilled from Google) | yes (join only) |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| business doc | `businesses/{bizId}` (profile + createdBy snapshot) | Firestore |
| member doc | `businesses/{bizId}/members/{uid}` (`active`; `role` = `owner` on create, or the **invite's `role`** — `employee`/`partner` — on join) | Firestore |
| claimed invite | `invites/{code}` (`status: claimed`, `claimedByUid`, `claimedAt`) | Firestore (join only) |
| user record | `users/{uid}` (`{ bizId, role, phone, email }`; `role` = `owner` on create, else the invite's `employee`/`partner`) | Firestore |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firestore `createBusiness(owner, input)` | atomic `writeBatch`: business + owner member + `users/{uid}` (one logical unit; **no owner invite doc**) | Visible error; stay on the form; the `users/{uid}.bizId` is written in the same batch, so onboarding only completes when all writes land |
| Local `saveProfile(...)` (after createBusiness) | seed the Dexie `businessProfile` (shopName/traderName/phone) that Settings shop-details + the receipt header read, so the signup shop name shows immediately | Best-effort; a failure never blocks onboarding |
| Firestore `getInvite(code)` + pure `checkInvite` | verify code (exists & unused) then mobile (matches `invite.phoneKey`) | `not-found` → "code invalid/used" error; `phone-mismatch` → a **distinct** "number doesn't match" error; both keep the user on the step to retry |
| Firestore `claimInvite(user, code, phoneE164)` | atomic `writeBatch`: flip invite → claimed, write member, set `users/{uid}` | Visible error; retry; invite stays `unused` until the claim commits |

## Business Rules
- **Identity is the Firebase `uid`.** Creating a business writes only `businesses/{bizId}`, the owner's `members/{uid}` (`owner`, `active`), and `users/{uid}` — **no invite/membership doc for the owner**; the owner's `uid` recognises them on any device via `users/{uid}.bizId`.
- The owner's create form captures **name** (prefilled from Google, editable), **shop name**, and **mobile**; the mobile is stored as business/profile data (`businesses.phone` + `users.phone`), not an auth factor.
- **Join by code:** the invited member redeems the owner/partner-generated **`invites/{code}`** in three steps — enter code (must exist and be `status: 'unused'`), enter mobile (must match `invite.phoneKey`), enter name (prefilled from Google). `claimInvite` then atomically flips the invite to `claimed`, writes `members/{uid}` (attribution copied from the invite, **plus `inviteCode` + `phoneKey`**, and `role` copied from `invite.role`), and sets `users/{uid}.{bizId, role: invite.role, phone, email}` — where `invite.role` is **`employee`** or **`partner`**.
- **Security Rules enforce the claim server-side (not just client-side):** the `members/{uid}` create is allowed only when a **real matching `invites/{inviteCode}`** exists that ties the same `bizId` + `phoneKey` **and the same `role`** (an `employee` invite can only mint an `employee` member, a `partner` invite only a `partner` member) and is still `status: 'unused'`, and the invite `update` allows only the single-use `unused → claimed` transition stamped with the claimer's own uid. The two writes are mutually consistent inside the atomic `writeBatch` because rules see the invite's still-`unused` committed state during the batch. This closes cross-tenant escalation (no self-minted owner/partner/employee membership without a valid invite). See [architecture § Security Rules](../architecture.md#security-rules--hardened-invites--members-model-code-generator-edits-firestorerules).
- **phoneKey** = E.164 without the leading `+` — used only to match the redeemed mobile against the invite, never as an identity key.
- **One person → one business:** a user whose `users/{uid}.bizId` is set is routed straight to the app on sign-in and never re-enters onboarding, so they can never create a second business or redeem a code (see [architecture § one-person-one-business](../architecture.md#firestore-data-model--frozen-collection-path-map)).
- Multiple **owners** per business are allowed; all members share the business's ledger.
- Attribution: `createdByName` / `displayName` / `addedByName` are **snapshots** at write time.

## Success Criteria
- [ ] An Owner signs in with Google, fills name + shop name + mobile, and immediately lands in the app as **owner**; `businesses/{bizId}`, its `members/{uid}`, and `users/{uid}` (with `bizId`, `role:'owner'`, `phone`, `email`) are all written, and **no invite doc** is created for the owner.
- [ ] Signing the same Google account in again (even a fresh browser/device) routes **straight into their business** via `users/{uid}.bizId` — no re-onboarding, no code.
- [ ] An invited member redeems a valid `invites/{code}` whose mobile they enter correctly, joins the **same** business with the **invite's role** (`employee` **or** `partner` — `members/{uid}.role` and `users/{uid}.role` both equal `invite.role`), and the invite flips to `claimed` with `claimedByUid`/`claimedAt` set.
- [ ] A wrong/used code shows the "invalid/used" error; a correct code with a **non-matching mobile** shows the **distinct** "number doesn't match" error.
- [ ] A user already in a business cannot redeem a code (they never reach JoinByCode).
- [ ] All ledger data written after onboarding lives under `businesses/{bizId}/…` (business-scoped), never at a global path.
