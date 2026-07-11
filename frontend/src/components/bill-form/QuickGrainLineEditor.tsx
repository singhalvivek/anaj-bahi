'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { GrainType } from '@/lib/db/repo'
import type { GrainLineTotals } from '@/lib/calc'
import type { QuickGrainLineDraft } from '@/app/bills/quick/page'

interface QuickGrainLineEditorProps {
  index: number
  line: QuickGrainLineDraft
  grainTypes: GrainType[]
  totals: GrainLineTotals
  canRemove: boolean
  onChange: (line: QuickGrainLineDraft) => void
  onRemove: () => void
  onAddCustomGrain: (nameEn: string, nameHi: string) => Promise<GrainType>
}

/** Keep digits and at most one decimal point. */
function sanitizeDecimal(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, '')
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
  }
  return s
}

/** Keep digits only (whole sack count). */
function sanitizeInt(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

/** kg display — value as entered, no forced rounding. */
function formatKg(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)))
}

/**
 * One summary (quick-entry) grain line: type + price/quintal + total weight +
 * entered amount, plus optional total sacks and a single total-kg deduction.
 * The amount is authoritative (never recomputed); the derived net is shown for
 * reference only. Mirrors the structure/idioms of the fresh `GrainLineEditor`.
 */
export function QuickGrainLineEditor({
  index,
  line,
  grainTypes,
  totals,
  canRemove,
  onChange,
  onRemove,
  onAddCustomGrain,
}: QuickGrainLineEditorProps) {
  const { t, lang } = useI18n()
  const [showCustom, setShowCustom] = useState(false)
  const [customEn, setCustomEn] = useState('')
  const [customHi, setCustomHi] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)

  function grainName(g: GrainType): string {
    return lang === 'hi' ? g.nameHi : g.nameEn
  }

  async function confirmCustom() {
    if (!customEn.trim() && !customHi.trim()) return
    setAddingCustom(true)
    try {
      const en = customEn.trim() || customHi.trim()
      const hi = customHi.trim() || customEn.trim()
      const created = await onAddCustomGrain(en, hi)
      onChange({ ...line, grainTypeId: created.id })
      setShowCustom(false)
      setCustomEn('')
      setCustomHi('')
    } finally {
      setAddingCustom(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">
          {t('grain.line')} #{index + 1}
        </h3>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('deduction.remove')}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Grain type */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">{t('grain.type')}</label>
        <div className="flex gap-2">
          <select
            data-testid="grain-type-select"
            value={line.grainTypeId}
            onChange={(e) => onChange({ ...line, grainTypeId: e.target.value })}
            aria-label={t('grain.type')}
            className="h-12 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-base focus:border-emerald-500 focus:outline-none"
          >
            {grainTypes.length === 0 && <option value="">—</option>}
            {grainTypes.map((g) => (
              <option key={g.id} value={g.id}>
                {grainName(g)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowCustom((v) => !v)}
            className="h-12 rounded-lg border border-dashed border-gray-400 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('grain.addCustom')}
          </button>
        </div>

        {showCustom && (
          <div className="mt-2 space-y-2 rounded-lg bg-gray-50 p-3">
            <input
              type="text"
              value={customEn}
              onChange={(e) => setCustomEn(e.target.value)}
              placeholder={`${t('grain.type')} (EN)`}
              className="h-12 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="text"
              value={customHi}
              onChange={(e) => setCustomHi(e.target.value)}
              placeholder={`${t('grain.type')} (हिं)`}
              className="h-12 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={confirmCustom}
              disabled={addingCustom || (!customEn.trim() && !customHi.trim())}
              className="h-12 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {t('grain.addCustom')}
            </button>
          </div>
        )}
      </div>

      {/* Price per quintal (required) */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">{t('grain.price')}</label>
        <input
          data-testid="price-input"
          type="text"
          inputMode="decimal"
          value={line.price}
          onChange={(e) => onChange({ ...line, price: sanitizeDecimal(e.target.value) })}
          placeholder={t('grain.price')}
          className="h-14 w-full rounded-lg border border-gray-300 px-4 text-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Total weight (kg) — required, one gross number */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">{t('quick.totalWeight')}</label>
        <input
          data-testid="total-weight-input"
          type="text"
          inputMode="decimal"
          value={line.totalWeight}
          onChange={(e) => onChange({ ...line, totalWeight: sanitizeDecimal(e.target.value) })}
          placeholder={t('quick.totalWeight')}
          className="h-14 w-full rounded-lg border border-gray-300 px-4 text-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Amount (₹) — required, entered verbatim, authoritative */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">{t('quick.amount')}</label>
        <input
          data-testid="amount-input"
          type="text"
          inputMode="decimal"
          value={line.amount}
          onChange={(e) => onChange({ ...line, amount: sanitizeDecimal(e.target.value) })}
          placeholder={t('quick.amount')}
          className="h-14 w-full rounded-lg border border-gray-300 px-4 text-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <p className="text-xs text-gray-500">{t('quick.amountHint')}</p>
      </div>

      {/* Total sacks — optional; rendered WITHOUT any "(optional)" text */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">{t('quick.sackCount')}</label>
        <input
          data-testid="sack-count-input"
          type="text"
          inputMode="numeric"
          value={line.sackCount}
          onChange={(e) => onChange({ ...line, sackCount: sanitizeInt(e.target.value) })}
          placeholder={t('quick.sackCount')}
          className="h-14 w-full rounded-lg border border-gray-300 px-4 text-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Deduction (kg) — optional single number; rendered WITHOUT any "(optional)" text */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">{t('quick.deductionKg')}</label>
        <input
          data-testid="deduction-kg-input"
          type="text"
          inputMode="decimal"
          value={line.deductionKg}
          onChange={(e) => onChange({ ...line, deductionKg: sanitizeDecimal(e.target.value) })}
          placeholder={t('quick.deductionKg')}
          className="h-14 w-full rounded-lg border border-gray-300 px-4 text-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Live line figures — net is derived (weight − deduction); amount is entered verbatim */}
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-sm">
        <div className="text-gray-600">{t('totals.gross')}</div>
        <div className="text-right font-medium">{formatKg(totals.grossWeightKg)} kg</div>

        <div className="text-gray-600">{t('totals.deduction')}</div>
        <div className="text-right font-medium">{formatKg(totals.deductionKg)} kg</div>

        <div className="text-gray-600">{t('totals.net')}</div>
        <div data-testid="line-net" className="text-right font-semibold">
          {formatKg(totals.netWeightKg)} kg
        </div>

        <div className="text-gray-600">{t('totals.lineAmount')}</div>
        <div data-testid="line-amount" className="text-right font-semibold text-emerald-800">
          ₹{totals.amount.toFixed(2)}
        </div>
      </div>
    </div>
  )
}
