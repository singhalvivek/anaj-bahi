// Sync configuration — the backend base URL + device token the user enters in
// Settings. Stored locally in the Dexie `meta` table (key `syncConfig`), NOT a
// build-time env var: the PWA is a static export, so pointing at a backend must
// never require a rebuild. Mirrors the meta read/write pattern in lib/auth/pin.ts
// and lib/settings/profile.ts.

import { db } from '@/lib/db/schema'

const SYNC_CONFIG_META_KEY = 'syncConfig'

export interface SyncConfig {
  baseUrl: string
  token: string
}

/** Strip a trailing slash (or several) and surrounding whitespace from the base URL. */
function normaliseBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

/**
 * Read the stored sync config, or `null` if the user has not configured sync yet.
 * A stored row missing either field (or with a blank baseUrl/token) is treated as
 * unconfigured (`null`) so callers can rely on a non-null config being usable.
 */
export async function getSyncConfig(): Promise<SyncConfig | null> {
  const row = await db.meta.get(SYNC_CONFIG_META_KEY)
  const rec = row?.value as Partial<SyncConfig> | undefined
  if (!rec || typeof rec.baseUrl !== 'string' || typeof rec.token !== 'string') {
    return null
  }
  const baseUrl = normaliseBaseUrl(rec.baseUrl)
  const token = rec.token.trim()
  if (baseUrl === '' || token === '') return null
  return { baseUrl, token }
}

/** Persist the sync config. baseUrl is trimmed and trailing-slash-normalised; token is trimmed. */
export async function saveSyncConfig(cfg: SyncConfig): Promise<void> {
  const clean: SyncConfig = {
    baseUrl: normaliseBaseUrl(cfg.baseUrl),
    token: cfg.token.trim(),
  }
  await db.meta.put({ key: SYNC_CONFIG_META_KEY, value: clean })
}
