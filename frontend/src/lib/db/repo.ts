// Repository — the only public API over Dexie/IndexedDB.
// Signatures are frozen in architecture.md § Phase-1 module contract.

import { db, type Farmer, type GrainType, type Bill } from './schema'
import { buildSeedGrainTypes, GRAIN_SEEDS } from './seed'

export type { Farmer, GrainType, Bill, StoredGrainLine, StoredDeduction, Payment } from './schema'

function now(): number {
  return Date.now()
}

function newId(): string {
  return crypto.randomUUID()
}

// ---------- farmers ----------

export function listFarmers(): Promise<Farmer[]> {
  return db.farmers.orderBy('name').toArray()
}

/** Name prefix search, case-insensitive. Empty/blank prefix → all farmers. */
export async function searchFarmers(prefix: string): Promise<Farmer[]> {
  const p = prefix.trim()
  if (p === '') return listFarmers()
  return db.farmers.where('name').startsWithIgnoreCase(p).toArray()
}

export function getFarmer(id: string): Promise<Farmer | undefined> {
  return db.farmers.get(id)
}

export async function upsertFarmer(
  input: Omit<Farmer, 'id' | 'createdAt'> & { id?: string },
): Promise<Farmer> {
  if (input.id) {
    const existing = await db.farmers.get(input.id)
    if (existing) {
      const updated: Farmer = {
        ...existing,
        name: input.name,
        place: input.place,
        phone: input.phone,
      }
      await db.farmers.put(updated)
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
  await db.farmers.put(farmer)
  return farmer
}

// ---------- grain types ----------

export function listGrainTypes(): Promise<GrainType[]> {
  return db.grainTypes.orderBy('createdAt').toArray()
}

export async function addCustomGrainType(nameEn: string, nameHi: string): Promise<GrainType> {
  const grain: GrainType = {
    id: newId(),
    nameEn,
    nameHi,
    isCustom: 1,
    createdAt: now(),
  }
  await db.grainTypes.put(grain)
  return grain
}

/** Seed the starter grain list once; safe to call on every launch. */
export async function ensureSeeded(): Promise<void> {
  const seedIds = GRAIN_SEEDS.map((s) => s.id)
  const present = await db.grainTypes.where('id').anyOf(seedIds).primaryKeys()
  const presentSet = new Set(present as string[])
  const missing = buildSeedGrainTypes(now()).filter((g) => !presentSet.has(g.id))
  if (missing.length > 0) {
    await db.grainTypes.bulkPut(missing)
  }
}

// ---------- bills ----------

export async function createBill(input: Omit<Bill, 'createdAt' | 'updatedAt'>): Promise<Bill> {
  const ts = now()
  const bill: Bill = { ...input, createdAt: ts, updatedAt: ts }
  await db.bills.put(bill)
  return bill
}

export function getBill(id: string): Promise<Bill | undefined> {
  return db.bills.get(id)
}

/** All bills, newest first (by createdAt descending). */
export function listBills(): Promise<Bill[]> {
  return db.bills.orderBy('createdAt').reverse().toArray()
}

export async function updateBill(bill: Bill): Promise<Bill> {
  const updated: Bill = { ...bill, updatedAt: now() }
  await db.bills.put(updated)
  return updated
}
