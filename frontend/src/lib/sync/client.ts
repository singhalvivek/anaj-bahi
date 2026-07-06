// Thin HTTP client for the Phase-4 sync backend. Wraps `fetch` and maps failure
// modes onto TYPED errors so callers (the engine) can distinguish "bad token"
// (SyncAuthError) from "backend down / offline" (SyncNetworkError) from anything
// else (SyncServerError). This layer NEVER lets an uncaught error reach the UI —
// every fetch failure becomes one of these typed errors.
//
// Wire contract (frozen — architecture.md § Phase-4 sync contract):
//   GET  /health      → { status: 'ok' }                     (no auth)
//   POST /sync/push   body: SyncSnapshot                     (Bearer)
//   GET  /sync/pull   → SyncSnapshot                         (Bearer)

import type { Bill, Farmer, GrainType } from '@/lib/db/schema'
import type { BusinessProfile } from '@/lib/settings/profile'
import type { SyncConfig } from './config'

/** The device snapshot exchanged with the backend. Payments are embedded in each Bill. */
export interface SyncSnapshot {
  bills: Bill[]
  farmers: Farmer[]
  grainTypes: GrainType[]
  profile: BusinessProfile | null
}

/** Server-reported counts of records received by /sync/push. */
export interface PushCounts {
  bills: number
  farmers: number
  grainTypes: number
  profile: number
}

/** Bad or missing device token — HTTP 401. */
export class SyncAuthError extends Error {
  constructor(message = 'Sync failed: invalid device token (401).') {
    super(message)
    this.name = 'SyncAuthError'
  }
}

/** Backend unreachable — offline, DNS/connection failure, or a fetch that rejected. */
export class SyncNetworkError extends Error {
  constructor(message = 'Sync failed: the backend could not be reached.') {
    super(message)
    this.name = 'SyncNetworkError'
  }
}

/** Backend reachable and authorised but returned an unexpected (non-2xx, non-401) status. */
export class SyncServerError extends Error {
  readonly status: number
  constructor(status: number, message = `Sync failed: backend returned HTTP ${status}.`) {
    super(message)
    this.name = 'SyncServerError'
    this.status = status
  }
}

function authHeaders(cfg: SyncConfig): HeadersInit {
  return {
    Authorization: `Bearer ${cfg.token}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Perform a fetch and translate any thrown/rejected error into SyncNetworkError.
 * `fetch` rejects only on network-level failure (offline, DNS, connection refused,
 * CORS) — HTTP error statuses resolve normally and are handled by the caller.
 */
async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch {
    throw new SyncNetworkError()
  }
}

/**
 * GET /health — no auth. Resolves `true` when the backend answers 2xx with
 * `{ status: 'ok' }`; resolves `false` on any other reachable response.
 * Throws SyncNetworkError when the backend is unreachable.
 */
export async function health(baseUrl: string): Promise<boolean> {
  const res = await safeFetch(`${baseUrl}/health`, { method: 'GET' })
  if (!res.ok) return false
  try {
    const body = (await res.json()) as { status?: string }
    return body?.status === 'ok'
  } catch {
    return false
  }
}

/**
 * POST /sync/push — upload the full local snapshot. Returns the server's per-table
 * counts. Throws SyncAuthError on 401, SyncNetworkError when unreachable, and
 * SyncServerError on any other non-2xx status.
 */
export async function push(cfg: SyncConfig, snapshot: SyncSnapshot): Promise<PushCounts> {
  const res = await safeFetch(`${cfg.baseUrl}/sync/push`, {
    method: 'POST',
    headers: authHeaders(cfg),
    body: JSON.stringify(snapshot),
  })
  if (res.status === 401) throw new SyncAuthError()
  if (!res.ok) throw new SyncServerError(res.status)
  const body = (await res.json()) as { counts?: Partial<PushCounts> }
  const counts = body?.counts ?? {}
  return {
    bills: counts.bills ?? 0,
    farmers: counts.farmers ?? 0,
    grainTypes: counts.grainTypes ?? 0,
    profile: counts.profile ?? 0,
  }
}

/**
 * GET /sync/pull — download the full device snapshot (used by restore).
 * Throws SyncAuthError on 401, SyncNetworkError when unreachable, and
 * SyncServerError on any other non-2xx status.
 */
export async function pull(cfg: SyncConfig): Promise<SyncSnapshot> {
  const res = await safeFetch(`${cfg.baseUrl}/sync/pull`, {
    method: 'GET',
    headers: authHeaders(cfg),
  })
  if (res.status === 401) throw new SyncAuthError()
  if (!res.ok) throw new SyncServerError(res.status)
  const body = (await res.json()) as Partial<SyncSnapshot>
  return {
    bills: Array.isArray(body?.bills) ? body.bills : [],
    farmers: Array.isArray(body?.farmers) ? body.farmers : [],
    grainTypes: Array.isArray(body?.grainTypes) ? body.grainTypes : [],
    profile: body?.profile ?? null,
  }
}
