import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db/schema'
import { getProfile, saveProfile, DEFAULT_PROFILE } from './profile'

// fake-indexeddb/auto is loaded in vitest.setup.ts.

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('business profile', () => {
  // Happy path — round-trips every field exactly.
  it('saveProfile then getProfile round-trips shopName/traderName/phone/address exactly', async () => {
    const p = {
      shopName: 'Anaj Bhandar',
      traderName: 'Ram Kumar',
      phone: '9876543210',
      address: 'Main Market, Indore',
    }
    await saveProfile(p)
    const got = await getProfile()
    expect(got.shopName).toBe('Anaj Bhandar')
    expect(got.traderName).toBe('Ram Kumar')
    expect(got.phone).toBe('9876543210')
    expect(got.address).toBe('Main Market, Indore')
  })

  // Edge — no save yet: returns the non-empty default.
  it('getProfile returns DEFAULT_PROFILE (non-empty shopName) before any save', async () => {
    const got = await getProfile()
    expect(got).toEqual({
      shopName: DEFAULT_PROFILE.shopName,
      traderName: '',
      phone: '',
      address: undefined,
    })
    expect(got.shopName.length).toBeGreaterThan(0)
  })

  // Error/business-rule — blank shopName must never leak through.
  it('saving a blank shopName still yields a non-empty shopName from getProfile', async () => {
    await saveProfile({ shopName: '   ', traderName: 'Sita', phone: '', address: '' })
    const got = await getProfile()
    expect(got.shopName).toBe(DEFAULT_PROFILE.shopName)
    expect(got.shopName.length).toBeGreaterThan(0)
    expect(got.traderName).toBe('Sita')
  })

  // Overwrite — a second save replaces the first.
  it('saveProfile overwrites a previously saved profile', async () => {
    await saveProfile({ shopName: 'First', traderName: 'A', phone: '111', address: 'X' })
    await saveProfile({ shopName: 'Second', traderName: 'B', phone: '222', address: 'Y' })
    const got = await getProfile()
    expect(got.shopName).toBe('Second')
    expect(got.traderName).toBe('B')
    expect(got.phone).toBe('222')
    expect(got.address).toBe('Y')
  })

  // Trimming — surrounding whitespace is stripped on save.
  it('trims surrounding whitespace on save', async () => {
    await saveProfile({
      shopName: '  Trimmed Shop  ',
      traderName: '  Mohan  ',
      phone: '  555  ',
      address: '  Bazaar  ',
    })
    const got = await getProfile()
    expect(got.shopName).toBe('Trimmed Shop')
    expect(got.traderName).toBe('Mohan')
    expect(got.phone).toBe('555')
    expect(got.address).toBe('Bazaar')
  })

  // Optional address — omitted address comes back undefined, not empty string.
  it('an empty/omitted address is normalised to undefined', async () => {
    await saveProfile({ shopName: 'Shop', traderName: '', phone: '' })
    const got = await getProfile()
    expect(got.address).toBeUndefined()
  })
})
