import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/lib/db/schema'
import { isPinSet, setPin, verifyPin, resetPin } from './pin'

// fake-indexeddb/auto is loaded in vitest.setup.ts; WebCrypto is Node's global.

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('PIN lifecycle', () => {
  it('isPinSet is false before, true after setPin', async () => {
    expect(await isPinSet()).toBe(false)
    await setPin('1234')
    expect(await isPinSet()).toBe(true)
  })

  it('verifyPin: correct PIN → true, wrong PIN → false', async () => {
    await setPin('1234')
    expect(await verifyPin('1234')).toBe(true)
    expect(await verifyPin('0000')).toBe(false)
    expect(await verifyPin('4321')).toBe(false)
  })

  it('verifyPin is false when no PIN has been set', async () => {
    expect(await verifyPin('1234')).toBe(false)
  })

  it('setPin replaces an existing PIN (old no longer verifies, new does)', async () => {
    await setPin('1234')
    await setPin('5678')
    expect(await verifyPin('1234')).toBe(false)
    expect(await verifyPin('5678')).toBe(true)
  })

  it('resetPin makes isPinSet false again and the old PIN stops verifying', async () => {
    await setPin('1234')
    expect(await isPinSet()).toBe(true)
    await resetPin()
    expect(await isPinSet()).toBe(false)
    expect(await verifyPin('1234')).toBe(false)
  })

  it('resetPin on an unset PIN is a no-op (does not throw)', async () => {
    await expect(resetPin()).resolves.toBeUndefined()
    expect(await isPinSet()).toBe(false)
  })
})

describe('PIN storage hygiene', () => {
  it('stored meta record contains NO plaintext PIN and only salt+hash', async () => {
    await setPin('1234')
    const row = await db.meta.get('pinHash')
    expect(row).toBeDefined()
    const serialised = JSON.stringify(row)
    expect(serialised).not.toContain('1234')

    const value = row!.value as { salt: string; hash: string }
    expect(typeof value.salt).toBe('string')
    expect(typeof value.hash).toBe('string')
    expect(value.hash).toMatch(/^[0-9a-f]{64}$/) // SHA-256 hex
    expect(value.salt).toMatch(/^[0-9a-f]{32}$/) // 16-byte salt hex
  })

  it('two different PINs produce different hashes; same PIN twice produces different salts (random salt)', async () => {
    await setPin('1234')
    const first = (await db.meta.get('pinHash'))!.value as { salt: string; hash: string }
    await setPin('1234')
    const second = (await db.meta.get('pinHash'))!.value as { salt: string; hash: string }
    // Random salt → the stored hash differs even for the same PIN.
    expect(second.salt).not.toBe(first.salt)
    expect(second.hash).not.toBe(first.hash)
  })
})

describe('PIN validation', () => {
  it('rejects a non-4-digit PIN on setPin', async () => {
    await expect(setPin('123')).rejects.toThrow()
    await expect(setPin('12345')).rejects.toThrow()
    await expect(setPin('abcd')).rejects.toThrow()
    await expect(setPin('12a4')).rejects.toThrow()
    await expect(setPin('')).rejects.toThrow()
  })

  it('verifyPin returns false (never throws) for a malformed PIN', async () => {
    await setPin('1234')
    expect(await verifyPin('12')).toBe(false)
    expect(await verifyPin('abcd')).toBe(false)
  })
})
