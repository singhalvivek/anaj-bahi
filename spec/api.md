# API — Anaj Bahi

---

## API Style

**Phase 1–3: NO HTTP API.** The app is entirely local (offline-first). The UI calls an in-app **TypeScript data-access module** (`lib/db/repo`) directly against IndexedDB — there is no server, no REST/GraphQL, no keys, no `.env`. The internal module interface is the "API" for these phases; it is frozen in [architecture.md § Phase-1 module contract](architecture.md#phase-1-module-contract-slice-a) and detailed in [data.md](data.md). The signatures are:

- Farmers: `listFarmers`, `searchFarmers(prefix)`, `getFarmer(id)`, `upsertFarmer(input)`
- Grain types: `listGrainTypes`, `addCustomGrainType(nameEn, nameHi)`, `ensureSeeded()`
- Bills: `createBill(input)`, `getBill(id)`, `listBills()`, `updateBill(bill)`
- Ids: `generateBillId(date, exists)`
- Calc (pure): `resolveDeductionKg`, `computeGrainLine`, `computeBillTotal`, `roundRupees`

**Phase 4** introduces the first and only HTTP API — the personal cloud **sync** service (FastAPI + Postgres). Sketched below; not built until Phase 4.

---

## Phase 4 — Sync API (sketch, not built yet)

Small push/pull backup service, authenticated by a per-device bearer token. Last-write-wins by `updatedAt` per record. Base path e.g. `/api/v1`.

### `POST /api/v1/sync/push`

**Purpose:** upload local mutations (farmers, bills incl. embedded lines/payments, custom grain types) created/edited since the last sync.

**Request:**
```json
{
  "deviceId": "string",
  "since": 0,
  "farmers": [ { "id": "…", "updatedAt": 0, "…": "…" } ],
  "bills":   [ { "id": "…", "updatedAt": 0, "…": "…" } ],
  "grainTypes": [ { "id": "…", "updatedAt": 0, "…": "…" } ]
}
```

**Response:**
```json
{ "data": { "accepted": 12, "serverTime": 0 } }
```

### `GET /api/v1/sync/pull?since=<epoch>`

**Purpose:** download records changed on the server since `since` (for restore on a new device or merge).

**Response:**
```json
{ "data": { "serverTime": 0, "farmers": [], "bills": [], "grainTypes": [] } }
```

**Error cases:**
| Status | Condition |
|--------|-----------|
| 401 | Missing/invalid device bearer token |
| 400 | Malformed payload |
| 409 | (Reserved) conflict beyond last-write-wins policy |
| 500 | Internal / DB error |

## Authentication

- **Phases 1–3:** none — no server.
- **Phase 4:** a per-device **bearer token** (personal, single user) provided via `Authorization: Bearer <token>`; the token is stored in the device and documented in `backend/.env.example`. This is the first phase that requires secrets/`.env`.
