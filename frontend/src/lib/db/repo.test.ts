import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './schema'
import {
  listFarmers,
  searchFarmers,
  getFarmer,
  upsertFarmer,
  listGrainTypes,
  addCustomGrainType,
  ensureSeeded,
  createBill,
  getBill,
  listBills,
  updateBill,
  addPayment,
  BillLockedError,
  BillNotFoundError,
  type Bill,
} from './repo'
import { billBalance } from '@/lib/calc'

// fake-indexeddb/auto is loaded in vitest.setup.ts.

beforeEach(async () => {
  await db.delete()
  await db.open()
})

function sampleBillInput(overrides: Partial<Bill> = {}): Omit<Bill, 'createdAt' | 'updatedAt'> {
  return {
    id: '060726/abc12',
    farmerId: 'farmer-1',
    farmerName: 'Ramesh',
    farmerPlace: 'Kheri',
    purchaseDate: '2026-07-06',
    grainTypeIds: ['wheat', 'mustard'],
    lines: [
      {
        id: 'line-1',
        grainTypeId: 'wheat',
        pricePerQuintal: 2400,
        sackWeights: [40, 40, 40.5, 39],
        deductions: [
          { basis: 'per_sack_kg', value: 0.5 },
          { basis: 'percent_gross', value: 1 },
        ],
      },
      {
        id: 'line-2',
        grainTypeId: 'mustard',
        pricePerQuintal: 5600,
        sackWeights: [30, 30],
        deductions: [],
      },
    ],
    payments: [],
    ...overrides,
  }
}

describe('farmers', () => {
  it('upserts a new farmer and reads it back', async () => {
    const f = await upsertFarmer({ name: 'Ramesh', place: 'Kheri', phone: '9990001111' })
    expect(f.id).toBeTruthy()
    expect(f.createdAt).toBeGreaterThan(0)
    const fetched = await getFarmer(f.id)
    expect(fetched).toEqual(f)
  })

  it('updates an existing farmer without creating a duplicate, preserving createdAt', async () => {
    const f = await upsertFarmer({ name: 'Ramesh', place: 'Kheri' })
    const updated = await upsertFarmer({ id: f.id, name: 'Ramesh Kumar', place: 'Kheri', phone: '9' })
    expect(updated.id).toBe(f.id)
    expect(updated.createdAt).toBe(f.createdAt)
    expect(updated.name).toBe('Ramesh Kumar')
    expect((await listFarmers()).length).toBe(1)
  })

  it('searchFarmers matches name prefix, case-insensitive', async () => {
    await upsertFarmer({ name: 'Ramesh', place: 'Kheri' })
    await upsertFarmer({ name: 'Rajesh', place: 'Sitapur' })
    await upsertFarmer({ name: 'Suresh', place: 'Kheri' })

    const ra = await searchFarmers('ra')
    expect(ra.map((f) => f.name).sort()).toEqual(['Rajesh', 'Ramesh'])

    const upper = await searchFarmers('RAM')
    expect(upper.map((f) => f.name)).toEqual(['Ramesh'])

    const none = await searchFarmers('zzz')
    expect(none).toEqual([])
  })

  it('same name in different places are distinct records', async () => {
    await upsertFarmer({ name: 'Mohan', place: 'Kheri' })
    await upsertFarmer({ name: 'Mohan', place: 'Sitapur' })
    const results = await searchFarmers('Mohan')
    expect(results.length).toBe(2)
    expect(results.map((f) => f.place).sort()).toEqual(['Kheri', 'Sitapur'])
  })

  it('blank prefix returns all farmers', async () => {
    await upsertFarmer({ name: 'A', place: 'X' })
    await upsertFarmer({ name: 'B', place: 'Y' })
    expect((await searchFarmers('   ')).length).toBe(2)
  })
})

describe('grain types & seeding', () => {
  it('ensureSeeded populates the 7 starter grains with EN + Devanagari names', async () => {
    await ensureSeeded()
    const grains = await listGrainTypes()
    expect(grains.length).toBe(7)
    const wheat = grains.find((g) => g.id === 'wheat')
    expect(wheat?.nameEn).toBe('Wheat')
    expect(wheat?.nameHi).toBe('गेहूँ')
    expect(wheat?.isCustom).toBe(0)
    expect(grains.map((g) => g.id).sort()).toEqual(
      ['bajra', 'gram', 'maize', 'mustard', 'paddy', 'soybean', 'wheat'].sort(),
    )
  })

  it('ensureSeeded is idempotent — calling twice does not duplicate', async () => {
    await ensureSeeded()
    await ensureSeeded()
    expect((await listGrainTypes()).length).toBe(7)
  })

  it('addCustomGrainType adds a custom grain alongside seeds', async () => {
    await ensureSeeded()
    const custom = await addCustomGrainType('Barley', 'जौ')
    expect(custom.isCustom).toBe(1)
    expect(custom.id).toBeTruthy()
    const grains = await listGrainTypes()
    expect(grains.length).toBe(8)
    expect(grains.find((g) => g.id === custom.id)?.nameHi).toBe('जौ')
  })
})

describe('bills — round-trip', () => {
  it('creates a bill and reads it back identically (sacks + deductions + lines preserved)', async () => {
    const input = sampleBillInput()
    const created = await createBill(input)
    expect(created.createdAt).toBeGreaterThan(0)
    expect(created.updatedAt).toBe(created.createdAt)

    const fetched = await getBill(input.id)
    expect(fetched).toBeDefined()
    // Everything the trader entered survives verbatim.
    expect(fetched!.lines).toEqual(input.lines)
    expect(fetched!.lines[0].sackWeights).toEqual([40, 40, 40.5, 39])
    expect(fetched!.lines[0].deductions).toEqual(input.lines[0].deductions)
    expect(fetched!.grainTypeIds).toEqual(['wheat', 'mustard'])
    expect(fetched!.farmerName).toBe('Ramesh')
    expect(fetched!.payments).toEqual([])
  })

  it('getBill returns undefined for an unknown id', async () => {
    expect(await getBill('000000/zzzzz')).toBeUndefined()
  })

  it('listBills returns all bills newest-first by createdAt', async () => {
    await createBill(sampleBillInput({ id: '060726/aaaaa' }))
    // Force a later createdAt on the second bill.
    await new Promise((r) => setTimeout(r, 2))
    await createBill(sampleBillInput({ id: '060726/bbbbb' }))
    const bills = await listBills()
    expect(bills.map((b) => b.id)).toEqual(['060726/bbbbb', '060726/aaaaa'])
  })

  it('empty store lists no bills', async () => {
    expect(await listBills()).toEqual([])
  })

  it('updateBill persists edits and bumps updatedAt', async () => {
    const created = await createBill(sampleBillInput())
    await new Promise((r) => setTimeout(r, 2))
    const edited = { ...created, farmerName: 'Ramesh Kumar' }
    const updated = await updateBill(edited)
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt)
    const fetched = await getBill(created.id)
    expect(fetched!.farmerName).toBe('Ramesh Kumar')
    expect((await listBills()).length).toBe(1) // updated in place, not duplicated
  })

  it('bill is searchable by grainTypeIds multiEntry index', async () => {
    await createBill(sampleBillInput())
    const byGrain = await db.bills.where('grainTypeIds').equals('mustard').toArray()
    expect(byGrain.map((b) => b.id)).toEqual(['060726/abc12'])
  })
})

describe('payments — addPayment & balance round-trip', () => {
  // sampleBillInput total = 3741.72 (wheat) + 3360.00 (mustard) = ₹7101.72
  it('appends a payment, bumps updatedAt, and the round-tripped balance is exact', async () => {
    const created = await createBill(sampleBillInput())
    expect(billBalance(created).outstanding).toBe(7101.72)

    await new Promise((r) => setTimeout(r, 2))
    const afterFirst = await addPayment(created.id, { amount: 1741.72, date: '2026-07-10' })
    expect(afterFirst.payments.length).toBe(1)
    expect(afterFirst.updatedAt).toBeGreaterThan(created.updatedAt)
    expect(afterFirst.payments[0].id).toBeTruthy()
    expect(afterFirst.payments[0].createdAt).toBeGreaterThan(0)

    // Persisted to IndexedDB, not just returned.
    const fetched = await getBill(created.id)
    const balance = billBalance(fetched!)
    expect(balance.paid).toBe(1741.72)
    expect(balance.outstanding).toBe(5360.0)
    expect(balance.fullyPaid).toBe(false)
  })

  it('multiple partial payments settle the bill exactly to outstanding 0 / fullyPaid', async () => {
    const created = await createBill(sampleBillInput())
    await addPayment(created.id, { amount: 3741.72, date: '2026-07-10' })
    const settled = await addPayment(created.id, { amount: 3360.0, date: '2026-07-12', note: 'final' })
    expect(settled.payments.length).toBe(2)
    expect(settled.payments[1].note).toBe('final')

    const balance = billBalance((await getBill(created.id))!)
    expect(balance.paid).toBe(7101.72)
    expect(balance.outstanding).toBe(0)
    expect(balance.fullyPaid).toBe(true)
  })

  it('addPayment on an unknown bill throws BillNotFoundError', async () => {
    await expect(addPayment('000000/zzzzz', { amount: 100, date: '2026-07-10' })).rejects.toBeInstanceOf(
      BillNotFoundError,
    )
  })
})

describe('edit-lock invariant at the data layer', () => {
  it('updateBill on a bill WITH a payment throws BillLockedError (purchase data frozen)', async () => {
    const created = await createBill(sampleBillInput())
    await addPayment(created.id, { amount: 100, date: '2026-07-10' })

    const locked = await getBill(created.id)
    const edited = { ...locked!, farmerName: 'Someone Else' }
    await expect(updateBill(edited)).rejects.toBeInstanceOf(BillLockedError)

    // The attempted edit did not persist.
    const fetched = await getBill(created.id)
    expect(fetched!.farmerName).toBe('Ramesh')
  })

  it('the lock cannot be bypassed by sending payments: [] — stored payments are authoritative', async () => {
    const created = await createBill(sampleBillInput())
    await addPayment(created.id, { amount: 100, date: '2026-07-10' })
    const sneaky = { ...created, payments: [], farmerName: 'Bypass' }
    await expect(updateBill(sneaky)).rejects.toBeInstanceOf(BillLockedError)
  })

  it('updateBill on a no-payment bill still persists edits (editable) incl. a due date', async () => {
    const created = await createBill(sampleBillInput())
    const edited = { ...created, farmerName: 'Ramesh Kumar', dueDate: '2026-08-01' }
    const updated = await updateBill(edited)
    expect(updated.farmerName).toBe('Ramesh Kumar')
    expect(updated.dueDate).toBe('2026-08-01')

    const fetched = await getBill(created.id)
    expect(fetched!.farmerName).toBe('Ramesh Kumar')
    expect(fetched!.dueDate).toBe('2026-08-01')
  })

  it('dueDate persists and can be cleared while the bill is still editable', async () => {
    const created = await createBill(sampleBillInput({ dueDate: '2026-08-01' }))
    expect((await getBill(created.id))!.dueDate).toBe('2026-08-01')
    const cleared = await updateBill({ ...created, dueDate: undefined })
    expect(cleared.dueDate).toBeUndefined()
    expect((await getBill(created.id))!.dueDate).toBeUndefined()
  })
})
