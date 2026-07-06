// Snapshot <-> local store bridge. `collectSnapshot` reads ALL local data out of
// Dexie for a push; `applySnapshot` writes a pulled snapshot back INTO Dexie for a
// restore. Both go through the existing repo/profile layers and the shared `db`
// instance — no new IndexedDB access patterns are introduced.
//
// RESTORE is idempotent and last-write-wins: applying a snapshot upserts by `id`,
// and an incoming bill only replaces a local bill when its `updatedAt` is >= the
// local one, so a restore can never downgrade a newer local edit or duplicate a row.

import { db, type Bill } from '@/lib/db/schema'
import { listBills, listFarmers, listGrainTypes } from '@/lib/db/repo'
import { getProfile, saveProfile } from '@/lib/settings/profile'
import type { SyncSnapshot } from './client'

/** Read the full local device state (bills w/ embedded payments, farmers, grain types, profile). */
export async function collectSnapshot(): Promise<SyncSnapshot> {
  const [bills, farmers, grainTypes, profile] = await Promise.all([
    listBills(),
    listFarmers(),
    listGrainTypes(),
    getProfile(),
  ])
  return { bills, farmers, grainTypes, profile }
}

/**
 * Write a pulled snapshot into the local store (RESTORE).
 *
 * - Farmers & grain types: bulkPut (upsert by id, incoming wins — they have no
 *   `updatedAt`, matching the backend merge rule).
 * - Bills: last-write-wins by `updatedAt` so a restore never downgrades a bill that
 *   was edited more recently on THIS device than in the cloud copy.
 * - Profile: saved via the profile layer (a `null` profile is a no-op, never wipes
 *   an existing local profile).
 *
 * Idempotent: applying the same snapshot twice yields exactly one row per id.
 */
export async function applySnapshot(snap: SyncSnapshot): Promise<void> {
  if (snap.farmers.length > 0) {
    await db.farmers.bulkPut(snap.farmers)
  }
  if (snap.grainTypes.length > 0) {
    await db.grainTypes.bulkPut(snap.grainTypes)
  }

  if (snap.bills.length > 0) {
    const ids = snap.bills.map((b) => b.id)
    const existing = await db.bills.bulkGet(ids)
    const localById = new Map<string, Bill>()
    existing.forEach((b) => {
      if (b) localById.set(b.id, b)
    })
    const toWrite = snap.bills.filter((incoming) => {
      const local = localById.get(incoming.id)
      // Keep the local bill only when it is strictly newer than the incoming one.
      return !local || incoming.updatedAt >= local.updatedAt
    })
    if (toWrite.length > 0) {
      await db.bills.bulkPut(toWrite)
    }
  }

  if (snap.profile !== null) {
    await saveProfile(snap.profile)
  }
}
