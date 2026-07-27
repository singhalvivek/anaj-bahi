'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import type { Bill } from '@/lib/db/schema'
import { todayIso } from '@/lib/calc'
import { dayRollup } from '@/lib/reports/rollup'
import { formatRupeesIndian } from '@/lib/reports/format'

/**
 * Phase 12 — the close-of-day line on home: ONE compact secondary line for today
 * (`Today · 3 bills · ₹7,689 bought · ₹6,742 paid · ₹1,201 pending`), so home reads
 * as one hero block (the month strip) plus one supporting line — never eight tiles.
 *
 * The WHOLE line is a single tap target → /rollup?metric=bought-today (four
 * sub-targets would each fall under 48 px). `today-paid` / `today-pending` have no
 * drill-down of their own by decision: `paid-month` and `due-all` are strict
 * supersets containing the same bills.
 *
 * `paid(today)` counts payments by the PAYMENT's own date over ALL bills, so it may
 * legitimately exceed `bought(today)` (he can settle old bills today) — that is not
 * a bug. `pending(today)` is clamped per bill, so an overpaid bill contributes 0.
 *
 * `bills === undefined` → skeleton, never a misleading ₹0. With no bills entered
 * today the figures still render (money may still have moved today) plus the warm
 * `today-empty` line. Every figure carries a numeric `data-amount`, the count a
 * numeric `data-count`.
 */
export function TodayLine({ bills }: { bills: Bill[] | undefined }) {
  const { t } = useI18n()

  const today = todayIso()
  const rollup = useMemo(() => (bills ? dayRollup(bills, today) : undefined), [bills, today])

  if (rollup === undefined) {
    // Not loaded yet — a skeleton bar matching the home list's, never ₹0.
    return <div className="h-16 animate-pulse rounded-2xl bg-stone-200" aria-hidden />
  }

  return (
    <Link
      href="/rollup?metric=bought-today"
      data-testid="today-card"
      className="flex min-h-[56px] flex-col justify-center gap-1 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm active:bg-stone-50"
    >
      <span className="text-sm font-semibold text-stone-600">{t('rollup.today.title')}</span>

      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base font-semibold tabular-nums text-stone-800">
        <span data-testid="today-count" data-count={rollup.billCount}>
          {rollup.billCount} <Label>{t('rollup.bills')}</Label>
        </span>
        <Dot />
        <span data-testid="today-bought" data-amount={rollup.bought} className="text-green-700">
          {formatRupeesIndian(rollup.bought)} <Label>{t('rollup.bought')}</Label>
        </span>
        <Dot />
        <span data-testid="today-paid" data-amount={rollup.paid} className="text-green-700">
          {formatRupeesIndian(rollup.paid)} <Label>{t('rollup.paid')}</Label>
        </span>
        <Dot />
        <span data-testid="today-pending" data-amount={rollup.pending} className="text-amber-700">
          {formatRupeesIndian(rollup.pending)} <Label>{t('rollup.pending')}</Label>
        </span>
      </p>

      {rollup.billCount === 0 && (
        <span data-testid="today-empty" className="text-sm text-stone-500">
          {t('rollup.today.empty')}
        </span>
      )}
    </Link>
  )
}

/** Small muted word next to a figure (kept inside the figure's element on purpose). */
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-stone-500">{children}</span>
}

function Dot() {
  return (
    <span aria-hidden className="text-stone-300">
      ·
    </span>
  )
}
