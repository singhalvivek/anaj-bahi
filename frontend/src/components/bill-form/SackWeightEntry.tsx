'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'

interface SackWeightEntryProps {
  sackWeights: number[]
  onChange: (weights: number[]) => void
}

/** Keep digits and at most one decimal point; strip everything else. */
function sanitizeDecimal(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, '')
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
  }
  return s
}

/**
 * The signature interaction: add many sacks one-handed, fast, while always
 * seeing what is already entered. Summary on top, scrollable history directly
 * above the numeric input, big touch targets.
 */
export function SackWeightEntry({ sackWeights, onChange }: SackWeightEntryProps) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const totalKg = sackWeights.reduce((sum, w) => sum + w, 0)

  // Auto-scroll the history to the newest entry whenever the count changes.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [sackWeights.length])

  function addSack() {
    const w = parseFloat(value)
    if (!value.trim() || !Number.isFinite(w) || w <= 0) {
      // Empty / zero / invalid Add is ignored.
      return
    }
    onChange([...sackWeights, w])
    setValue('')
    // Re-focus immediately so the trader keeps typing the next sack.
    inputRef.current?.focus()
  }

  function removeSack(index: number) {
    onChange(sackWeights.filter((_, i) => i !== index))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSack()
    }
  }

  return (
    <div className="space-y-2">
      {/* Running summary — always visible, big and bold */}
      <div
        data-testid="sack-summary"
        className="rounded-lg bg-emerald-50 px-3 py-2 text-base font-bold text-emerald-900"
      >
        {t('sack.summary')}: {sackWeights.length} • {t('sack.total')}: {totalKg.toFixed(1)} kg
      </div>

      {/* History of entered weights — directly above the input, scrollable */}
      {sackWeights.length > 0 && (
        <ul
          ref={listRef}
          data-testid="sack-list"
          className="max-h-[40vh] space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2"
        >
          {sackWeights.map((w, i) => (
            <li
              key={i}
              data-testid="sack-row"
              className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
            >
              <span>
                #{i + 1} — {String(w)} kg
              </span>
              <button
                type="button"
                onClick={() => removeSack(i)}
                aria-label={t('sack.remove')}
                className="ml-2 flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Numeric input + Add button */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          data-testid="sack-input"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(sanitizeDecimal(e.target.value))}
          onKeyDown={handleKeyDown}
          placeholder={t('sack.input')}
          className="h-14 flex-1 rounded-lg border border-gray-300 px-4 text-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          data-testid="sack-add"
          onClick={addSack}
          className="h-14 min-w-[72px] rounded-lg bg-emerald-600 px-5 text-base font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800"
        >
          {t('sack.add')}
        </button>
      </div>
    </div>
  )
}
