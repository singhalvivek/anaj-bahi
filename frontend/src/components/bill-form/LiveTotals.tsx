'use client'

import { useI18n } from '@/lib/i18n/context'

interface LiveTotalsProps {
  billTotal: number // NET payable total (after paldari)
  paldari?: number // Phase 10 — labor charge borne by the farmer (₹); > 0 → shown as a deduction row
}

/**
 * Live bill total shown at the end of the form (in normal flow); updates on every keystroke.
 * Phase 10 — `billTotal` is the NET payable total (after paldari). When a paldari charge is
 * entered, a subtle subtotal + paldari-deduction breakdown renders above the green total.
 */
export function LiveTotals({ billTotal, paldari }: LiveTotalsProps) {
  const { t } = useI18n()
  const hasPaldari = !!paldari && paldari > 0
  return (
    <div className="space-y-1.5">
      {hasPaldari && (
        <div className="space-y-0.5 rounded-lg bg-stone-50 px-4 py-2 text-sm">
          <div className="flex items-center justify-between text-stone-600">
            <span>{t('totals.subtotal')}</span>
            <span className="font-medium">₹{(billTotal + paldari).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-stone-600">
            <span>{t('paldari.short')}</span>
            <span data-testid="paldari-line" className="font-medium text-amber-700">
              −₹{paldari.toFixed(2)}
            </span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between rounded-xl bg-emerald-600 px-4 py-3 text-white shadow-lg">
        <span className="text-base font-medium">{t('totals.billTotal')}</span>
        <span data-testid="bill-total" className="text-xl font-bold">
          ₹{billTotal.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
