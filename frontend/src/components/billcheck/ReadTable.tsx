'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { formatRupees } from '@/components/format'
import type { LineCheck } from '@/lib/billcheck/verify'

/** The per-line numeric fields a trader can correct in place. */
export type EditableField = 'ratePerQuintal' | 'weightKg' | 'deductionKg' | 'amount'

interface ReadTableProps {
  lines: LineCheck[]
  onCorrect: (lineIndex: number, field: EditableField, value: number) => void
}

/** kg display — as read, no forced rounding (mirrors the entry forms' formatKg). */
function formatKg(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)))
}

/** Keep digits and at most one decimal point (same idiom as the entry forms). */
function sanitizeDecimal(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, '')
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
  }
  return s
}

interface CellProps {
  label: string
  /** Rendered value, or null when the model could not read it. */
  display: string | null
  unsure: boolean
  /** Absent ⇒ the cell is informational and not correctable. */
  edit?: { current: number | null; onCommit: (v: number) => void; testid: string }
  emphasis?: boolean
}

/**
 * One label/value row. An unsure value renders amber with a dotted underline and
 * a pencil, and tapping it opens an inline numeric input seeded with the read
 * value. Committing re-verifies LOCALLY — there is no second API call, which is
 * the visible payoff of keeping the arithmetic out of the model.
 */
function Cell({ label, display, unsure, edit, emphasis }: CellProps) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function open() {
    if (!edit) return
    setDraft(edit.current === null ? '' : String(edit.current))
    setEditing(true)
  }

  function commit() {
    if (!edit) return
    const n = Number(draft)
    // An empty or junk draft leaves the read value alone rather than writing a 0 —
    // a silent zero here would fabricate a discrepancy.
    if (draft.trim() !== '' && Number.isFinite(n) && n >= 0) edit.onCommit(n)
    setEditing(false)
  }

  if (editing && edit) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-sm text-stone-600">{label}</span>
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(sanitizeDecimal(e.target.value))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          data-testid={`${edit.testid}-input`}
          aria-label={t('check.unsure.edit')}
          className="h-11 w-32 rounded-lg border border-amber-500 px-3 text-right text-base focus:border-emerald-500 focus:outline-none"
        />
      </div>
    )
  }

  const valueText = display ?? '—'

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-stone-600">{label}</span>
      {unsure && edit ? (
        <button
          type="button"
          onClick={open}
          data-testid="check-cell-unsure"
          data-field={edit.testid}
          className="flex min-h-11 items-center gap-1.5 rounded px-2 text-base font-semibold text-amber-800 underline decoration-amber-500 decoration-dotted decoration-2 underline-offset-4 active:bg-amber-100"
        >
          {valueText}
          <span aria-hidden className="text-sm">
            ✎
          </span>
        </button>
      ) : (
        <span
          data-testid={edit?.testid}
          className={
            emphasis ? 'text-base font-bold text-stone-900' : 'text-base text-stone-800'
          }
        >
          {valueText}
        </span>
      )}
    </div>
  )
}

/**
 * The read-back of the paper bill, one card per grain line.
 *
 * Deliberately label/value rows rather than a dense column grid: this is a phone
 * in a busy mandi, and the figures that matter are compared vertically against
 * the paper in the trader's other hand.
 *
 * Money here uses the FROZEN 2-dp `formatRupees`, not the Indian-grouped rollup
 * formatter — these are per-bill figures being compared digit for digit against a
 * handwritten bill, where paise are the entire point.
 */
export function ReadTable({ lines, onCorrect }: ReadTableProps) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, i) => {
        const unsure = (f: string) => line.unsureFields.includes(f)
        return (
          <div
            key={i}
            data-testid="check-line-row"
            className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <h3
              data-testid="check-line-grain"
              className="mb-1 text-base font-semibold text-stone-900"
            >
              {line.grainName ?? '—'}
            </h3>

            <div className="divide-y divide-stone-100">
              <Cell
                label={t('check.col.rate')}
                display={line.ratePerQuintal === null ? null : formatRupees(line.ratePerQuintal)}
                unsure={unsure('ratePerQuintal')}
                edit={{
                  current: line.ratePerQuintal,
                  onCommit: (v) => onCorrect(i, 'ratePerQuintal', v),
                  testid: 'check-cell-rate',
                }}
              />
              <Cell
                label={t('check.col.weight')}
                display={line.weightKg === null ? null : `${formatKg(line.weightKg)} kg`}
                unsure={unsure('weightKg')}
                edit={{
                  current: line.weightKg,
                  onCommit: (v) => onCorrect(i, 'weightKg', v),
                  testid: 'check-cell-weight',
                }}
              />

              {/* ALWAYS rendered, even at 0 kg — deliberately, despite the extra row
                  on a bill with no deduction. A deduction the model missed makes the
                  computed amount too high and produces a FALSE "line math is off"
                  accusation, and a hidden row gives the trader no way to correct it.
                  Showing "0 kg" also tells him what the model saw, which is itself
                  worth a glance. Sacks stay conditional because they never enter the
                  arithmetic, so a misread there cannot mislead. */}
              <Cell
                label={t('check.col.deduction')}
                display={`${formatKg(line.deductionKg)} kg`}
                unsure={unsure('deductionKg')}
                edit={{
                  current: line.deductionKg,
                  onCommit: (v) => onCorrect(i, 'deductionKg', v),
                  testid: 'check-cell-deduction',
                }}
              />

              {line.sackCount !== null ? (
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-sm text-stone-600">
                    {t('check.col.sacks')}{' '}
                    <span className="text-xs text-stone-400">({t('check.sacksNote')})</span>
                  </span>
                  <span className="text-base text-stone-500">{formatKg(line.sackCount)}</span>
                </div>
              ) : null}

              <Cell
                label={t('check.col.written')}
                display={line.writtenAmount === null ? null : formatRupees(line.writtenAmount)}
                unsure={unsure('amount')}
                emphasis
                edit={{
                  current: line.writtenAmount,
                  onCommit: (v) => onCorrect(i, 'amount', v),
                  testid: 'check-cell-amount',
                }}
              />
              <Cell
                label={t('check.col.computed')}
                display={line.computedAmount === null ? null : formatRupees(line.computedAmount)}
                unsure={false}
                emphasis
              />

              {/* The difference row appears only when there IS one. */}
              {line.lineDiff !== null && line.lineDiff !== 0 ? (
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-sm font-medium text-amber-800">
                    {t('check.col.difference')}
                  </span>
                  <span
                    data-testid="check-line-diff"
                    data-diff={line.lineDiff}
                    className="text-base font-bold text-amber-800"
                  >
                    {line.lineDiff > 0 ? '+' : '−'}
                    {formatRupees(Math.abs(line.lineDiff))}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
