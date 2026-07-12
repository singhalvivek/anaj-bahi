// Repository — the only public API over the shared, business-scoped store.
// Phase 7: re-pointed from Dexie/IndexedDB to Cloud Firestore. The exported
// function NAMES and SHAPES are FROZEN (architecture.md § Firestore-backed repo
// contract) so `lib/calc` and every bill-form/detail/receipt component survive
// unchanged — they were already `Promise`-returning callers.
//
// Business scope is AMBIENT: `AuthProvider` calls `setActiveBusiness(bizId)` when
// status becomes `ready` (and `setActiveBusiness(null)` on sign-out), so callers
// like `listBills()` need no bizId argument. All docs live under
// `businesses/{activeBizId}/{farmers,grainTypes,bills}`.
//
// Local-first: Firestore `persistentLocalCache` IS the store. `setDoc`/`updateDoc`
// resolve against the local cache instantly — even fully offline — and auto-sync on
// reconnect. We NEVER await connectivity; there is no separate outbox.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromCache,
  getDocsFromCache,
  setDoc,
  updateDoc,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
  type Firestore,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase/app'
import { type Farmer, type GrainType, type Bill, type Payment } from './schema'
import { buildSeedGrainTypes, GRAIN_SEEDS } from './seed'

export type { Farmer, GrainType, Bill, StoredGrainLine, StoredDeduction, Payment } from './schema'

/**
 * Thrown when purchase data is edited on a bill that already has a payment.
 * The edit-lock is derived from data (`payments.length > 0`), not a stored flag,
 * so it can never drift. Payments are still addable via `addPayment`.
 */
export class BillLockedError extends Error {
  constructor(billId: string) {
    super(`Bill ${billId} is locked: a payment was recorded, purchase details cannot be changed.`)
    this.name = 'BillLockedError'
  }
}

/** Thrown when a payment is added to a bill id that does not exist. */
export class BillNotFoundError extends Error {
  constructor(billId: string) {
    super(`Bill ${billId} not found.`)
    this.name = 'BillNotFoundError'
  }
}

function now(): number {
  return Date.now()
}

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Issue a LOCAL-FIRST Firestore write. Firestore applies the mutation to the local
 * cache synchronously (so `onSnapshot` listeners and the next cache read see it at
 * once) and auto-syncs on reconnect. We do NOT await the returned promise: it only
 * resolves once the BACKEND acknowledges, so awaiting it would hang the UI offline.
 * A `.catch` keeps an eventual server rejection from becoming an unhandled reject.
 */
function fireWrite(p: Promise<unknown>): void {
  p.catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[firestore] write failed to sync', err)
  })
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * LOCAL-FIRST single-doc read: serve from the local cache first (instant, and
 * offline-safe — it never round-trips). `getDocFromCache` rejects when the doc is
 * not cached; in that case we go to the default source ONLY when online, and treat
 * an uncached doc as absent when offline (so a read — e.g. a bill-id collision check
 * — never blocks the UI waiting for the network). `onSnapshot` hooks keep the cache warm.
 */
async function readDoc(ref: DocumentReference): Promise<DocumentSnapshot | null> {
  try {
    return await getDocFromCache(ref)
  } catch {
    if (isOffline()) return null
    return getDoc(ref)
  }
}

/**
 * LOCAL-FIRST collection read: cached docs first; if the cache is empty, fetch from
 * the server only when online, else return the (empty) cache. Never hangs offline.
 */
async function readDocs(q: Query): Promise<QuerySnapshot> {
  const cached = await getDocsFromCache(q)
  if (!cached.empty) return cached
  if (isOffline()) return cached
  return getDocs(q)
}

// ---------- active business (ambient scope) ----------

let activeBizId: string | null = null

/** Set (or clear) the ambient business scope. Called by `AuthProvider`. */
export function setActiveBusiness(bizId: string | null): void {
  activeBizId = bizId
}

/** Read the ambient business scope (used by the sync-status helpers). */
export function getActiveBusiness(): string | null {
  return activeBizId
}

/** Guard: every imperative call requires an active business. */
function requireBizId(): string {
  if (!activeBizId) {
    throw new Error(
      'No active business set. setActiveBusiness(bizId) must be called (by AuthProvider on ready) before using the repo.',
    )
  }
  return activeBizId
}

const dbRef: Firestore = firestore

function farmersCol(bizId: string) {
  return collection(dbRef, 'businesses', bizId, 'farmers')
}
function grainTypesCol(bizId: string) {
  return collection(dbRef, 'businesses', bizId, 'grainTypes')
}
function billsCol(bizId: string) {
  return collection(dbRef, 'businesses', bizId, 'bills')
}

// The bill id is `DDMMYY/xxxxx`, which contains a `/` — illegal in a single
// Firestore doc-id path segment (a `/` would split it into a subcollection path).
// We store each bill under a SANITIZED doc id (`/` → `_`) while keeping the
// ORIGINAL `bill.id` (`DDMMYY/xxxxx`) verbatim in the doc DATA. Every lookup
// (getBill/updateBill/addPayment) sanitizes the same way to locate the doc.
function billDocId(billId: string): string {
  return billId.replace(/\//g, '_')
}
function billDoc(bizId: string, billId: string) {
  return doc(dbRef, 'businesses', bizId, 'bills', billDocId(billId))
}

// ---------- farmers ----------

export async function listFarmers(): Promise<Farmer[]> {
  const bizId = requireBizId()
  const snap = await readDocs(farmersCol(bizId))
  const farmers = snap.docs.map((d) => d.data() as Farmer)
  // Name ascending (locale-insensitive to mirror Dexie's orderBy('name')).
  return farmers.sort((a, b) => a.name.localeCompare(b.name))
}

/** Name prefix search, case-insensitive. Empty/blank prefix → all farmers. */
export async function searchFarmers(prefix: string): Promise<Farmer[]> {
  const p = prefix.trim().toLowerCase()
  if (p === '') return listFarmers()
  const all = await listFarmers()
  return all.filter((f) => f.name.toLowerCase().startsWith(p))
}

export async function getFarmer(id: string): Promise<Farmer | undefined> {
  const bizId = requireBizId()
  const snap = await readDoc(doc(farmersCol(bizId), id))
  return snap && snap.exists() ? (snap.data() as Farmer) : undefined
}

export async function upsertFarmer(
  input: Omit<Farmer, 'id' | 'createdAt'> & { id?: string },
): Promise<Farmer> {
  const bizId = requireBizId()
  if (input.id) {
    const existing = await getFarmer(input.id)
    if (existing) {
      const updated: Farmer = {
        ...existing,
        name: input.name,
        place: input.place,
        phone: input.phone,
      }
      fireWrite(setDoc(doc(farmersCol(bizId), updated.id), updated))
      return updated
    }
  }
  const farmer: Farmer = {
    id: input.id ?? newId(),
    name: input.name,
    place: input.place,
    phone: input.phone,
    createdAt: now(),
  }
  fireWrite(setDoc(doc(farmersCol(bizId), farmer.id), farmer))
  return farmer
}

// ---------- grain types ----------

export async function listGrainTypes(): Promise<GrainType[]> {
  const bizId = requireBizId()
  const snap = await readDocs(grainTypesCol(bizId))
  const grains = snap.docs.map((d) => d.data() as GrainType)
  return grains.sort((a, b) => a.createdAt - b.createdAt)
}

export async function addCustomGrainType(nameEn: string, nameHi: string): Promise<GrainType> {
  const bizId = requireBizId()
  const grain: GrainType = {
    id: newId(),
    nameEn,
    nameHi,
    isCustom: 1,
    createdAt: now(),
  }
  fireWrite(setDoc(doc(grainTypesCol(bizId), grain.id), grain))
  return grain
}

/**
 * Seed the starter grain list once into `businesses/{bizId}/grainTypes`; safe to
 * call on every launch (idempotent). Checks which seed ids already exist and only
 * writes the missing ones.
 */
export async function ensureSeeded(): Promise<void> {
  const bizId = requireBizId()
  const snap = await readDocs(grainTypesCol(bizId))
  const presentIds = new Set(snap.docs.map((d) => d.id))
  const missing = buildSeedGrainTypes(now()).filter((g) => !presentIds.has(g.id))
  // Local-first: fire each seed write without awaiting server ack.
  missing.forEach((g) => fireWrite(setDoc(doc(grainTypesCol(bizId), g.id), g)))
  // Reference GRAIN_SEEDS to keep the import meaningful (ids derive from it).
  void GRAIN_SEEDS
}

// ---------- bills ----------

export async function createBill(input: Omit<Bill, 'createdAt' | 'updatedAt'>): Promise<Bill> {
  const bizId = requireBizId()
  const ts = now()
  const bill: Bill = { ...input, createdAt: ts, updatedAt: ts }
  // Sanitized doc id; ORIGINAL bill.id kept verbatim in the doc data. Local-first.
  fireWrite(setDoc(billDoc(bizId, bill.id), bill))
  return bill
}

export async function getBill(id: string): Promise<Bill | undefined> {
  const bizId = requireBizId()
  const snap = await readDoc(billDoc(bizId, id))
  return snap && snap.exists() ? (snap.data() as Bill) : undefined
}

/** All bills, newest first (by createdAt descending). */
export async function listBills(): Promise<Bill[]> {
  const bizId = requireBizId()
  const snap = await readDocs(billsCol(bizId))
  const bills = snap.docs.map((d) => d.data() as Bill)
  return bills.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Persist edits to a bill's purchase data (farmer, lines, dueDate, …).
 *
 * Edit-lock invariant (Phase 2): if the STORED bill already has any payment,
 * its purchase data is frozen — this throws `BillLockedError`. The check reads
 * the stored bill (not the caller-supplied one) so a caller cannot bypass the
 * lock by sending `payments: []`. Payments are added only via `addPayment`,
 * which keeps this invariant clean. Editable (no-payment) bills persist as before,
 * including an optional `dueDate`.
 */
export async function updateBill(bill: Bill): Promise<Bill> {
  const bizId = requireBizId()
  const existing = await getBill(bill.id)
  if (existing && existing.payments.length > 0) {
    throw new BillLockedError(bill.id)
  }
  const updated: Bill = { ...bill, updatedAt: now() }
  fireWrite(setDoc(billDoc(bizId, updated.id), updated))
  return updated
}

/**
 * Append a payment to a bill's embedded `payments[]` and bump `updatedAt`.
 * ALWAYS allowed — even once the bill is locked for purchase edits. Recompute
 * balance by reading the returned bill through `billBalance` in lib/calc.
 */
export async function addPayment(
  billId: string,
  payment: Omit<Payment, 'id' | 'createdAt'> & { id?: string },
): Promise<Bill> {
  const bizId = requireBizId()
  const bill = await getBill(billId)
  if (!bill) throw new BillNotFoundError(billId)
  const record: Payment = {
    id: payment.id ?? newId(),
    amount: payment.amount,
    date: payment.date,
    ...(payment.note !== undefined ? { note: payment.note } : {}),
    createdAt: now(),
  }
  const updated: Bill = {
    ...bill,
    payments: [...bill.payments, record],
    updatedAt: now(),
  }
  fireWrite(
    updateDoc(billDoc(bizId, billId), {
      payments: updated.payments,
      updatedAt: updated.updatedAt,
    }),
  )
  return updated
}
