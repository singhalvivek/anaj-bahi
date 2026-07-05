'use client'

import { useI18n } from '@/lib/i18n/context'

interface LiveTotalsProps {
  billTotal: number
}

/** Sticky bill total near the bottom; updates on every keystroke. */
export function LiveTotals({ billTotal }: LiveTotalsProps) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-between rounded-xl bg-emerald-600 px-4 py-3 text-white shadow-lg">
      <span className="text-base font-medium">{t('totals.billTotal')}</span>
      <span data-testid="bill-total" className="text-xl font-bold">
        ₹{billTotal.toFixed(2)}
      </span>
    </div>
  )
}
