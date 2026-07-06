# API — Anaj Bahi

---

## API Style

**Phase 1–3: NO HTTP API.** The app is entirely local (offline-first). The UI calls an in-app **TypeScript data-access module** (`lib/db/repo`) directly against IndexedDB — there is no server, no REST/GraphQL, no keys, no `.env`. The internal module interface is the "API" for these phases; it is frozen in [architecture.md § Phase-1 module contract](architecture.md#phase-1-module-contract-slice-a) and detailed in [data.md](data.md). The signatures are:

- Farmers: `listFarmers`, `searchFarmers(prefix)`, `getFarmer(id)`, `upsertFarmer(input)`
- Grain types: `listGrainTypes`, `addCustomGrainType(nameEn, nameHi)`, `ensureSeeded()`
- Bills: `createBill(input)`, `getBill(id)`, `listBills()`, `updateBill(bill)`
- Ids: `generateBillId(date, exists)`
- Calc (pure): `resolveDeductionKg`, `computeGrainLine`, `computeBillTotal`, `roundRupees`

**Phase 4** introduces the first and only HTTP API — the personal cloud **sync** service (**FastAPI + SQLite**). Not built until Phase 4. The **frozen, authoritative** wire contract (auth, endpoints, request/response shapes, storage model, and the frontend `lib/sync` API) lives in **[architecture.md § Phase-4 sync contract](architecture.md#phase-4-sync-contract)** — the summary below mirrors it; on any discrepancy, the architecture section wins.

---

## Phase 4 — Sync API (frozen; not built yet)

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
- **Phase 4:** a per-device **bearer token** (personal, single user) provided via `Authorization: Bearer <token>`; the token is stored in the device and documented in `backend/.env.example`. This is the first phase that requires secrets/`.env`.
