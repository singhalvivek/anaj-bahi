// Firestore Security-Rules unit tests — prove the hardened invites + members model
// (spec/architecture.md § Security Rules — hardened invites + members model) closes
// the tenant-isolation hole. Runs against the Firestore emulator (127.0.0.1:8080),
// wrapped by `firebase emulators:exec` via `pnpm run test:rules`.
//
// Proves: (a) a non-owner cannot LIST invites; (b) a signed-in user cannot self-create
// an `owner` member on an EXISTING business; (c) an employee member cannot be
// claim-created without a matching UNUSED invite / with a mismatched phoneKey / against
// an already-claimed invite; (d) the legit owner-create (fresh business) and
// employee-claim (matching unused invite) paths still succeed.

import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, doc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore'

const PROJECT_ID = 'demo-anaj-bahi'
const rulesPath = fileURLToPath(new URL('../../../firestore.rules', import.meta.url))

const BIZ_A = 'biz-a'
const OWNER_A = 'owner-a-uid'
const OUTSIDER = 'outsider-uid'

// Invite fixtures on BIZ_A.
const CODE_UNUSED = 'AAA234' // status unused, phoneKey 919990001111
const CODE_CLAIMED = 'BBB234' // status claimed, phoneKey 919992223333
const CODE_CLAIM_OK = 'CCC234' // status unused, phoneKey 919994445555
const PK_UNUSED = '919990001111'
const PK_CLAIMED = '919992223333'
const PK_CLAIM_OK = '919994445555'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(rulesPath, 'utf8'),
    },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

// Seed the baseline tenant + invites with Security Rules DISABLED, so the tests
// below exercise the rules against a realistic pre-existing state.
beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'businesses', BIZ_A), {
      id: BIZ_A,
      shopName: 'A Traders',
      traderName: 'Owner A',
      createdByUid: OWNER_A,
      createdByName: 'Owner A',
      createdAt: 1,
      updatedAt: 1,
    })
    // Owner A's member doc makes isOwner(BIZ_A) true for OWNER_A.
    await setDoc(doc(db, 'businesses', BIZ_A, 'members', OWNER_A), {
      uid: OWNER_A,
      phone: '+911110000000',
      displayName: 'Owner A',
      role: 'owner',
      addedByUid: OWNER_A,
      addedByName: 'Owner A',
      addedAt: 1,
      status: 'active',
      inviteCode: null,
      phoneKey: '911110000000',
    })
    const inviteBase = {
      role: 'employee',
      displayName: 'Emp',
      addedByUid: OWNER_A,
      addedByName: 'Owner A',
      createdAt: 1,
    }
    await setDoc(doc(db, 'invites', CODE_UNUSED), {
      ...inviteBase,
      code: CODE_UNUSED,
      bizId: BIZ_A,
      assignedPhone: '+919990001111',
      phoneKey: PK_UNUSED,
      status: 'unused',
      claimedByUid: null,
      claimedAt: null,
    })
    await setDoc(doc(db, 'invites', CODE_CLAIMED), {
      ...inviteBase,
      code: CODE_CLAIMED,
      bizId: BIZ_A,
      assignedPhone: '+919992223333',
      phoneKey: PK_CLAIMED,
      status: 'claimed',
      claimedByUid: 'someone-else',
      claimedAt: 2,
    })
    await setDoc(doc(db, 'invites', CODE_CLAIM_OK), {
      ...inviteBase,
      code: CODE_CLAIM_OK,
      bizId: BIZ_A,
      assignedPhone: '+919994445555',
      phoneKey: PK_CLAIM_OK,
      status: 'unused',
      claimedByUid: null,
      claimedAt: null,
    })
  })
})

function memberDocData(uid: string, overrides: Record<string, unknown>) {
  return {
    uid,
    phone: '+919990001111',
    displayName: 'New Member',
    role: 'employee',
    addedByUid: OWNER_A,
    addedByName: 'Owner A',
    addedAt: 3,
    status: 'active',
    inviteCode: null,
    phoneKey: PK_UNUSED,
    ...overrides,
  }
}

describe('(a) invites LIST is owner-only (no cross-tenant enumeration)', () => {
  it('a signed-in NON-owner cannot list a business’s invites', async () => {
    const db = testEnv.authenticatedContext(OUTSIDER).firestore()
    await assertFails(
      getDocs(query(collection(db, 'invites'), where('bizId', '==', BIZ_A), where('status', '==', 'unused'))),
    )
  })

  it('the owner CAN list their own business’s invites', async () => {
    const db = testEnv.authenticatedContext(OWNER_A).firestore()
    await assertSucceeds(
      getDocs(query(collection(db, 'invites'), where('bizId', '==', BIZ_A), where('status', '==', 'unused'))),
    )
  })
})

describe('(b) cannot self-create an owner member on an EXISTING business', () => {
  it('a signed-in user self-creating role:owner on BIZ_A is denied', async () => {
    const attacker = 'attacker-uid'
    const db = testEnv.authenticatedContext(attacker).firestore()
    await assertFails(
      setDoc(
        doc(db, 'businesses', BIZ_A, 'members', attacker),
        memberDocData(attacker, { role: 'owner', inviteCode: null, phoneKey: '910000000000' }),
      ),
    )
  })
})

describe('(c) employee claim-create requires a matching UNUSED invite', () => {
  it('no matching invite (unknown inviteCode) → denied', async () => {
    const emp = 'emp-nomatch-uid'
    const db = testEnv.authenticatedContext(emp).firestore()
    await assertFails(
      setDoc(
        doc(db, 'businesses', BIZ_A, 'members', emp),
        memberDocData(emp, { role: 'employee', inviteCode: 'ZZZ999', phoneKey: PK_UNUSED }),
      ),
    )
  })

  it('mismatched phoneKey → denied', async () => {
    const emp = 'emp-badphone-uid'
    const db = testEnv.authenticatedContext(emp).firestore()
    await assertFails(
      setDoc(
        doc(db, 'businesses', BIZ_A, 'members', emp),
        memberDocData(emp, { role: 'employee', inviteCode: CODE_UNUSED, phoneKey: '910000000000' }),
      ),
    )
  })

  it('invite already claimed → denied', async () => {
    const emp = 'emp-claimed-uid'
    const db = testEnv.authenticatedContext(emp).firestore()
    await assertFails(
      setDoc(
        doc(db, 'businesses', BIZ_A, 'members', emp),
        memberDocData(emp, { role: 'employee', inviteCode: CODE_CLAIMED, phoneKey: PK_CLAIMED }),
      ),
    )
  })
})

describe('(d) legit bootstrap paths still succeed', () => {
  it('owner-create on a FRESH business (business + member in one batch) succeeds', async () => {
    const newOwner = 'new-owner-uid'
    const bizNew = 'biz-new'
    const db = testEnv.authenticatedContext(newOwner).firestore()
    const batch = writeBatch(db)
    batch.set(doc(db, 'businesses', bizNew), {
      id: bizNew,
      shopName: 'New Shop',
      traderName: 'New Owner',
      createdByUid: newOwner,
      createdByName: 'New Owner',
      createdAt: 5,
      updatedAt: 5,
    })
    batch.set(
      doc(db, 'businesses', bizNew, 'members', newOwner),
      memberDocData(newOwner, { role: 'owner', inviteCode: null, phoneKey: '911112223333' }),
    )
    await assertSucceeds(batch.commit())
  })

  it('employee claim with a matching UNUSED invite (full claim batch) succeeds', async () => {
    const emp = 'emp-ok-uid'
    const db = testEnv.authenticatedContext(emp).firestore()
    const batch = writeBatch(db)
    // invite unused→claimed, stamped with the claimer's own uid
    batch.set(
      doc(db, 'invites', CODE_CLAIM_OK),
      { status: 'claimed', claimedByUid: emp, claimedAt: 6 },
      { merge: true },
    )
    // members/{uid} carrying the inviteCode + matching phoneKey
    batch.set(
      doc(db, 'businesses', BIZ_A, 'members', emp),
      memberDocData(emp, { role: 'employee', inviteCode: CODE_CLAIM_OK, phoneKey: PK_CLAIM_OK }),
    )
    // users/{uid} self-write
    batch.set(doc(db, 'users', emp), {
      uid: emp,
      bizId: BIZ_A,
      role: 'employee',
      phone: '+919994445555',
      email: 'emp@example.com',
      displayName: 'Emp',
      updatedAt: 6,
    })
    await assertSucceeds(batch.commit())
  })
})
