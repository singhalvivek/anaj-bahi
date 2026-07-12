'use client'

// The React auth surface the UI consumes: AuthProvider + useAuth().
// Implements the routing state machine over Firebase Auth + Firestore `users/{uid}`.
//
// Contract: architecture.md § Auth / session contract — lib/auth/context.tsx.
//
// Phase-6 scope note: this phase does NOT re-point lib/db/repo. The bill screens
// keep using the local Dexie store; wiring `setActiveBusiness(bizId)` into the
// repo is a Phase-7 task and is deliberately absent here.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/app'
import {
  AuthError,
  RECAPTCHA_CONTAINER_ID,
  mapAuthError,
  onFirebaseAuthChange,
  signOutUser,
  startPhoneSignIn as sessionStartPhoneSignIn,
  type AppUser,
  type ConfirmationHandle,
} from './session'
import { decideMembership, type MembershipDecision, type Role } from './membership'
import {
  claimEmployeeMembership,
  createBusiness,
  findMembershipByPhone,
  type NewBusinessInput,
} from '@/lib/tenancy/business'
import { setActiveBusiness, ensureSeeded } from '@/lib/db/repo'
import { migrateLocalToFirestore } from '@/lib/db/migrate'

export type AuthStatus = 'loading' | 'signed-out' | 'onboarding' | 'ready'

export interface AuthContextValue {
  status: AuthStatus
  user: AppUser | null
  startPhoneSignIn(phoneE164: string): Promise<void>
  confirmOtp(code: string): Promise<void>
  setDisplayName(name: string): Promise<void>
  chooseRole(role: Role): Promise<MembershipDecision>
  createOwnerBusiness(input: NewBusinessInput): Promise<void>
  joinAsEmployee(bizId: string): Promise<void>
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface StoredUserDoc {
  uid?: string
  phone?: string
  displayName?: string | null
  bizId?: string | null
  role?: Role | null
}

/** Load `users/{uid}`, creating a fresh record (storing the phone) on first sign-in. */
async function loadOrCreateUser(uid: string, phone: string): Promise<AppUser> {
  const ref = doc(firestore, 'users', uid)
  const snap = await getDoc(ref)
  const ts = Date.now()

  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      phone,
      displayName: null,
      bizId: null,
      role: null,
      createdAt: ts,
      updatedAt: ts,
    })
    return { uid, phone, displayName: null, bizId: null, role: null }
  }

  const data = snap.data() as StoredUserDoc
  // Backfill the phone if an older record somehow lacks it.
  if (!data.phone && phone) {
    await setDoc(ref, { phone, updatedAt: ts }, { merge: true })
  }
  return {
    uid,
    phone: data.phone ?? phone,
    displayName: data.displayName ?? null,
    bizId: data.bizId ?? null,
    role: (data.role ?? null) as Role | null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AppUser | null>(null)

  // Keep a ref to the latest user so async callbacks read a fresh value.
  const userRef = useRef<AppUser | null>(null)
  userRef.current = user

  // The pending OTP confirmation handle between startPhoneSignIn and confirmOtp.
  const confirmRef = useRef<ConfirmationHandle | null>(null)

  // Activate the ambient business scope for the data layer whenever a user is
  // ready, and (owner only) kick off the one-time local→cloud migration in the
  // background. Fire-and-forget: this must never gate `status` or block the UI.
  const activateBusinessScope = useCallback((u: AppUser) => {
    if (!u.bizId) return
    setActiveBusiness(u.bizId)
    // Seed the starter grain types into this business (idempotent) so the grain
    // picker is populated as soon as the user is in the business. Fire-and-forget.
    ensureSeeded().catch(() => {})
    if (u.role === 'owner') {
      migrateLocalToFirestore(u.bizId, u.uid).catch(() => {
        // Idempotent — a failure is retried on the next owner sign-in.
      })
    }
  }, [])

  const applyUser = useCallback(
    (u: AppUser) => {
      setUser(u)
      userRef.current = u
      if (u.bizId) {
        activateBusinessScope(u)
        setStatus('ready')
      } else {
        setStatus('onboarding')
      }
    },
    [activateBusinessScope],
  )

  const enterReady = useCallback(
    (u: AppUser, bizId: string, role: Role) => {
      const next: AppUser = { ...u, bizId, role }
      setUser(next)
      userRef.current = next
      activateBusinessScope(next)
      setStatus('ready')
    },
    [activateBusinessScope],
  )

  // Single source of truth for session state: react to Firebase auth changes.
  // Fires on initial load (LOCAL persistence → stays signed in across reloads),
  // after confirmOtp, and on sign-out.
  useEffect(() => {
    const unsub = onFirebaseAuthChange((uid, phone) => {
      if (!uid) {
        setActiveBusiness(null)
        userRef.current = null
        setUser(null)
        setStatus('signed-out')
        return
      }
      loadOrCreateUser(uid, phone ?? '')
        .then(applyUser)
        .catch(() => {
          // The sign-in is valid but the user doc read/create failed; keep the
          // user in onboarding so the UI can surface a retry rather than crash.
          setStatus('onboarding')
        })
    })
    return unsub
  }, [applyUser])

  const startPhoneSignIn = useCallback(async (phoneE164: string) => {
    confirmRef.current = await sessionStartPhoneSignIn(phoneE164, RECAPTCHA_CONTAINER_ID)
  }, [])

  const confirmOtp = useCallback(async (code: string) => {
    const handle = confirmRef.current
    if (!handle) throw new AuthError('auth/no-confirmation', 'auth.error.generic')
    await handle.confirm(code)
    confirmRef.current = null
    // The onFirebaseAuthChange listener now loads/creates users/{uid} and
    // transitions status (onboarding | ready).
  }, [])

  const setDisplayName = useCallback(async (name: string) => {
    const cur = userRef.current
    if (!cur) throw new AuthError('auth/not-signed-in', 'auth.error.generic')
    try {
      await setDoc(
        doc(firestore, 'users', cur.uid),
        { displayName: name, updatedAt: Date.now() },
        { merge: true },
      )
    } catch (err) {
      throw mapAuthError(err)
    }
    const next: AppUser = { ...cur, displayName: name }
    setUser(next)
    userRef.current = next
  }, [])

  const chooseRole = useCallback(
    async (role: Role): Promise<MembershipDecision> => {
      const cur = userRef.current
      if (!cur) throw new AuthError('auth/not-signed-in', 'auth.error.generic')

      const lookup = await findMembershipByPhone(cur.phone)
      const decision = decideMembership(
        role,
        lookup ? { bizId: lookup.bizId, role: lookup.role, status: lookup.status } : null,
      )

      if (decision.kind === 'owner') {
        // Returning owner recognised by membership — point users/{uid} at the biz.
        await setDoc(
          doc(firestore, 'users', cur.uid),
          { bizId: decision.bizId, role: 'owner', updatedAt: Date.now() },
          { merge: true },
        )
        enterReady(cur, decision.bizId, 'owner')
      } else if (decision.kind === 'employee-joined') {
        await claimEmployeeMembership(cur, decision.bizId)
        enterReady(cur, decision.bizId, 'employee')
      }
      // 'new' → UI shows CreateBusiness; 'employee-unadded' → UI shows AskOwner.
      return decision
    },
    [enterReady],
  )

  const createOwnerBusiness = useCallback(
    async (input: NewBusinessInput) => {
      const cur = userRef.current
      if (!cur) throw new AuthError('auth/not-signed-in', 'auth.error.generic')
      const bizId = await createBusiness(cur, input)
      enterReady(cur, bizId, 'owner')
    },
    [enterReady],
  )

  const joinAsEmployee = useCallback(
    async (bizId: string) => {
      const cur = userRef.current
      if (!cur) throw new AuthError('auth/not-signed-in', 'auth.error.generic')
      await claimEmployeeMembership(cur, bizId)
      enterReady(cur, bizId, 'employee')
    },
    [enterReady],
  )

  const signOut = useCallback(async () => {
    confirmRef.current = null
    await signOutUser()
    // The listener flips status to 'signed-out' and clears the user.
  }, [])

  const value: AuthContextValue = {
    status,
    user,
    startPhoneSignIn,
    confirmOtp,
    setDisplayName,
    chooseRole,
    createOwnerBusiness,
    joinAsEmployee,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Invisible reCAPTCHA target for phone sign-in. Mounted once, above the
          whole app, so `startPhoneSignIn` (RecaptchaVerifier on this id) always
          finds it — including before LoginScreen has rendered. Must NOT be
          `display:none` — invisible reCAPTCHA cannot initialize in a hidden
          container and `signInWithPhoneNumber` would hang. grecaptcha injects
          its own fixed-position badge; this container stays empty. */}
      <div id={RECAPTCHA_CONTAINER_ID} />
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
