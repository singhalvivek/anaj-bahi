'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useBills } from '@/lib/db/hooks'
import { listDueBills } from '@/lib/db/queries'
import type { Bill } from '@/lib/db/repo'
import { billBalance, todayIso } from '@/lib/calc'
import { formatRupees, formatDate } from '@/components/format'

/** One due/overdue bill card → tapping opens the bill detail. */
function DueRow({ bill }: { bill: Bill }) {
  const { t } = useI18n()
  const { outstanding } = billBalance(bill)
  return (
    <Link
      href={`/bill?id=${encodeURIComponent(bill.id)}`}
      data-testid="due-row"
      className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-sm active:bg-stone-50"
    >
      <div className="flex flex-col">
        <span className="font-semibold text-stone-900">{bill.farmerName}</span>
        {bill.farmerPlace ? (
          <span className="text-sm text-stone-500">{bill.farmerPlace}</span>
        ) : null}
        <span className="mt-1 text-xs text-stone-400">
          {bill.id} · {t('due.due')}: {bill.dueDate ? formatDate(bill.dueDate) : '—'}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-xs text-stone-400">{t('due.outstanding')}</span>
        <span className="text-lg font-bold text-amber-700">{formatRupees(outstanding)}</span>
      </div>
    </Link>
  )
}

export default function DuePage() {
  const { t } = useI18n()

  // Reactive: the live Firestore bill list re-renders on any payment/bill write,
  // and the pure grouping re-runs so a settled bill drops off the list immediately.
  const allBills = useBills()
  const buckets = useMemo(
    () => (allBills ? listDueBills(allBills, todayIso()) : undefined),
    [allBills],
  )

  if (buckets === undefined) {
    return (
      <div className="space-y-3 px-4 py-6">
        <div className="h-24 animate-pulse rounded-xl bg-stone-200" aria-hidden />
        <div className="h-24 animate-pulse rounded-xl bg-stone-200" aria-hidden />
      </div>
    )
  }

  const { overdue, dueSoon, upcoming } = buckets
  const empty = overdue.length === 0 && dueSoon.length === 0 && upcoming.length === 0

  return (
    <div data-testid="due-list" className="flex flex-col gap-6 px-4 py-6">
      <h2 className="text-xl font-bold text-stone-900">{t('due.title')}</h2>

      {empty ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl" aria-hidden>
            ✅
          </span>
          <p className="text-stone-500">{t('due.none')}</p>
          <Link
            href="/"
            className="rounded-full bg-green-700 px-5 py-2.5 text-sm font-semibold text-white"
          >
            {t('action.back')}
          </Link>
        </div>
      ) : (
        <>
          {overdue.length > 0 && (
            <section data-testid="due-overdue" className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-red-700">
                ⚠️ {t('due.overdue')} ({overdue.length})
              </h3>
              {overdue.map((bill) => (
                <DueRow key={bill.id} bill={bill} />
              ))}
            </section>
          )}

          {dueSoon.length > 0 && (
            <section data-testid="due-soon" className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-amber-700">
                ⏳ {t('due.soon')} ({dueSoon.length})
              </h3>
              {dueSoon.map((bill) => (
                <DueRow key={bill.id} bill={bill} />
              ))}
            </section>
          )}

          {upcoming.length > 0 && (
            <section data-testid="due-upcoming" className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-stone-600">
                📅 {t('due.upcoming')} ({upcoming.length})
              </h3>
              {upcoming.map((bill) => (
                <DueRow key={bill.id} bill={bill} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
