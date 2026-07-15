// Firestore Security-Rules unit tests — prove the hardened THREE-ROLE invites +
// members model (spec/architecture.md § Security Rules — hardened invites + members
// model) closes the tenant-isolation hole AND enforces the owner/partner/employee
// boundaries. Runs against the Firestore emulator (127.0.0.1:8080), wrapped by
// `firebase emulators:exec` via `pnpm run test:rules`.
//
// Proves: (a) a non-manager (employee/outsider) cannot LIST invites, but a partner
// (and owner) can; (b) a signed-in user cannot self-create an `owner` member on an
// EXISTING business; (c) a member cannot be claim-created without a matching UNUSED
// invite / with a mismatched phoneKey / against an already-claimed invite / with a role
// that differs from the invite's role; (d) the legit owner-create, employee-claim, and
// partner-claim paths still succeed; (e) partner parity — a partner can create invites
// (employee AND partner), list/cancel invites, read activity, and delete an employee
// AND another partner, but CANNOT delete an owner or write the business profile; an
// owner can delete a partner; an employee cannot read activity.

import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

const PROJECT_ID = 'demo-anaj-bahi'
const rulesPath = fileURLToPath(new URL('../../../firestore.rules', import.meta.url))

const BIZ_A = 'biz-a'
const OWNER_A = 'owner-a-uid'
const PARTNER_A = 'partner-a-uid'
const PARTNER_B = 'partner-b-uid'
const EMP_A = 'emp-a-uid'
const OUTSIDER = 'outsider-uid'

// Invite fixtures on BIZ_A.
const CODE_UNUSED = 'AAA234' // employee, status unused, phoneKey 919990001111
const CODE_CLAIMED = 'BBB234' // employee, status claimed, phoneKey 919992223333
const CODE_CLAIM_OK = 'CCC234' // employee, status unused, phoneKey 919994445555
const CODE_PARTNER_OK = 'DDD234' // partner, status unused, phoneKey 919996667777
const PK_UNUSED = '919990001111'
const PK_CLAIMED = '919992223333'
const PK_CLAIM_OK = '919994445555'
const PK_PARTNER_OK = '919996667777'

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

// Seed the baseline tenant + members + invites with Security Rules DISABLED, so the
// tests below exercise the rules against a realistic pre-existing state.
beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const seedMember = (uid: string, role: 'owner' | 'partner' | 'employee', pk: string) =>
      setDoc(doc(db, 'businesses', BIZ_A, 'members', uid), {
        uid,
        phone: `+${pk}`,
        displayName: `${role}-${uid}`,
        role,
        addedByUid: OWNER_A,
        addedByName: 'Owner A',
        addedAt: 1,
        status: 'active',
        inviteCode: null,
        phoneKey: pk,
      })
    await setDoc(doc(db, 'businesses', BIZ_A), {
      id: BIZ_A,
      shopName: 'A Traders',
      traderName: 'Owner A',
      createdByUid: OWNER_A,
      createdByName: 'Owner A',
      createdAt: 1,
      updatedAt: 1,
    })
    // Member roster for BIZ_A: owner, two partners, one employee.
    await seedMember(OWNER_A, 'owner', '911110000000')
    await seedMember(PARTNER_A, 'partner', '911111111111')
    await seedMember(PARTNER_B, 'partner', '911112222222')
    await seedMember(EMP_A, 'employee', '911113333333')

    const inviteBase = {
      displayName: 'Emp',
      addedByUid: OWNER_A,
      addedByName: 'Owner A',
      createdAt: 1,
    }
    await setDoc(doc(db, 'invites', CODE_UNUSED), {
      ...inviteBase,
      code: CODE_UNUSED,
      bizId: BIZ_A,
      role: 'employee',
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
      role: 'employee',
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
      role: 'employee',
      assignedPhone: '+919994445555',
      phoneKey: PK_CLAIM_OK,
      status: 'unused',
      claimedByUid: null,
      claimedAt: null,
    })
    await setDoc(doc(db, 'invites', CODE_PARTNER_OK), {
      ...inviteBase,
      code: CODE_PARTNER_OK,
      bizId: BIZ_A,
      role: 'partner',
      assignedPhone: '+919996667777',
      phoneKey: PK_PARTNER_OK,
      status: 'unused',
      claimedByUid: null,
      claimedAt: null,
    })
    // An activity entry to prove manager-only reads.
    await setDoc(doc(db, 'businesses', BIZ_A, 'activity', 'act1'), {
      id: 'act1',
      type: 'bill-create',
      actorUid: OWNER_A,
      actorPhone: '+911110000000',
      actorName: 'Owner A',
      at: 1,
      summary: 'Created a bill',
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

describe('(a) invites LIST is manager-only (no cross-tenant enumeration)', () => {
  it('a signed-in OUTSIDER cannot list a business’s invites', async () => {
    const db = testEnv.authenticatedContext(OUTSIDER).firestore()
    await assertFails(
      getDocs(query(collection(db, 'invites'), where('bizId', '==', BIZ_A), where('status', '==', 'unused'))),
    )
  })

  it('an EMPLOYEE cannot list a business’s invites', async () => {
    const db = testEnv.authenticatedContext(EMP_A).firestore()
    await assertFails(
      getDocs(query(collection(db, 'invites'), where('bizId', '==', BIZ_A), where('status', '==', 'unused'))),
    )
  })

  it('a PARTNER CAN list their business’s invites', async () => {
    const db = testEnv.authenticatedContext(PARTNER_A).firestore()
    await assertSucceeds(
      getDocs(query(collection(db, 'invites'), where('bizId', '==', BIZ_A), where('status', '==', 'unused'))),
    )
  })

  it('the OWNER CAN list their business’s invites', async () => {
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

describe('(c) claim-create requires a matching UNUSED invite of the SAME role', () => {
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

  it('role mismatch — member role:partner against an EMPLOYEE invite → denied', async () => {
    const attacker = 'emp-role-escalate-uid'
    const db = testEnv.authenticatedContext(attacker).firestore()
    await assertFails(
      setDoc(
        doc(db, 'businesses', BIZ_A, 'members', attacker),
        memberDocData(attacker, { role: 'partner', inviteCode: CODE_UNUSED, phoneKey: PK_UNUSED }),
      ),
    )
  })

  it('role mismatch — member role:employee against a PARTNER invite → denied', async () => {
    const attacker = 'partner-downgrade-uid'
    const db = testEnv.authenticatedContext(attacker).firestore()
    await assertFails(
      setDoc(
        doc(db, 'businesses', BIZ_A, 'members', attacker),
        memberDocData(attacker, { role: 'employee', inviteCode: CODE_PARTNER_OK, phoneKey: PK_PARTNER_OK }),
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
    batch.set(
      doc(db, 'invites', CODE_CLAIM_OK),
      { status: 'claimed', claimedByUid: emp, claimedAt: 6 },
      { merge: true },
    )
    batch.set(
      doc(db, 'businesses', BIZ_A, 'members', emp),
      memberDocData(emp, { role: 'employee', inviteCode: CODE_CLAIM_OK, phoneKey: PK_CLAIM_OK }),
    )
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

  it('PARTNER claim with a matching UNUSED partner invite (full claim batch) succeeds', async () => {
    const partner = 'partner-ok-uid'
    const db = testEnv.authenticatedContext(partner).firestore()
    const batch = writeBatch(db)
    batch.set(
      doc(db, 'invites', CODE_PARTNER_OK),
      { status: 'claimed', claimedByUid: partner, claimedAt: 7 },
      { merge: true },
    )
    batch.set(
      doc(db, 'businesses', BIZ_A, 'members', partner),
      memberDocData(partner, { role: 'partner', inviteCode: CODE_PARTNER_OK, phoneKey: PK_PARTNER_OK }),
    )
    batch.set(doc(db, 'users', partner), {
      uid: partner,
      bizId: BIZ_A,
      role: 'partner',
      phone: '+919996667777',
      email: 'partner@example.com',
      displayName: 'Partner',
      updatedAt: 7,
    })
    await assertSucceeds(batch.commit())
  })
})

describe('(e) partner parity — create invites, cancel, read activity', () => {
  it('a partner CAN create an EMPLOYEE invite', async () => {
    const db = testEnv.authenticatedContext(PARTNER_A).firestore()
    await assertSucceeds(
      setDoc(doc(db, 'invites', 'PEMP34'), {
        code: 'PEMP34',
        bizId: BIZ_A,
        role: 'employee',
        assignedPhone: '+919997778888',
        phoneKey: '919997778888',
        displayName: '',
        addedByUid: PARTNER_A,
        addedByName: 'Partner A',
        status: 'unused',
        claimedByUid: null,
        createdAt: 8,
        claimedAt: null,
      }),
    )
  })

  it('a partner CAN create a PARTNER invite', async () => {
    const db = testEnv.authenticatedContext(PARTNER_A).firestore()
    await assertSucceeds(
      setDoc(doc(db, 'invites', 'PPRT34'), {
        code: 'PPRT34',
        bizId: BIZ_A,
        role: 'partner',
        assignedPhone: '+919998889999',
        phoneKey: '919998889999',
        displayName: '',
        addedByUid: PARTNER_A,
        addedByName: 'Partner A',
        status: 'unused',
        claimedByUid: null,
        createdAt: 8,
        claimedAt: null,
      }),
    )
  })

  it('a partner CAN cancel (delete) an unused invite', async () => {
    const db = testEnv.authenticatedContext(PARTNER_A).firestore()
    await assertSucceeds(deleteDoc(doc(db, 'invites', CODE_UNUSED)))
  })

  it('a partner CAN read the activity log', async () => {
    const db = testEnv.authenticatedContext(PARTNER_A).firestore()
    await assertSucceeds(getDoc(doc(db, 'businesses', BIZ_A, 'activity', 'act1')))
  })

  it('an EMPLOYEE cannot read the activity log', async () => {
    const db = testEnv.authenticatedContext(EMP_A).firestore()
    await assertFails(getDoc(doc(db, 'businesses', BIZ_A, 'activity', 'act1')))
  })
})

describe('(f) removal matrix — non-owner targets only', () => {
  it('a partner CAN remove an employee member', async () => {
    const db = testEnv.authenticatedContext(PARTNER_A).firestore()
    await assertSucceeds(deleteDoc(doc(db, 'businesses', BIZ_A, 'members', EMP_A)))
  })

  it('a partner CAN remove another partner member', async () => {
    const db = testEnv.authenticatedContext(PARTNER_A).firestore()
    await assertSucceeds(deleteDoc(doc(db, 'businesses', BIZ_A, 'members', PARTNER_B)))
  })

  it('a partner CANNOT remove an owner member', async () => {
    const db = testEnv.authenticatedContext(PARTNER_A).firestore()
    await assertFails(deleteDoc(doc(db, 'businesses', BIZ_A, 'members', OWNER_A)))
  })

  it('an owner CAN remove a partner member', async () => {
    const db = testEnv.authenticatedContext(OWNER_A).firestore()
    await assertSucceeds(deleteDoc(doc(db, 'businesses', BIZ_A, 'members', PARTNER_A)))
  })

  it('an employee CANNOT remove another member', async () => {
    const db = testEnv.authenticatedContext(EMP_A).firestore()
    await assertFails(deleteDoc(doc(db, 'businesses', BIZ_A, 'members', PARTNER_B)))
  })
})

describe('(g) business profile write stays OWNER-only', () => {
  it('a partner CANNOT write businesses/{bizId} (profile stays owner-only)', async () => {
    const db = testEnv.authenticatedContext(PARTNER_A).firestore()
    await assertFails(updateDoc(doc(db, 'businesses', BIZ_A), { shopName: 'Hacked Traders' }))
  })

  it('an owner CAN write businesses/{bizId}', async () => {
    const db = testEnv.authenticatedContext(OWNER_A).firestore()
    await assertSucceeds(updateDoc(doc(db, 'businesses', BIZ_A), { shopName: 'A Traders Updated' }))
  })
})
