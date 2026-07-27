'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useBills } from '@/lib/db/hooks'
import { listDueBills } from '@/lib/db/queries'
import { setBillDueDate, type Bill } from '@/lib/db/repo'
import { addDaysIso, billBalance, todayIso } from '@/lib/calc'
import { formatRupees, formatDate } from '@/components/format'

/** Matches the entry forms' pre-fill, so a repaired bill gets the same default. */
const DUE_DAYS = 15

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

/**
 * A legacy (pre-Phase-12) bill that still owes money but carries no due date.
 * It cannot be dated through the normal edit form once it has a payment — the
 * edit-lock refuses — so the repair happens inline here via `setBillDueDate`,
 * which touches only `dueDate` and is deliberately not lock-gated.
 *
 * On success the live snapshot re-runs `listDueBills`, the bill gains a date and
 * moves itself into one of the three dated buckets, so this row simply vanishes.
 */
function NoDueDateRow({ bill }: { bill: Bill }) {
  const { t } = useI18n()
  const { outstanding } = billBalance(bill)
  const [date, setDate] = useState(() => addDaysIso(bill.purchaseDate, DUE_DAYS))
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  async function save() {
    if (!date || saving) return
    setSaving(true)
    setFailed(false)
    try {
      await setBillDueDate(bill.id, date)
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/bill?id=${encodeURIComponent(bill.id)}`} className="min-w-0">
          <span className="block font-semibold text-stone-900">{bill.farmerName}</span>
          {bill.farmerPlace ? (
            <span className="block text-sm text-stone-500">{bill.farmerPlace}</span>
          ) : null}
          <span className="mt-1 block text-xs text-stone-400">
            {bill.id} · {formatDate(bill.purchaseDate)}
          </span>
        </Link>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-xs text-stone-400">{t('due.outstanding')}</span>
          <span className="text-lg font-bold text-stone-700">{formatRupees(outstanding)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          data-testid="due-set-date-input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 min-w-0 flex-1 rounded-lg border border-stone-300 px-3 text-base focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="button"
          data-testid="due-set-date-btn"
          onClick={save}
          disabled={!date || saving}
          className="h-12 shrink-0 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white active:bg-emerald-800 disabled:opacity-50"
        >
          {t('due.setDate')}
        </button>
      </div>
      {failed ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {t('error.generic')}
        </p>
      ) : null}
    </div>
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

  const { overdue, dueSoon, upcoming, noDueDate } = buckets
  // Phase 12 — the screen is only empty when the legacy bucket is empty too.
  const empty =
    overdue.length === 0 &&
    dueSoon.length === 0 &&
    upcoming.length === 0 &&
    noDueDate.length === 0

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

          {/* Phase 12 - legacy rows with no due date. Visually distinct from the
              three dated buckets: these are not "due", they are un-dated money
              that would otherwise be invisible. Drains to empty as they are set. */}
          {noDueDate.length > 0 && (
            <section
              data-testid="due-no-date"
              className="flex flex-col gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3"
            >
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-stone-700">
                  📄 {t('due.noDate')} ({noDueDate.length})
                </h3>
                <p className="mt-1 text-sm text-stone-500">{t('due.noDate.hint')}</p>
              </div>
              {noDueDate.map((bill) => (
                <NoDueDateRow key={bill.id} bill={bill} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
