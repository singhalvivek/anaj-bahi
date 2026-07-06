import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db/schema'
import { getSyncConfig, saveSyncConfig } from './config'

// fake-indexeddb/auto is loaded in vitest.setup.ts.

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('sync config', () => {
  // Happy path — round-trips baseUrl + token.
  it('saveSyncConfig then getSyncConfig round-trips the config', async () => {
    await saveSyncConfig({ baseUrl: 'https://api.example.com', token: 'secret-token' })
    const got = await getSyncConfig()
    expect(got).toEqual({ baseUrl: 'https://api.example.com', token: 'secret-token' })
  })

  // Edge — trailing slash on baseUrl is normalised away so client path-joins are clean.
  it('normalises a trailing slash (and whitespace) off the base URL', async () => {
    await saveSyncConfig({ baseUrl: '  https://api.example.com/  ', token: '  tok  ' })
    const got = await getSyncConfig()
    expect(got?.baseUrl).toBe('https://api.example.com')
    expect(got?.token).toBe('tok')
  })

  it('strips multiple trailing slashes', async () => {
    await saveSyncConfig({ baseUrl: 'https://api.example.com///', token: 'tok' })
    const got = await getSyncConfig()
    expect(got?.baseUrl).toBe('https://api.example.com')
  })

  // Edge — no config saved yet returns null.
  it('getSyncConfig returns null before anything is saved', async () => {
    expect(await getSyncConfig()).toBeNull()
  })

  // Error/edge — a blank baseUrl or token is treated as unconfigured (null).
  it('treats a blank baseUrl or token as unconfigured (null)', async () => {
    await saveSyncConfig({ baseUrl: '   ', token: 'tok' })
    expect(await getSyncConfig()).toBeNull()
    await saveSyncConfig({ baseUrl: 'https://api.example.com', token: '   ' })
    expect(await getSyncConfig()).toBeNull()
  })

  // Overwrite — a second save replaces the first.
  it('overwrites a previously saved config', async () => {
    await saveSyncConfig({ baseUrl: 'https://one.example.com', token: 'a' })
    await saveSyncConfig({ baseUrl: 'https://two.example.com', token: 'b' })
    const got = await getSyncConfig()
    expect(got).toEqual({ baseUrl: 'https://two.example.com', token: 'b' })
  })
})
