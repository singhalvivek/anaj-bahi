// Business profile — the trader's receipt header (shop/trader name + phone + address).
// Persisted as a single row in the Dexie `meta` table under key `businessProfile`
// (mirrors the meta read/write pattern in lib/auth/pin.ts). Plain data, no crypto.
// The receipt (Phase 3 slice-b) renders its header from getProfile().

import { db } from '@/lib/db/schema'

const PROFILE_META_KEY = 'businessProfile'

export interface BusinessProfile {
  shopName: string
  traderName: string
  phone: string
  address?: string
}

/**
 * Sensible NON-EMPTY defaults so a receipt renders legibly before the user fills
 * the Settings form. shopName is a neutral placeholder (never blank); the other
 * fields start empty and are fine to leave empty.
 */
export const DEFAULT_PROFILE: BusinessProfile = {
  shopName: 'My Shop',
  traderName: '',
  phone: '',
  address: '',
}

function trimStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** Merge a stored (partial/unknown) row over DEFAULT_PROFILE; never returns a blank shopName. */
function normalise(raw: unknown): BusinessProfile {
  const rec = (raw ?? {}) as Partial<Record<keyof BusinessProfile, unknown>>
  const shopName = trimStr(rec.shopName)
  const address = trimStr(rec.address)
  return {
    shopName: shopName || DEFAULT_PROFILE.shopName,
    traderName: trimStr(rec.traderName),
    phone: trimStr(rec.phone),
    address: address || undefined,
  }
}

/** Read the stored profile merged over DEFAULT_PROFILE. Never returns undefined/blank shopName. */
export async function getProfile(): Promise<BusinessProfile> {
  const row = await db.meta.get(PROFILE_META_KEY)
  return normalise(row?.value)
}

/** Persist the profile. Strings are trimmed; a blank shopName falls back to the default placeholder. */
export async function saveProfile(p: BusinessProfile): Promise<void> {
  const clean = normalise(p)
  await db.meta.put({ key: PROFILE_META_KEY, value: clean })
}
