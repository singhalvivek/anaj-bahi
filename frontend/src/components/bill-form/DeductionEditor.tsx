'use client'

import { useI18n } from '@/lib/i18n/context'
import type { DeductionBasis } from '@/lib/calc'
import type { DeductionDraft } from '@/app/bills/new/page'

interface DeductionEditorProps {
  deductions: DeductionDraft[]
  onChange: (deductions: DeductionDraft[]) => void
}

const BASES: DeductionBasis[] = [
  'per_sack_kg',
  'per_quintal_kg',
  'percent_gross',
  'flat_kg',
]

/** Keep digits and at most one decimal point. */
function sanitizeDecimal(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, '')
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
  }
  return s
}

/** Zero or more deductions per grain line; each = basis + value + remove. */
export function DeductionEditor({ deductions, onChange }: DeductionEditorProps) {
  const { t } = useI18n()

  function addDeduction() {
    onChange([...deductions, { basis: 'per_sack_kg', value: '' }])
  }

  function updateDeduction(index: number, patch: Partial<DeductionDraft>) {
    onChange(deductions.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  function removeDeduction(index: number) {
    onChange(deductions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">{t('deduction.label')}</div>

      {deductions.map((d, i) => (
        <div
          key={i}
          data-testid="deduction-row"
          className="flex items-center gap-2"
        >
          <select
            value={d.basis}
            onChange={(e) =>
              updateDeduction(i, { basis: e.target.value as DeductionBasis })
            }
            aria-label={t('deduction.label')}
            className="h-12 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            {BASES.map((b) => (
              <option key={b} value={b}>
                {t(`deduction.basis.${b}`)}
              </option>
            ))}
          </select>
          <input
            type="text"
            inputMode="decimal"
            value={d.value}
            onChange={(e) =>
              updateDeduction(i, { value: sanitizeDecimal(e.target.value) })
            }
            placeholder={t('deduction.value')}
            aria-label={t('deduction.value')}
            enterKeyHint="done"
            className="h-12 w-24 rounded-lg border border-gray-300 px-3 text-base focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => removeDeduction(i)}
            aria-label={t('deduction.remove')}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        data-testid="add-deduction"
        onClick={addDeduction}
        className="h-12 rounded-lg border border-dashed border-gray-400 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {t('deduction.add')}
      </button>
    </div>
  )
}
