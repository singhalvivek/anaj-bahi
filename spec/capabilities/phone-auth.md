# Capability: Phone Sign-In (SMS OTP)

_Phase 6 · slice-a (lib/firebase + lib/auth) + slice-b (login UI) + slice-c (auth gate)._

Frozen auth/session contract: [architecture.md § Auth / session contract](../architecture.md#auth--session-contract--libauth).

## What It Does
Signs a user in with their **phone number + SMS OTP** via Firebase Authentication (Web SDK, invisible reCAPTCHA, `signInWithPhoneNumber`), with **LOCAL persistence** so they stay signed in until an explicit sign-out. Identity is the phone number in **E.164**.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| phone number | string (E.164, e.g. `+911111111111`) | Login screen `phone-input` | yes |
| OTP code | string (6 digits) | Login screen `otp-input` | yes |
| Firebase web config | 6 `NEXT_PUBLIC_FIREBASE_*` | `frontend/.env.local` | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| authenticated session | Firebase user (uid + phone), persisted LOCAL | Firebase Auth / `useAuth()` |
| `users/{uid}` record | `{ uid, phone, displayName, bizId, role, … }` | Firestore (created on first confirm) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firebase Auth `signInWithPhoneNumber` (invisible reCAPTCHA) | send OTP | Inline bilingual error (invalid number / network); no crash; user can retry |
| `confirmationResult.confirm(code)` | verify OTP | Inline "wrong code" error; input stays; retry |
| Firestore `users/{uid}` | read/create on confirm | Visible error; sign-in still valid, retry the doc write |

## Business Rules
- Persistence is **`browserLocalPersistence`** — the session survives reloads and app restarts until **Sign out**.
- On confirm, read `users/{uid}`: if it has a `bizId` → `status: 'ready'` (straight into the app); else `status: 'onboarding'`.
- **Testing:** Firebase **test phone numbers** (`+911111111111` / fixed `123456`) send no SMS and bypass reCAPTCHA, so E2E and the gate never touch the free-SMS quota.
- Web config values are **public** (not secrets); real security is Firestore Rules.

## Success Criteria
- [ ] Entering a phone number and the SMS code signs the user in and the session **persists across a page reload** (no re-login).
- [ ] A brand-new phone lands in **onboarding**; a returning phone with a business lands **straight in the app**.
- [ ] A wrong OTP shows an inline bilingual error and lets the user retry without reloading.
- [ ] **Sign out** returns to the Login screen and clears the session.
- [ ] E2E drives the whole flow with the **test number** `+911111111111` / `123456` — deterministically, with **no real SMS** and **no reCAPTCHA challenge**.
