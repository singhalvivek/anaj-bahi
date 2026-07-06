import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db, type Bill } from '@/lib/db/schema'
import { createBill, upsertFarmer, addCustomGrainType, addPayment, getBill } from '@/lib/db/repo'
import { saveProfile, getProfile } from '@/lib/settings/profile'
import { computeBillTotal } from '@/lib/calc'
import { saveSyncConfig } from './config'
import { syncNow, restoreFromCloud, getSyncState } from './engine'
import { applySnapshot } from './snapshot'
import type { SyncSnapshot } from './client'

// fake-indexeddb/auto is loaded in vitest.setup.ts.

/** Minimal fetch Response stand-in (avoids relying on a global Response impl). */
function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

function sampleBillInput(overrides: Partial<Bill> = {}): Omit<Bill, 'createdAt' | 'updatedAt'> {
  return {
    id: '060726/abc12',
    farmerId: 'farmer-1',
    farmerName: 'Ramesh',
    farmerPlace: 'Kheri',
    purchaseDate: '2026-07-06',
    grainTypeIds: ['wheat'],
    lines: [
      {
        id: 'line-1',
        grainTypeId: 'wheat',
        pricePerQuintal: 2500,
        sackWeights: [50, 50, 40], // 140 kg gross
        deductions: [],
      },
    ],
    payments: [],
    ...overrides,
  }
}

async function seedLocalData(): Promise<void> {
  await upsertFarmer({ id: 'farmer-1', name: 'Ramesh', place: 'Kheri' })
  await addCustomGrainType('Wheat', 'गेहूँ')
  await saveProfile({ shopName: 'Anaj Bhandar', traderName: 'Ram', phone: '999', address: 'Indore' })
  await createBill(sampleBillInput())
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('syncNow', () => {
  // Error path — no config: resolves cleanly, never throws, never calls fetch.
  it('returns { ok:false, error:"config" } and does not throw when unconfigured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await syncNow()
    expect(result).toEqual({ ok: false, error: 'config' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Happy path — real snapshot posted to /sync/push with bearer auth; state advances.
  it('pushes the local snapshot to <baseUrl>/sync/push with a Bearer header and advances lastSyncedAt', async () => {
    await seedLocalData()
    await saveSyncConfig({ baseUrl: 'https://api.example.com', token: 'secret-token' })

    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        fakeResponse(200, { ok: true, counts: { bills: 1, farmers: 1, grainTypes: 1, profile: 1 } }),
      )
    vi.stubGlobal('fetch', fetchMock)

    // Before any successful sync, everything local is pending.
    const before = await getSyncState()
    expect(before.lastSyncedAt).toBeNull()
    expect(before.pendingCount).toBe(4) // 1 bill + 1 farmer + 1 grain type + 1 profile

    const result = await syncNow()

    expect(result.ok).toBe(true)
    expect(result.counts).toEqual({ bills: 1, farmers: 1, grainTypes: 1, profile: 1 })

    // Request shape: URL, method, headers, and a body carrying all local records.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.com/sync/push')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer secret-token')
    expect(headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(init.body as string) as SyncSnapshot
    expect(body.bills).toHaveLength(1)
    expect(body.bills[0].id).toBe('060726/abc12')
    expect(body.farmers).toHaveLength(1)
    expect(body.grainTypes).toHaveLength(1)
    expect(body.profile?.shopName).toBe('Anaj Bhandar')

    // State advanced and pending dropped to 0.
    const after = await getSyncState()
    expect(after.lastSyncedAt).not.toBeNull()
    expect(after.lastError).toBeNull()
    expect(after.pendingCount).toBe(0)
  })

  // Error path — 401 maps to error:'auth' and must NOT advance lastSyncedAt.
  it('returns { ok:false, error:"auth" } on 401 without advancing lastSyncedAt', async () => {
    await seedLocalData()
    await saveSyncConfig({ baseUrl: 'https://api.example.com', token: 'wrong' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, { detail: 'unauthorized' })))

    const result = await syncNow()
    expect(result).toEqual({ ok: false, error: 'auth' })

    const state = await getSyncState()
    expect(state.lastSyncedAt).toBeNull()
    expect(state.lastError).toBe('auth')
  })

  // Error path — a rejected fetch (offline/backend down) maps to error:'network', retry-safe.
  it('returns { ok:false, error:"network" } on a fetch reject without advancing lastSyncedAt', async () => {
    await seedLocalData()
    await saveSyncConfig({ baseUrl: 'https://api.example.com', token: 'tok' })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await syncNow()
    expect(result).toEqual({ ok: false, error: 'network' })

    const state = await getSyncState()
    expect(state.lastSyncedAt).toBeNull() // not advanced → next attempt retries
    expect(state.lastError).toBe('network')
  })

  // A network failure must not corrupt or drop any local data.
  it('leaves local data intact after a failed sync', async () => {
    await seedLocalData()
    await saveSyncConfig({ baseUrl: 'https://api.example.com', token: 'tok' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))

    await syncNow()

    const bill = await getBill('060726/abc12')
    expect(bill).toBeDefined()
    expect(bill?.farmerName).toBe('Ramesh')
  })
})

describe('pendingCount', () => {
  it('reflects a new local bill created after a successful sync', async () => {
    await seedLocalData()
    await saveSyncConfig({ baseUrl: 'https://api.example.com', token: 'tok' })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          fakeResponse(200, { ok: true, counts: { bills: 1, farmers: 1, grainTypes: 1, profile: 1 } }),
        ),
    )

    await syncNow()
    expect((await getSyncState()).pendingCount).toBe(0)

    // A bill created AFTER lastSyncedAt becomes pending again.
    await createBill(sampleBillInput({ id: '070726/zzz99', grainTypeIds: ['wheat'] }))
    expect((await getSyncState()).pendingCount).toBe(1)
  })
})

describe('restoreFromCloud', () => {
  function cloudSnapshot(): SyncSnapshot {
    const bill: Bill = {
      id: '010726/cloud1',
      farmerId: 'f-cloud',
      farmerName: 'Suresh',
      farmerPlace: 'Dewas',
      purchaseDate: '2026-07-01',
      grainTypeIds: ['g-cloud'],
      lines: [
        {
          id: 'l1',
          grainTypeId: 'g-cloud',
          pricePerQuintal: 2000,
          sackWeights: [50, 50], // 100 kg gross → 1 quintal → ₹2000
          deductions: [],
        },
      ],
      payments: [
        { id: 'p1', amount: 500, date: '2026-07-02', note: 'advance', createdAt: 1_000 },
      ],
      createdAt: 1_000,
      updatedAt: 2_000,
    }
    return {
      bills: [bill],
      farmers: [{ id: 'f-cloud', name: 'Suresh', place: 'Dewas', createdAt: 1_000 }],
      grainTypes: [{ id: 'g-cloud', nameEn: 'Gram', nameHi: 'चना', isCustom: 1, createdAt: 1_000 }],
      profile: { shopName: 'Cloud Shop', traderName: 'Restored', phone: '123', address: 'Ujjain' },
    }
  }

  // Happy path — pulled snapshot lands in Dexie with correct totals and a surviving payment.
  it('pulls a snapshot and writes bills/farmers/grainTypes/profile into the local store', async () => {
    await saveSyncConfig({ baseUrl: 'https://api.example.com', token: 'tok' })
    const snap = cloudSnapshot()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(200, snap)))

    await restoreFromCloud()

    const bill = await getBill('010726/cloud1')
    expect(bill).toBeDefined()
    // Bill total recomputes correctly from restored lines.
    expect(computeBillTotal(bill!.lines)).toBe(2000)
    // The embedded payment survived the round-trip.
    expect(bill!.payments).toHaveLength(1)
    expect(bill!.payments[0].amount).toBe(500)
    expect(bill!.payments[0].note).toBe('advance')

    const farmer = await db.farmers.get('f-cloud')
    expect(farmer?.name).toBe('Suresh')
    const grain = await db.grainTypes.get('g-cloud')
    expect(grain?.nameEn).toBe('Gram')
    const profile = await getProfile()
    expect(profile.shopName).toBe('Cloud Shop')
    expect(profile.traderName).toBe('Restored')
  })

  // Idempotency — applying the same snapshot twice yields one row per id.
  it('is idempotent: applying the same snapshot twice keeps one copy per id', async () => {
    const snap = cloudSnapshot()
    await applySnapshot(snap)
    await applySnapshot(snap)

    expect(await db.bills.count()).toBe(1)
    expect(await db.farmers.count()).toBe(1)
    expect(await db.grainTypes.count()).toBe(1)
  })

  // Merge rule — restore never downgrades a locally-newer bill.
  it('does not overwrite a local bill that is newer than the incoming one', async () => {
    const snap = cloudSnapshot() // incoming bill updatedAt = 2000
    // Local bill with the same id but a newer updatedAt and different data.
    await db.bills.put({
      ...snap.bills[0],
      farmerName: 'LOCAL-NEWER',
      updatedAt: 9_999,
    })

    await applySnapshot(snap)

    const bill = await getBill('010726/cloud1')
    expect(bill?.farmerName).toBe('LOCAL-NEWER') // local (newer) wins
  })

  // Error path — auth failure on pull propagates as a typed error.
  it('throws SyncAuthError when the backend rejects the pull with 401', async () => {
    await saveSyncConfig({ baseUrl: 'https://api.example.com', token: 'wrong' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, { detail: 'nope' })))

    await expect(restoreFromCloud()).rejects.toMatchObject({ name: 'SyncAuthError' })
  })

  // Error path — network failure on pull propagates as a typed error.
  it('throws SyncNetworkError when the backend is unreachable during pull', async () => {
    await saveSyncConfig({ baseUrl: 'https://api.example.com', token: 'tok' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))

    await expect(restoreFromCloud()).rejects.toMatchObject({ name: 'SyncNetworkError' })
  })
})
