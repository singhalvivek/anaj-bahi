// PIN access gate — salted SHA-256 in the Dexie `meta` table via WebCrypto.
// The PIN is a LIGHT access gate, not data-at-rest cryptography (data.md): the
// plaintext PIN is never stored or logged, and `resetPin` is the deliberate
// "forgot PIN" escape so a device's local ledger can never be bricked.

import { db } from '@/lib/db/schema'

const PIN_META_KEY = 'pinHash'
const PIN_PATTERN = /^\d{4}$/

/** Stored value under meta key `pinHash`. Never contains the plaintext PIN. */
interface PinRecord {
  salt: string // hex
  hash: string // hex SHA-256 of (salt + pin)
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex
}

async function hashPin(saltHex: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(saltHex + pin)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(digest))
}

function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin)
}

async function readPinRecord(): Promise<PinRecord | undefined> {
  const row = await db.meta.get(PIN_META_KEY)
  const rec = row?.value as Partial<PinRecord> | undefined
  if (rec && typeof rec.salt === 'string' && typeof rec.hash === 'string') {
    return { salt: rec.salt, hash: rec.hash }
  }
  return undefined
}

/** True once a PIN has been set (a valid hash record exists). */
export async function isPinSet(): Promise<boolean> {
  return (await readPinRecord()) !== undefined
}

/**
 * Set (or replace) the PIN. Generates a fresh random 16-byte salt, stores only
 * `{ salt, hash }` where hash = SHA-256(salt + pin). Rejects a non-4-digit PIN.
 */
export async function setPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) {
    throw new Error('PIN must be exactly 4 digits')
  }
  const saltHex = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
  const hash = await hashPin(saltHex, pin)
  const record: PinRecord = { salt: saltHex, hash }
  await db.meta.put({ key: PIN_META_KEY, value: record })
}

/** True iff a PIN is set and `pin` matches it. A malformed PIN simply returns false. */
export async function verifyPin(pin: string): Promise<boolean> {
  if (!isValidPin(pin)) return false
  const rec = await readPinRecord()
  if (!rec) return false
  const hash = await hashPin(rec.salt, pin)
  return hash === rec.hash
}

/**
 * Clear the PIN (the "forgot PIN" escape). Local data is untouched — this only
 * removes the access gate so the ledger is never locked out permanently.
 */
export async function resetPin(): Promise<void> {
  await db.meta.delete(PIN_META_KEY)
}
