// Paper-ledger column layout for a grain's sacks.
// Pure — no I/O, no React, no side effects. Identical inputs always yield identical
// outputs. Splits a grain's ORDERED sack weights into columns of up to `perColumn`
// rows each (entry order preserved) and sums each column.
//
// Mirrors the trader's paper ledger: the first `perColumn` sacks fill column 1
// top-to-bottom, the next fill column 2, and so on. A grain with N sacks →
// ceil(N / perColumn) columns; the last column may be short. With the app's cap of
// 100 sacks/bill and perColumn = 10, a single grain yields at most 10 columns.

import type { Deduction } from '@/lib/calc'
import { resolveDeductionKg } from '@/lib/calc'

/**
 * Split ordered sack weights into columns of up to `perColumn` entries each.
 *   column 0 = weights[0 .. perColumn-1]  (entry order, top → bottom)
 *   column 1 = the next `perColumn`, …
 * Empty input → no columns ([]). Entry order and decimal values are preserved exactly.
 * `perColumn` must be >= 1.
 */
export function toColumns(weights: number[], perColumn = 10): number[][] {
  if (!Number.isInteger(perColumn) || perColumn < 1) {
    throw new Error(`toColumns: perColumn must be a positive integer, got ${perColumn}`)
  }
  const columns: number[][] = []
  for (let i = 0; i < weights.length; i += perColumn) {
    columns.push(weights.slice(i, i + perColumn))
  }
  return columns
}

/** Subtotal (sum of weights) for each column, in column order. Empty column → 0. */
export function columnSubtotals(columns: number[][]): number[] {
  return columns.map((col) => col.reduce((sum, w) => sum + w, 0))
}

/**
 * Display a weight/subtotal/deduction-value exactly as entered: integers bare,
 * decimals trimmed to 3 dp. Shared by the receipt so every number renders identically.
 * (e.g. 40 → "40", 40.5 → "40.5", 3.595 → "3.595").
 */
export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)))
}

/**
 * Compact basis note for one deduction, composed per its basis (language-neutral,
 * like the "q" quintal symbol): per_sack_kg→"{v}/sack", per_quintal_kg→"{v}/qtl",
 * percent_gross→"{v}%", flat_kg→"{v} kg". Values render via `fmtNum`.
 * Unknown basis → "" (dropped by the join in `deductionSummary`).
 */
function basisNote(d: Deduction): string {
  switch (d.basis) {
    case 'per_sack_kg':
      return `${fmtNum(d.value)}/sack`
    case 'per_quintal_kg':
      return `${fmtNum(d.value)}/qtl`
    case 'percent_gross':
      return `${fmtNum(d.value)}%`
    case 'flat_kg':
      return `${fmtNum(d.value)} kg`
    default:
      return ''
  }
}

/** Resolved total deduction (kg) plus the compact per-basis note for a grain line. */
export interface DeductionSummary {
  kg: number // sum of resolved deductions, kg (>= 0) — via @/lib/calc resolveDeductionKg
  note: string // compact basis note, joined with " + " (empty deductions → "")
}

/**
 * Summarise a grain line's deductions for the receipt's Deduction cell.
 * `kg` reuses the UNCHANGED `resolveDeductionKg` from `@/lib/calc` (never reimplements
 * the math): gross = sum of sackWeights, sackCount = sackWeights.length. `note` is the
 * compact basis string (e.g. "0.5/sack + 1%"). The receipt composes the final cell text
 * as `${fmtNum(kg)} ${kgLabel}` optionally followed by ` (${note})`.
 */
export function deductionSummary(line: {
  sackWeights: number[]
  deductions: Deduction[]
}): DeductionSummary {
  const gross = line.sackWeights.reduce((sum, w) => sum + w, 0)
  const sackCount = line.sackWeights.length
  const kg = line.deductions.reduce(
    (sum, d) => sum + resolveDeductionKg(d, gross, sackCount),
    0,
  )
  const note = line.deductions.map(basisNote).filter(Boolean).join(' + ')
  return { kg, note }
}
