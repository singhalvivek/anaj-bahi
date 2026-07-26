'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import type { Bill } from '@/lib/db/schema'
import { todayIso } from '@/lib/calc'
import { monthKeyOf, monthRollup } from '@/lib/reports/rollup'
import { formatRupeesIndian } from '@/lib/reports/format'

/**
 * Phase 12 — the "This month" hero strip on home: the first figures in the app
 * that span more than one bill.
 *
 * Three big, Indian-grouped, WHOLE-rupee numbers, each its own ≥48 px tap target
 * drilling into the bills behind it (he will not believe a total he cannot check):
 *   month-bought → /rollup?metric=bought-month   (bills whose purchaseDate is this month)
 *   month-paid   → /rollup?metric=paid-month     (payments DATED this month, over ALL bills)
 *   month-due    → /rollup?metric=due-all        (ALL-TIME outstanding, clamped per bill)
 *
 * `month-due` is deliberately labelled "Due (all)" / `rollup.due`: it is all-time
 * exposure, not the month's — that scope lives on the label, never re-scoped here.
 *
 * `bills === undefined` means "not loaded yet" → skeleton bars, NEVER a misleading
 * ₹0 (a real zero and an unloaded zero must not look the same). A month that
 * genuinely has no bills shows ₹0 plus the warm `month-empty` line — never blank,
 * and never some other month's numbers silently substituted in.
 *
 * Every figure carries a numeric `data-amount` (whole rupees) so tests assert
 * values without parsing grouped, translated text.
 */
export function MonthStrip({ bills }: { bills: Bill[] | undefined }) {
  const { t } = useI18n()

  // Current calendar month, decided by an ISO string prefix (no Date, no timezone risk).
  const monthKey = monthKeyOf(todayIso())
  const rollup = useMemo(
    () => (bills ? monthRollup(bills, monthKey) : undefined),
    [bills, monthKey],
  )

  return (
    <section
      data-testid="month-strip"
      className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-stone-600">{t('rollup.month.title')}</h2>

      {rollup === undefined ? (
        // Not loaded yet — skeletons, never ₹0.
        <div className="flex gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 flex-1 animate-pulse rounded-xl bg-stone-200" />
          ))}
        </div>
      ) : (
        <>
          {/* flex-wrap + a content-driven minimum: three grouped figures that will not
              fit one row wrap to a second row rather than shrinking the type. */}
          <div className="flex flex-wrap gap-2">
            <MonthFigure
              testid="month-bought"
              label={t('rollup.bought')}
              amount={rollup.bought}
              href="/rollup?metric=bought-month"
            />
            <MonthFigure
              testid="month-paid"
              label={t('rollup.paid')}
              amount={rollup.paid}
              href="/rollup?metric=paid-month"
            />
            <MonthFigure
              testid="month-due"
              label={t('rollup.due')}
              amount={rollup.dueAllTime}
              href="/rollup?metric=due-all"
              tone="warn"
            />
          </div>

          {rollup.billCount === 0 && (
            <p data-testid="month-empty" className="text-sm text-stone-500">
              {t('rollup.month.empty')}
            </p>
          )}
        </>
      )}
    </section>
  )
}

/** One tappable month figure: small label above, big whole-rupee number below. */
function MonthFigure({
  testid,
  label,
  amount,
  href,
  tone = 'money',
}: {
  testid: string
  label: string
  amount: number
  href: string
  tone?: 'money' | 'warn'
}) {
  return (
    <Link
      href={href}
      data-testid={testid}
      data-amount={amount}
      className="flex min-h-[64px] flex-1 basis-[5.5rem] flex-col justify-center gap-0.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 active:bg-stone-100"
    >
      <span className="text-xs font-medium text-stone-500">{label}</span>
      <span
        className={`whitespace-nowrap text-xl font-bold tabular-nums ${
          tone === 'warn' ? 'text-amber-700' : 'text-green-700'
        }`}
      >
        {formatRupeesIndian(amount)}
      </span>
    </Link>
  )
}
