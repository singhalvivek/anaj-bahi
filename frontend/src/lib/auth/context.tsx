'use client'

// The React auth surface the UI consumes: AuthProvider + useAuth().
// Implements the routing state machine over Firebase Auth (Google) + users/{uid}.
//
// Contract: architecture.md § Auth / session contract — lib/auth/context.tsx.
//
// Recognition is purely users/{uid}.bizId: on sign-in read the user doc — bizId set
// → 'ready' (straight into the app); else → 'onboarding'. There is no phone lookup.

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
  mapAuthError,
  onFirebaseAuthChange,
  signInWithGoogle as sessionSignInWithGoogle,
  signOutUser,
  type AppUser,
} from './session'
import { checkInvite, routeRole, type Role, type RoleRoute } from './membership'
import { createBusiness, type NewBusinessInput } from '@/lib/tenancy/business'
import { claimInvite, getInvite } from '@/lib/tenancy/invite'
import { setActiveBusiness, setActiveActor, ensureSeeded } from '@/lib/db/repo'
import { migrateLocalToFirestore } from '@/lib/db/migrate'

export type AuthStatus = 'loading' | 'signed-out' | 'onboarding' | 'ready'

export interface AuthContextValue {
  status: AuthStatus
  user: AppUser | null
  signInWithGoogle(): Promise<void>
  setDisplayName(name: string): Promise<void>
  chooseRole(role: Role): Promise<RoleRoute>
  createOwnerBusiness(input: NewBusinessInput): Promise<void>
  joinByCode(input: { code: string; phoneE164: string; name: string }): Promise<void>
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface StoredUserDoc {
  uid?: string
  email?: string | null
  phone?: string | null
  displayName?: string | null
  bizId?: string | null
  role?: Role | null
}

/**
 * Load `users/{uid}`, creating a fresh record on first sign-in with the Google
 * email + display name (prefilled, editable at onboarding) and a null phone (the
 * mobile is captured later at onboarding as profile data — never an auth factor).
 */
async function loadOrCreateUser(
  uid: string,
  email: string | null,
  googleName: string | null,
): Promise<AppUser> {
  const ref = doc(firestore, 'users', uid)
  const snap = await getDoc(ref)
  const ts = Date.now()

  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      email,
      phone: null,
      displayName: googleName ?? null,
      bizId: null,
      role: null,
      createdAt: ts,
      updatedAt: ts,
    })
    return { uid, email, phone: null, displayName: googleName ?? null, bizId: null, role: null }
  }

  const data = snap.data() as StoredUserDoc
  // Backfill the email if an older record somehow lacks it.
  if (!data.email && email) {
    await setDoc(ref, { email, updatedAt: ts }, { merge: true })
  }
  return {
    uid,
    email: data.email ?? email,
    phone: data.phone ?? null,
    displayName: data.displayName ?? googleName ?? null,
    bizId: data.bizId ?? null,
    role: (data.role ?? null) as Role | null,
  }
}

/**
 * Removal-safety: a ready user (bizId set) whose owner removed them still has their
 * `users/{uid}.bizId`, but is no longer in `businesses/{bizId}/members`. Confirm the
 * member doc still exists; if it is gone (a permission-denied read, since Rules gate
 * member reads on membership), clear our own `users/{uid}.{bizId, role}` (a permitted
 * self-write) and return to onboarding. Any OTHER read failure (offline/unavailable)
 * is treated as transient — keep the ready session and re-check on the next load.
 */
async function confirmMembershipOrClear(u: AppUser): Promise<AppUser> {
  if (!u.bizId) return u
  try {
    const memberSnap = await getDoc(doc(firestore, 'businesses', u.bizId, 'members', u.uid))
    if (memberSnap.exists()) return u
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code !== 'permission-denied') return u // transient — stay ready, offline-safe
  }
  // Removed by the owner — drop our pointer and re-onboard.
  try {
    await setDoc(
      doc(firestore, 'users', u.uid),
      { bizId: null, role: null, updatedAt: Date.now() },
      { merge: true },
    )
  } catch {
    // Best-effort: even if the clear write fails, drop bizId locally so the UI
    // routes to onboarding rather than a broken ready screen whose reads Rules reject.
  }
  return { ...u, bizId: null, role: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AppUser | null>(null)

  // Keep a ref to the latest user so async callbacks read a fresh value.
  const userRef = useRef<AppUser | null>(null)
  userRef.current = user

  // Activate the ambient business scope for the data layer whenever a user is
  // ready, and (owner only) kick off the one-time local→cloud migration in the
  // background. Fire-and-forget: this must never gate `status` or block the UI.
  const activateBusinessScope = useCallback((u: AppUser) => {
    if (!u.bizId) return
    setActiveBusiness(u.bizId)
    // Stamp the acting member so repo writes (createBill/addPayment) are attributed
    // to them. Name is a snapshot; it refreshes on rename below. phone may be null.
    setActiveActor({ uid: u.uid, phone: u.phone ?? '', name: u.displayName ?? '' })
    // Seed the starter grain types into this business (idempotent). Fire-and-forget.
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
  // after signInWithGoogle, and on sign-out.
  useEffect(() => {
    const unsub = onFirebaseAuthChange((info) => {
      if (!info) {
        setActiveBusiness(null)
        setActiveActor(null)
        userRef.current = null
        setUser(null)
        setStatus('signed-out')
        return
      }
      loadOrCreateUser(info.uid, info.email, info.displayName)
        .then(confirmMembershipOrClear)
        .then(applyUser)
        .catch(() => {
          // The sign-in is valid but the user doc read/create failed; keep the
          // user in onboarding so the UI can surface a retry rather than crash.
          setStatus('onboarding')
        })
    })
    return unsub
  }, [applyUser])

  const signInWithGoogle = useCallback(async () => {
    await sessionSignInWithGoogle()
    // The onFirebaseAuthChange listener loads/creates users/{uid} and sets status.
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
    // If a business is active, refresh the attribution snapshot so subsequent
    // bills/payments carry the new name (past writes keep the old one).
    if (next.bizId) {
      setActiveActor({ uid: next.uid, phone: next.phone ?? '', name })
    }
  }, [])

  // The role chooser is a pure local route now (no phone→business lookup):
  // 'owner' → create-business, 'employee' → JoinByCode. Async signature kept to
  // match the frozen context contract.
  const chooseRole = useCallback(async (role: Role): Promise<RoleRoute> => {
    return routeRole(role)
  }, [])

  const createOwnerBusiness = useCallback(
    async (input: NewBusinessInput) => {
      const cur = userRef.current
      if (!cur) throw new AuthError('auth/not-signed-in', 'auth.error.generic')
      // The owner's create form captures their mobile as profile data.
      const owner: AppUser = input.phone ? { ...cur, phone: input.phone } : cur
      const bizId = await createBusiness(owner, input)
      enterReady(owner, bizId, 'owner')
    },
    [enterReady],
  )

  const joinByCode = useCallback(
    async (input: { code: string; phoneE164: string; name: string }) => {
      const cur = userRef.current
      if (!cur) throw new AuthError('auth/not-signed-in', 'auth.error.generic')
      // The employee's name (prefilled from Google, editable) is threaded onto the
      // user so claimInvite writes it into members + users.
      const named: AppUser = { ...cur, displayName: input.name, phone: input.phoneE164 }

      // Defensive re-validation of the frozen invite check (the UI validates too,
      // for its two-step distinct errors).
      const invite = await getInvite(input.code)
      const check = checkInvite(invite, input.phoneE164)
      if (check.kind === 'phone-mismatch') {
        throw new AuthError('invite/phone-mismatch', 'onboarding.join.phoneMismatch')
      }
      if (check.kind !== 'ok') {
        throw new AuthError('invite/not-found', 'onboarding.join.notFound')
      }

      await claimInvite(named, input.code, input.phoneE164)
      enterReady(named, check.bizId, 'employee')
    },
    [enterReady],
  )

  const signOut = useCallback(async () => {
    await signOutUser()
    // The listener flips status to 'signed-out' and clears the user.
  }, [])

  const value: AuthContextValue = {
    status,
    user,
    signInWithGoogle,
    setDisplayName,
    chooseRole,
    createOwnerBusiness,
    joinByCode,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
