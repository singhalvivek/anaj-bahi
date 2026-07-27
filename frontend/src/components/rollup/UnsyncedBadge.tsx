'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import { subscribeUnsyncedBills } from '@/lib/db/sync-status'

/**
 * ANTI-FLICKER (Phase 12, owned here — `lib/db/sync-status` stays a plain,
 * undebounced subscription because the Settings indicator wants the raw signal).
 *
 * Firestore marks a write locally-pending for a moment on EVERY save, even fully
 * online. Without this delay each save would flash a scary "not backed up yet"
 * warning — which would train the trader to ignore the one warning that actually
 * matters. So the badge SHOWS only after `count > 0` has held continuously for this
 * long, and HIDES immediately at 0.
 */
const UNSYNCED_BADGE_DELAY_MS = 1500

/**
 * Phase 12 — the "not backed up yet" badge, topmost on home, rendered ONLY when the
 * unsynced bill count is > 0. It turns the one real data-loss risk from *silent and
 * unknown in scope* into *visible and countable*: the scary part of losing the phone
 * is not the loss, it is not knowing WHICH bills were lost.
 *
 * Clears only at zero — no dismiss, no snooze. Taps through to
 * /rollup?metric=unsynced, which names the exact bills. Works fully offline:
 * pending-write metadata is local and costs no extra document read.
 */
export function UnsyncedBadge() {
  const { t } = useI18n()

  // Re-subscribe if the active business changes (the subscription is scoped to the
  // business active at call time).
  const { user } = useAuth()
  const bizId = user?.bizId ?? null

  const [count, setCount] = useState(0) // raw signal
  const [shownCount, setShownCount] = useState(0) // debounced, what the badge displays

  useEffect(() => {
    if (!bizId) {
      setCount(0)
      return
    }
    // Never throws; reports { count: 0 } on a listen error.
    return subscribeUnsyncedBills((state) => setCount(state.count))
  }, [bizId])

  useEffect(() => {
    // Zero → hide immediately (backed up is good news; show it at once).
    if (count === 0) {
      setShownCount(0)
      return
    }
    // Non-zero → only surface once it has held for the full delay. Re-armed on every
    // count change and cleaned up on unmount.
    const timer = setTimeout(() => setShownCount(count), UNSYNCED_BADGE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [count])

  if (shownCount === 0) return null

  return (
    <Link
      href="/rollup?metric=unsynced"
      data-testid="unsynced-badge"
      data-count={shownCount}
      className="flex min-h-[48px] flex-col gap-0.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 active:bg-amber-100"
    >
      <span className="text-base font-bold text-amber-800">
        ⚠️ {shownCount} {t('unsynced.bills')}
      </span>
      <span className="text-xs text-amber-700">{t('unsynced.hint')}</span>
      <span className="text-xs font-semibold text-amber-900 underline">
        {t('unsynced.tapToSee')}
      </span>
    </Link>
  )
}
