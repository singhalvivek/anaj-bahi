# Capability: Google Sign-In

_Phase 6 · slice-a (lib/firebase + lib/auth) + slice-b (login UI) + slice-c (auth gate)._

> **Renamed from `phone-auth.md`.** Firebase phone/SMS-OTP required the paid Blaze plan (`auth/billing-not-enabled`; the "10 free SMS/day" console banner is dead since Sept 2024). Auth is now **Google sign-in**, which is free on the Spark plan. All reCAPTCHA + SMS/OTP plumbing is removed.

Frozen auth/session contract: [architecture.md § Auth / session contract](../architecture.md#auth--session-contract--libauth).

## What It Does
Signs a user in with their **Google account** via Firebase Authentication (`GoogleAuthProvider` + `signInWithPopup`), with **LOCAL persistence** so they stay signed in until an explicit sign-out. **Identity is the Firebase `uid`** — stable per Google account and the same on every device. Google supplies the user's **displayName** and **email**; the email is captured on the user record. There is **no phone/SMS factor and no reCAPTCHA** anywhere in sign-in.

## Inputs
| Input | Type | Source | Required |
|-------|------|--------|----------|
| Google account selection | Google OAuth (popup) | `google-signin-btn` → `signInWithPopup` | yes |
| Firebase web config | 6 `NEXT_PUBLIC_FIREBASE_*` | `frontend/.env.local` | yes |

## Outputs
| Output | Type | Destination |
|--------|------|-------------|
| authenticated session | Firebase user (uid + email + displayName), persisted LOCAL | Firebase Auth / `useAuth()` |
| `users/{uid}` record | `{ uid, email, phone, displayName, bizId, role, … }` | Firestore (created on first sign-in) |

## External Calls
| System | Operation | On Failure |
|--------|-----------|------------|
| Firebase Auth `signInWithPopup(GoogleAuthProvider)` | sign in | Inline bilingual error (popup closed / network / unauthorized-domain); no crash; user can retry |
| Firestore `users/{uid}` | read/create on sign-in | Visible error; sign-in still valid, retry the doc write |

## Business Rules
- Persistence is **`browserLocalPersistence`** — the session survives reloads and app restarts until **Sign out**.
- **Returning users are recognized purely by `users/{uid}.bizId`:** on sign-in, read `users/{uid}` — if it has a `bizId` → `status: 'ready'` (straight into the app); else `status: 'onboarding'`. There is **no phone lookup** at sign-in.
- Because the identity key is the Firebase `uid` (stable per Google account), the same user is recognized on **any device** they sign into with that Google account — no code, no re-onboarding.
- Google provides `displayName` + `email`. The **email** is written to `users/{uid}.email`. The **mobile number** is captured later at onboarding as **profile/verification data only** — it is never an auth or SMS factor.
- **No reCAPTCHA, no `#recaptcha-container`, no SMS, no OTP** — all removed. No Blaze plan needed (Spark tier).
- Web config values are **public** (not secrets); real security is Firestore Security Rules.
- **Console prerequisites (out-of-band, documented in DEPLOY.md):** enable the **Google** provider (with a support email) and add the GitHub Pages host `<username>.github.io` to **Authorized domains**.

## Success Criteria
- [ ] Tapping **Continue with Google** and picking a Google account signs the user in, and the session **persists across a page reload** (no re-sign-in).
- [ ] A brand-new Google account lands in **onboarding**; a returning account whose `users/{uid}.bizId` is set lands **straight in the app** on any device.
- [ ] A dismissed/closed popup or a network error shows an inline bilingual error and lets the user retry without reloading.
- [ ] **Sign out** returns to the Login screen and clears the session.
- [ ] E2E drives the whole flow against the **Firebase Auth emulator** (Google sign-in simulated) — deterministically, with no real Google popup and no external network.
