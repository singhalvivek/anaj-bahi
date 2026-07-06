import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db/schema'
import { createBill, upsertFarmer, addCustomGrainType } from '@/lib/db/repo'
import { saveProfile } from '@/lib/settings/profile'
import { collectSnapshot, applySnapshot } from './snapshot'
import type { SyncSnapshot } from './client'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('collectSnapshot', () => {
  // Happy path — gathers every local table plus the profile.
  it('reads all local bills, farmers, grain types and the profile', async () => {
    await upsertFarmer({ id: 'f1', name: 'Ramesh', place: 'Kheri' })
    await addCustomGrainType('Wheat', 'गेहूँ')
    await saveProfile({ shopName: 'Shop', traderName: 'Ram', phone: '999' })
    await createBill({
      id: 'b1',
      farmerId: 'f1',
      farmerName: 'Ramesh',
      farmerPlace: 'Kheri',
      purchaseDate: '2026-07-06',
      grainTypeIds: ['wheat'],
      lines: [{ id: 'l1', grainTypeId: 'wheat', pricePerQuintal: 2500, sackWeights: [50], deductions: [] }],
      payments: [],
    })

    const snap = await collectSnapshot()
    expect(snap.bills).toHaveLength(1)
    expect(snap.farmers).toHaveLength(1)
    expect(snap.grainTypes).toHaveLength(1)
    expect(snap.profile?.shopName).toBe('Shop')
  })

  // Edge — an empty store yields empty arrays and the default profile (never throws).
  it('returns empty arrays on a fresh store', async () => {
    const snap = await collectSnapshot()
    expect(snap.bills).toEqual([])
    expect(snap.farmers).toEqual([])
    expect(snap.grainTypes).toEqual([])
    expect(snap.profile).not.toBeNull() // getProfile always returns a (default) profile
  })
})

describe('applySnapshot — profile no-op', () => {
  // Error/edge — a null profile in the snapshot must not wipe an existing local profile.
  it('does not clear an existing local profile when the snapshot profile is null', async () => {
    await saveProfile({ shopName: 'Existing', traderName: 'Keep', phone: '1' })
    const snap: SyncSnapshot = { bills: [], farmers: [], grainTypes: [], profile: null }
    await applySnapshot(snap)
    const row = await db.meta.get('businessProfile')
    expect((row?.value as { shopName: string }).shopName).toBe('Existing')
  })
})
