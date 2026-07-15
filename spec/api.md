# API — Anaj Bahi

---

## API Style

**Phase 1–3: NO HTTP API.** The app is entirely local (offline-first). The UI calls an in-app **TypeScript data-access module** (`lib/db/repo`) directly against IndexedDB — there is no server, no REST/GraphQL, no keys, no `.env`. The internal module interface is the "API" for these phases; it is frozen in [architecture.md § Phase-1 module contract](architecture.md#phase-1-module-contract-slice-a) and detailed in [data.md](data.md). The signatures are:

- Farmers: `listFarmers`, `searchFarmers(prefix)`, `getFarmer(id)`, `upsertFarmer(input)`
- Grain types: `listGrainTypes`, `addCustomGrainType(nameEn, nameHi)`, `ensureSeeded()`
- Bills: `createBill(input)`, `getBill(id)`, `listBills()`, `updateBill(bill)`
- Ids: `generateBillId(date, exists)`
- Calc (pure): `resolveDeductionKg`, `computeGrainLine`, `computeBillTotal`, `roundRupees`

**Phase 4** introduced a REST **sync** service (**FastAPI + SQLite**) — **now ⚠️ SUPERSEDED / REMOVED in Phase 7** (see below).

**Phases 6–9 (Firebase era):** there is **still no REST/GraphQL/CLI API we author** and no server we run. The "API" is the **Firebase client SDK surface** the PWA calls directly — **Firebase Auth (Google sign-in)** and **Cloud Firestore** — governed by **Firestore Security Rules** (there is no application server to enforce auth; the Rules do). See [§ Firebase client SDK surface](#firebase-client-sdk-surface-phases-69) below and the frozen [architecture.md § Firebase multi-tenant redesign](architecture.md#firebase-multi-tenant-redesign-phases-69--frozen-contracts).

---

## Firebase client SDK surface (Phases 6–9)

No HTTP endpoints we define — the client talks to Firebase directly. The authoritative shapes/signatures (auth/session context, membership-decision function, tenancy helpers, Firestore-backed repo, collection paths) are frozen in [architecture.md § Firebase multi-tenant redesign](architecture.md#firebase-multi-tenant-redesign-phases-69--frozen-contracts). Summary:

### Firebase Auth (Google sign-in)
- `signInWithPopup(auth, new GoogleAuthProvider())` completes sign-in. Persistence **LOCAL** (stays signed-in until explicit sign-out). Identity = the Firebase **`uid`** (stable per Google account, cross-device). **No reCAPTCHA, no SMS, no OTP, no Blaze plan** (free on Spark). Google supplies `displayName` + `email`; mobile is captured at onboarding as profile data only.
- Wrapped by `lib/auth/session.ts` + the `AuthProvider`/`useAuth` context (`signInWithGoogle`, `setDisplayName`, `chooseOnboardingPath`, `createOwnerBusiness`, `joinByCode`, `signOut`).
- **Testing:** the **Auth + Firestore emulators** (via `firebase.json`; `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=1`). Google sign-in is simulated by the Auth emulator's test-IdP popup — no real Google account, no external network.

### Cloud Firestore (direct client reads/writes)
- Business-scoped collections `businesses/{bizId}/{bills|farmers|grainTypes|activity|members}`, plus top-level `users/{uid}` and `invites/{code}` (the manager-generated invite carrying `role: 'employee' | 'partner'`). Paths frozen in architecture.md.
- Reads are **live** (`onSnapshot`); writes save offline (IndexedDB persistence) and auto-sync on reconnect. Accessed via the Firestore-backed `lib/db/repo` (same function names as Phases 1–5) and `lib/tenancy/business.ts`.
- **Auth/authorization is enforced by Firestore Security Rules** with three roles (`owner | partner | employee`): **owner-only** business-profile writes; **manager (owner-or-partner)** invite create/list/delete, non-owner member removal, and activity read; member-scoped ledger access. Rules are authored in Phase 8 and hardened in Phase 9.

## ~~Phase 4 — Sync API~~ — ⚠️ SUPERSEDED (removed in Phase 7)

> **Historical.** This REST contract is **replaced by the Firebase surface above** and its code (`backend/`, `frontend/src/lib/sync/*`, `SyncSettings`) is **removed in Phase 7**. Kept only as the Phases-1–5 record.

Small push/pull backup service on **FastAPI + SQLite**, authenticated by a per-device bearer token (`Authorization: Bearer <DEVICE_TOKEN>`; missing/wrong → 401). Bills merge **last-write-wins by `updatedAt`**; farmers/grain-types upsert-by-id; profile is a singleton. Push is idempotent. No base-path prefix — endpoints are at the root. Full detail (storage model, `lib/sync` frontend API): [architecture.md § Phase-4 sync contract](architecture.md#phase-4-sync-contract).

### `GET /health` (no auth)

**Response:** `{ "status": "ok" }`

### `POST /sync/push` (Bearer)

**Purpose:** upload the full local snapshot (farmers, bills incl. embedded lines **and payments**, custom grain types, business profile).

**Request:**
```json
{
  "bills":      [ { "id": "…", "updatedAt": 0, "…": "…" } ],
  "farmers":    [ { "id": "…", "…": "…" } ],
  "grainTypes": [ { "id": "…", "…": "…" } ],
  "profile":    { "…": "…" }
}
```
(`profile` may be `null`.)

**Response:**
```json
{ "ok": true, "counts": { "bills": 12, "farmers": 4, "grainTypes": 2, "profile": 1 } }
```

### `GET /sync/pull` (Bearer)

**Purpose:** download all data for the device (used by restore on a new device).

**Response:**
```json
{ "bills": [], "farmers": [], "grainTypes": [], "profile": null }
```

**Error cases:**
| Status | Condition |
|--------|-----------|
| 401 | Missing/invalid device bearer token (all `/sync/*`) |
| 400 | Malformed payload |
| 500 | Internal / DB error |

## Authentication

- **Phases 1–3:** none — no server.
- **Phase 4 (superseded):** a per-device **bearer token** via `Authorization: Bearer <token>`.
- **Phases 6–9 (current):** **Firebase Authentication — phone number + SMS OTP** (E.164 identity, LOCAL persistence). No passwords, no bearer token to enter — the user is identified by their phone. Authorization (who may read/write which business data, across the three roles **owner / partner / employee**) is enforced by **Firestore Security Rules**, not by application code. Config is 6 **public** `NEXT_PUBLIC_FIREBASE_*` values in `frontend/.env.local`; the only real secret is the E2E `FIREBASE_SERVICE_ACCOUNT` used by the test global-setup. See [architecture.md § Commands](architecture.md#firebase-env--commands-phase-6-cwd-frontend).
