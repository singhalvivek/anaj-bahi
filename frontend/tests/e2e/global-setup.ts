import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Playwright global setup — runs ONCE before the specs boot the dev server.
 *
 * Replaces the retired SQLite-wipe with a **Firebase test-user reset**: it deletes
 * the canonical E2E owner's cloud footprint so onboarding runs fresh and
 * deterministically every run (mirrors how the old setup wiped `e2e.db`). The
 * dedicated `auth-onboarding.spec.ts` — which sorts first, workers:1 — then sees a
 * clean user and asserts the full login → name → owner-creates-business → gated
 * home path.
 *
 * Two reset paths, chosen at runtime:
 *   • FIREBASE_SERVICE_ACCOUNT set → Firebase **Admin SDK** (privileged): look up
 *     the test owner's membership, `recursiveDelete` their business, then delete
 *     the membership + `users/{uid}`.
 *   • FIREBASE_SERVICE_ACCOUNT absent → **client web SDK** fallback against the
 *     same project (Phase-6 Firestore has no restrictive Rules yet — they land in
 *     Phase 8 — so a plain client may read/delete these docs). Keeps the gate
 *     runnable when only the 6 public NEXT_PUBLIC_FIREBASE_* keys are present.
 *
 * A first run where the docs simply do not exist yet is SUCCESS — never fatal.
 */

const TEST_PHONE_E164 = '+919352277260'
const TEST_PHONE_KEY = '919352277260' // E.164 without the leading '+'

/** Minimal `.env.local` loader (global-setup does not go through Next's loader). */
function loadEnvLocal(): Record<string, string> {
  const envPath = path.resolve(__dirname, '../../.env.local')
  const out: Record<string, string> = {}
  let raw: string
  try {
    raw = readFileSync(envPath, 'utf8')
  } catch {
    return out
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/** Delete the test owner's footprint with the privileged Admin SDK. */
async function resetViaAdmin(serviceAccountRaw: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require('firebase-admin') as typeof import('firebase-admin')

  // FIREBASE_SERVICE_ACCOUNT is a path to a JSON key (or, tolerantly, inline JSON).
  const cred = serviceAccountRaw.trim().startsWith('{')
    ? JSON.parse(serviceAccountRaw)
    : JSON.parse(readFileSync(path.resolve(path.dirname(path.resolve(__dirname, '../../.env.local')), serviceAccountRaw), 'utf8'))

  const app =
    admin.apps.find((a) => a?.name === 'e2e-global-setup') ??
    admin.initializeApp({ credential: admin.credential.cert(cred) }, 'e2e-global-setup')

  const db = admin.firestore(app)

  // 1) Find the membership → its business + claimed uid.
  const membershipRef = db.doc(`memberships/${TEST_PHONE_KEY}`)
  const membershipSnap = await membershipRef.get()
  const membership = membershipSnap.exists ? membershipSnap.data() : undefined
  const bizId = membership?.bizId as string | undefined
  let uid = membership?.uid as string | undefined

  // 2) Also resolve the uid from Admin Auth by phone (covers a stale membership).
  if (!uid) {
    try {
      const authUser = await admin.auth(app).getUserByPhoneNumber(TEST_PHONE_E164)
      uid = authUser.uid
    } catch {
      // No auth user yet (first run) — fine.
    }
  }

  // 3) Recursively delete the business subtree, then the membership + user doc.
  if (bizId) {
    await db.recursiveDelete(db.doc(`businesses/${bizId}`)).catch(() => {})
  }
  await membershipRef.delete().catch(() => {})
  if (uid) {
    await db.doc(`users/${uid}`).delete().catch(() => {})
  }
}

/** Delete the test owner's footprint with the unprivileged client web SDK. */
async function resetViaClient(env: Record<string, string>): Promise<void> {
  const { initializeApp, deleteApp } = await import('firebase/app')
  const {
    getFirestore,
    doc,
    getDoc,
    deleteDoc,
    collection,
    getDocs,
  } = await import('firebase/firestore')

  const app = initializeApp(
    {
      apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    },
    'e2e-global-setup-client',
  )
  // Plain memory Firestore (Node has no IndexedDB — do NOT use persistentLocalCache here).
  const db = getFirestore(app)

  try {
    const membershipRef = doc(db, 'memberships', TEST_PHONE_KEY)
    const membershipSnap = await getDoc(membershipRef)
    const membership = membershipSnap.exists() ? membershipSnap.data() : undefined
    const bizId = membership?.bizId as string | undefined
    const uid = membership?.uid as string | undefined

    if (bizId) {
      // Client SDK has no recursiveDelete — clear each known subcollection first.
      for (const sub of ['bills', 'farmers', 'grainTypes', 'members', 'activity']) {
        const snap = await getDocs(collection(db, 'businesses', bizId, sub)).catch(() => null)
        if (!snap) continue
        for (const d of snap.docs) {
          await deleteDoc(d.ref).catch(() => {})
        }
      }
      await deleteDoc(doc(db, 'businesses', bizId)).catch(() => {})
    }
    await deleteDoc(membershipRef).catch(() => {})
    if (uid) {
      await deleteDoc(doc(db, 'users', uid)).catch(() => {})
    }
  } finally {
    await deleteApp(app).catch(() => {})
  }
}

async function globalSetup(): Promise<void> {
  // Merge process env (CI) with frontend/.env.local (local runs).
  const env = { ...loadEnvLocal(), ...process.env } as Record<string, string>

  const serviceAccount = env.FIREBASE_SERVICE_ACCOUNT?.trim()

  try {
    if (serviceAccount) {
      console.log('[e2e global-setup] resetting test user via Firebase Admin SDK')
      await resetViaAdmin(serviceAccount)
    } else {
      console.log(
        '[e2e global-setup] FIREBASE_SERVICE_ACCOUNT not set — resetting test user via client web SDK',
      )
      await resetViaClient(env)
    }
    console.log(`[e2e global-setup] test user ${TEST_PHONE_E164} reset (clean onboarding)`)
  } catch (err) {
    // A clean slate is success; only log unexpected failures, never block the run.
    console.warn('[e2e global-setup] reset encountered a non-fatal error (continuing):', err)
  }
}

export default globalSetup
