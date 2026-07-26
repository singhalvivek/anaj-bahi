'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import { useBills } from '@/lib/db/hooks'
import { subscribeUnsyncedBills } from '@/lib/db/sync-status'
import { billBalance, todayIso } from '@/lib/calc'
import {
  dayRollup,
  monthKeyOf,
  monthRollup,
  rollupContributions,
  type Contribution,
  type RollupMetric,
} from '@/lib/reports/rollup'
import { formatRupeesIndian, roundToRupee } from '@/lib/reports/format'
import { formatDate } from '@/components/format'

/**
 * Phase 12 — the drill-down / trust surface. He will not believe a total he cannot
 * check, so every figure on home taps through to exactly the bills behind it, and
 * the rows visibly add up to the headline:
 *
 *   Σ (rollup-row-amount data-amount) === rollup-headline data-amount
 *
 * That holds by construction, not by coincidence: each rollup total is DEFINED as
 * the sum of its already-rounded per-bill contributions (round first, then add —
 * he adds the column by hand, and a ₹1 mismatch would kill every number on screen).
 *
 * Query-param driven like /bill?id=, so it must be wrapped in <Suspense> for
 * `useSearchParams` under static export (see the default export below).
 */

/** `unsynced` is not a money metric — it is a count, handled by this page only. */
type PageMetric = RollupMetric | 'unsynced'

const METRICS: readonly string[] = [
  'bought-month',
  'paid-month',
  'due-all',
  'bought-today',
  'unsynced',
]

/** Unknown / missing metric falls back to `bought-month` (never a broken screen). */
function parseMetric(raw: string | null): PageMetric {
  return METRICS.includes(raw ?? '') ? (raw as PageMetric) : 'bought-month'
}

const TITLE_KEY: Record<PageMetric, string> = {
  'bought-month': 'rollup.title.boughtMonth',
  'paid-month': 'rollup.title.paidMonth',
  'due-all': 'rollup.title.dueAll',
  'bought-today': 'rollup.title.boughtToday',
  unsynced: 'rollup.title.unsynced',
}

function RollupScreen() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const metric = parseMetric(searchParams.get('metric'))
  const isUnsynced = metric === 'unsynced'

  // Reactive: the same live bill snapshot home reads — no new Firestore query, works
  // offline from the local cache. `undefined` = not loaded yet.
  const bills = useBills()
  const today = todayIso()
  const monthKey = monthKeyOf(today)

  // Which bills still have locally-pending writes (the `unsynced` metric only).
  const { user } = useAuth()
  const bizId = user?.bizId ?? null
  const [unsyncedIds, setUnsyncedIds] = useState<string[]>([])
  useEffect(() => {
    if (!isUnsynced || !bizId) {
      setUnsyncedIds([])
      return
    }
    return subscribeUnsyncedBills((state) => setUnsyncedIds(state.billIds))
  }, [isUnsynced, bizId])

  const view = useMemo(() => {
    if (!bills) return undefined

    if (metric === 'unsynced') {
      // Identification only — no sum invariant here (the headline is a COUNT). The row
      // figure is the bill's payable total so he can recognise which bills they are.
      const ids = new Set(unsyncedIds)
      const rows: Contribution[] = bills
        .filter((b) => ids.has(b.id))
        .map((b) => ({
          billId: b.id,
          farmerName: b.farmerName,
          farmerPlace: b.farmerPlace,
          date: b.purchaseDate,
          amount: roundToRupee(billBalance(b).total),
        }))
      return { rows, amount: undefined }
    }

    const rows = rollupContributions(bills, metric, { monthKey, today })
    const month = monthRollup(bills, monthKey)
    const day = dayRollup(bills, today)
    const amount =
      metric === 'bought-month'
        ? month.bought
        : metric === 'paid-month'
          ? month.paid
          : metric === 'due-all'
            ? month.dueAllTime
            : day.bought
    return { rows, amount }
  }, [bills, metric, monthKey, today, unsyncedIds])

  const tone = metric === 'due-all' ? 'text-amber-700' : 'text-green-700'

  return (
    <div data-testid="rollup-screen" className="flex flex-col">
      {/* Sub-header: back link + the metric's title (global chrome lives in the layout). */}
      <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-2.5">
        <Link
          href="/"
          className="flex h-11 min-w-11 items-center text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          ← {t('action.back')}
        </Link>
        <h2 className="text-lg font-bold text-stone-900">{t(TITLE_KEY[metric])}</h2>
      </div>

      {view === undefined ? (
        // Not loaded yet — skeletons, never a misleading ₹0.
        <div className="flex flex-col gap-3 p-4" aria-hidden>
          <div className="h-24 animate-pulse rounded-2xl bg-stone-200" />
          <div className="h-20 animate-pulse rounded-xl bg-stone-200" />
          <div className="h-20 animate-pulse rounded-xl bg-stone-200" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {/* Headline + the honesty signal (bill count) + the trust note. */}
          <section className="flex flex-col gap-1 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            {isUnsynced ? (
              <span
                data-testid="rollup-headline"
                data-count={view.rows.length}
                className="text-3xl font-bold tabular-nums text-amber-700"
              >
                {view.rows.length}
              </span>
            ) : (
              <span
                data-testid="rollup-headline"
                data-amount={view.amount ?? 0}
                className={`text-3xl font-bold tabular-nums ${tone}`}
              >
                {formatRupeesIndian(view.amount ?? 0)}
              </span>
            )}

            <span data-testid="rollup-count" data-count={view.rows.length} className="text-sm text-stone-500">
              {view.rows.length} {t('rollup.bills')}
            </span>

            <p className={`text-xs ${isUnsynced ? 'text-amber-700' : 'text-stone-500'}`}>
              {isUnsynced ? t('unsynced.hint') : t('rollup.addsUp')}
            </p>
          </section>

          {view.rows.length === 0 ? (
            <p
              data-testid="rollup-empty"
              className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-stone-500"
            >
              {t('rollup.empty')}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {view.rows.map((row) => (
                <li key={row.billId}>
                  <Link
                    href={`/bill?id=${encodeURIComponent(row.billId)}`}
                    data-testid="rollup-row"
                    className="flex min-h-[64px] items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm active:bg-stone-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-stone-900">
                        {row.farmerName}
                        {row.farmerPlace ? (
                          <span className="font-normal text-stone-500"> · {row.farmerPlace}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-400">
                        {row.billId} · {formatDate(row.date)}
                      </p>
                    </div>
                    <span
                      data-testid="rollup-row-amount"
                      data-amount={row.amount}
                      className={`shrink-0 whitespace-nowrap text-lg font-bold tabular-nums ${tone}`}
                    >
                      {formatRupeesIndian(row.amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function RollupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3 p-4">
          <div className="h-24 animate-pulse rounded-2xl bg-stone-200" />
          <div className="h-20 animate-pulse rounded-xl bg-stone-200" />
        </div>
      }
    >
      <RollupScreen />
    </Suspense>
  )
}
