'use client'

// Reactive reads over the business-scoped Firestore store. These replace the
// retired dexie-react-hooks `useLiveQuery` for synced entities. Each hook
// subscribes with `onSnapshot` (business-scoped), re-subscribes when the active
// business changes, and cleans up on unmount / bizId-change.
//
// Local-first: `onSnapshot` serves the local persistence cache first (instantly,
// even offline) and streams cloud updates as they arrive; nothing blocks on the
// network. `undefined` = "not loaded yet"; an array = loaded (possibly empty).

import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/app'
import { useAuth } from '@/lib/auth/context'
import type { ActivityEntry, Bill, Farmer, GrainType } from './schema'

// Mirror the repo's bill-id sanitize: `DDMMYY/xxxxx` → doc id with `/` → `_`.
function billDocId(billId: string): string {
  return billId.replace(/\//g, '_')
}

/** Live list of all bills, newest first. `undefined` until first snapshot. */
export function useBills(): Bill[] | undefined {
  const { user } = useAuth()
  const bizId = user?.bizId ?? null
  const [bills, setBills] = useState<Bill[] | undefined>(undefined)

  useEffect(() => {
    if (!bizId) {
      setBills(undefined)
      return
    }
    setBills(undefined)
    const col = collection(firestore, 'businesses', bizId, 'bills')
    const unsub = onSnapshot(
      col,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as Bill)
        rows.sort((a, b) => b.createdAt - a.createdAt)
        setBills(rows)
      },
      () => setBills([]),
    )
    return unsub
  }, [bizId])

  return bills
}

/** Live single bill by id (`DDMMYY/xxxxx`). `undefined` until loaded / when absent. */
export function useBill(id: string | null): Bill | undefined {
  const { user } = useAuth()
  const bizId = user?.bizId ?? null
  const [bill, setBill] = useState<Bill | undefined>(undefined)

  useEffect(() => {
    if (!bizId || !id) {
      setBill(undefined)
      return
    }
    setBill(undefined)
    const ref = doc(firestore, 'businesses', bizId, 'bills', billDocId(id))
    const unsub = onSnapshot(
      ref,
      (snap) => setBill(snap.exists() ? (snap.data() as Bill) : undefined),
      () => setBill(undefined),
    )
    return unsub
  }, [bizId, id])

  return bill
}

/** Live list of farmers, name-ascending. `undefined` until first snapshot. */
export function useFarmers(): Farmer[] | undefined {
  const { user } = useAuth()
  const bizId = user?.bizId ?? null
  const [farmers, setFarmers] = useState<Farmer[] | undefined>(undefined)

  useEffect(() => {
    if (!bizId) {
      setFarmers(undefined)
      return
    }
    setFarmers(undefined)
    const col = collection(firestore, 'businesses', bizId, 'farmers')
    const unsub = onSnapshot(
      col,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as Farmer)
        rows.sort((a, b) => a.name.localeCompare(b.name))
        setFarmers(rows)
      },
      () => setFarmers([]),
    )
    return unsub
  }, [bizId])

  return farmers
}

/**
 * Live, newest-first owner-only activity log (Phase 9). `undefined` until the first
 * snapshot; an array once loaded (possibly empty).
 *
 * FAIL-SAFE FOR EMPLOYEES: reading `activity` is OWNERS-only in Security Rules, so an
 * employee's `onSnapshot` listener errors with permission-denied. The error handler
 * treats that as an empty log (`setActivity([])`) and NEVER throws — the owner-only
 * Activity screen (slice-b) is the sole caller and is hidden from employees, but this
 * hook must degrade gracefully if ever mounted by a non-owner.
 */
export function useActivity(): ActivityEntry[] | undefined {
  const { user } = useAuth()
  const bizId = user?.bizId ?? null
  const [activity, setActivity] = useState<ActivityEntry[] | undefined>(undefined)

  useEffect(() => {
    if (!bizId) {
      setActivity(undefined)
      return
    }
    setActivity(undefined)
    const col = collection(firestore, 'businesses', bizId, 'activity')
    const unsub = onSnapshot(
      col,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as ActivityEntry)
        rows.sort((a, b) => b.at - a.at) // newest-first
        setActivity(rows)
      },
      // Permission-denied (employee) or any listen error → fail safe to empty log.
      () => setActivity([]),
    )
    return unsub
  }, [bizId])

  return activity
}

/** Live list of grain types, createdAt-ascending. `undefined` until first snapshot. */
export function useGrainTypes(): GrainType[] | undefined {
  const { user } = useAuth()
  const bizId = user?.bizId ?? null
  const [grainTypes, setGrainTypes] = useState<GrainType[] | undefined>(undefined)

  useEffect(() => {
    if (!bizId) {
      setGrainTypes(undefined)
      return
    }
    setGrainTypes(undefined)
    const col = collection(firestore, 'businesses', bizId, 'grainTypes')
    const unsub = onSnapshot(
      col,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as GrainType)
        rows.sort((a, b) => a.createdAt - b.createdAt)
        setGrainTypes(rows)
      },
      () => setGrainTypes([]),
    )
    return unsub
  }, [bizId])

  return grainTypes
}
