/**
 * Firebase EMULATOR REST helpers (Node side, used by global-setup + specs).
 *
 * The whole E2E run talks to the local Firebase Auth (9099) + Firestore (8080)
 * emulators — no real project, no billing, no service-account key. These helpers:
 *
 *   • clear the emulators between runs (the emulator equivalent of the old
 *     SQLite/cloud wipe) via the documented REST clear endpoints, and
 *   • let a spec ASSERT the deterministic Firestore/Auth state the UI just wrote
 *     (users/{uid}, businesses/{bizId}, members/{uid}) by reading it straight
 *     from the emulator with the `Bearer owner` admin token that bypasses Rules.
 *
 * Node 20+/24 has a global `fetch`, so there are no extra deps.
 */

export const PROJECT_ID = 'demo-anaj-bahi'

const FIRESTORE_HOST = '127.0.0.1:8080'
const AUTH_HOST = '127.0.0.1:9099'

const FIRESTORE_DOCS_BASE = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// The emulator treats `Authorization: Bearer owner` as a full-access admin token,
// so reads/writes bypass Security Rules — exactly what a test harness needs.
const ADMIN_HEADERS = { Authorization: 'Bearer owner' }

// --- Reset ------------------------------------------------------------------

/** Wipe ALL Firestore data in the emulator (the documented REST clear endpoint). */
export async function clearFirestore(): Promise<void> {
  const url = `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok && res.status !== 200) {
    throw new Error(`Firestore emulator clear failed: ${res.status} ${await res.text()}`)
  }
}

/** Wipe ALL Auth accounts in the emulator (the documented REST clear endpoint). */
export async function clearAuth(): Promise<void> {
  const url = `http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok && res.status !== 200) {
    throw new Error(`Auth emulator clear failed: ${res.status} ${await res.text()}`)
  }
}

// --- Firestore reads (for assertions) ---------------------------------------

interface FirestoreDoc {
  name: string
  fields?: Record<string, Record<string, unknown>>
}

/** GET a single document; returns its `fields` map, or null on 404. */
export async function getDocFields(
  path: string,
): Promise<Record<string, Record<string, unknown>> | null> {
  const res = await fetch(`${FIRESTORE_DOCS_BASE}/${path}`, { headers: ADMIN_HEADERS })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Firestore GET ${path} failed: ${res.status} ${await res.text()}`)
  const doc = (await res.json()) as FirestoreDoc
  return doc.fields ?? {}
}

/** List a collection; returns each document's `{ id, fields }`. */
export async function listCollection(
  collectionPath: string,
): Promise<{ id: string; fields: Record<string, Record<string, unknown>> }[]> {
  const res = await fetch(`${FIRESTORE_DOCS_BASE}/${collectionPath}`, { headers: ADMIN_HEADERS })
  if (res.status === 404) return []
  if (!res.ok) {
    throw new Error(`Firestore LIST ${collectionPath} failed: ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as { documents?: FirestoreDoc[] }
  return (body.documents ?? []).map((d) => ({
    id: d.name.split('/').pop() as string,
    fields: d.fields ?? {},
  }))
}

/** Read a string field out of a Firestore REST `fields` map (`{ stringValue }`). */
export function str(
  fields: Record<string, Record<string, unknown>> | null,
  key: string,
): string | null {
  const v = fields?.[key]
  if (!v) return null
  if ('stringValue' in v) return v.stringValue as string
  if ('nullValue' in v) return null
  return null
}

// --- Auth reads (for assertions) --------------------------------------------

interface EmulatorAccount {
  localId: string
  email?: string
  displayName?: string
}

/** List all Auth-emulator accounts (the admin `accounts:query` endpoint — a POST). */
export async function listAuthAccounts(): Promise<EmulatorAccount[]> {
  const url = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) throw new Error(`Auth emulator query failed: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { userInfo?: EmulatorAccount[]; users?: EmulatorAccount[] }
  return body.userInfo ?? body.users ?? []
}

/** Resolve the stable emulator uid for a Google test identity by its email. */
export async function getUidByEmail(email: string): Promise<string | null> {
  const accounts = await listAuthAccounts()
  const match = accounts.find((a) => (a.email ?? '').toLowerCase() === email.toLowerCase())
  return match?.localId ?? null
}
