// Pure calculation module for Anaj Bahi.
// No I/O, no Dexie, no side effects. Identical inputs always yield identical outputs.
// Units: weights in kg; 1 quintal = 100 kg; price is ₹ per quintal; currency ₹ (2 dp / paise).

export type DeductionBasis =
  | 'per_sack_kg'
  | 'per_quintal_kg'
  | 'percent_gross'
  | 'flat_kg'

export interface Deduction {
  basis: DeductionBasis
  value: number
}

export interface GrainLineInput {
  pricePerQuintal: number // ₹ per 100 kg
  sackWeights: number[] // kg, in entry order (may be decimal)
  deductions: Deduction[] // zero or more, applied additively
}

export interface GrainLineTotals {
  sackCount: number // sackWeights.length
  grossWeightKg: number // sum of sackWeights
  deductionKg: number // sum of resolved deductions, kg (>= 0)
  netWeightKg: number // max(0, gross - deductionKg)
  amount: number // ₹, netQuintals * price, rounded to 2 dp
}

const KG_PER_QUINTAL = 100

/**
 * Round a rupee amount half-up to 2 decimal places (paise).
 * Uses string-exponential re-parsing so binary float error does not push a true
 * `x.xx5` boundary down (e.g. 3741.715 → 3741.72, 3741.714 → 3741.71).
 */
export function roundRupees(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  const shifted = Number(`${amount}e2`)
  if (!Number.isFinite(shifted)) {
    // Fallback for values JS renders in exponential notation (out of the money range).
    return Math.round(amount * 100) / 100
  }
  const rounded = Math.round(shifted)
  return Number(`${rounded}e-2`)
}

/**
 * Resolve a single deduction to kilograms, given the line's gross weight and sack count.
 * Bases (per data.md):
 *   per_sack_kg    → value × sackCount
 *   per_quintal_kg → value × (gross / 100)
 *   percent_gross  → (value / 100) × gross
 *   flat_kg        → value
 */
export function resolveDeductionKg(
  d: Deduction,
  grossKg: number,
  sackCount: number,
): number {
  switch (d.basis) {
    case 'per_sack_kg':
      return d.value * sackCount
    case 'per_quintal_kg':
      return d.value * (grossKg / KG_PER_QUINTAL)
    case 'percent_gross':
      return (d.value / 100) * grossKg
    case 'flat_kg':
      return d.value
    default: {
      // Exhaustiveness guard — an unknown basis contributes no deduction.
      const _never: never = d.basis
      void _never
      return 0
    }
  }
}

/**
 * Compute the full set of totals for one grain line.
 * Weights are kept exactly as entered (not rounded); only the final ₹ amount is rounded.
 */
export function computeGrainLine(line: GrainLineInput): GrainLineTotals {
  const sackCount = line.sackWeights.length
  const grossWeightKg = line.sackWeights.reduce((sum, w) => sum + w, 0)
  const deductionKg = line.deductions.reduce(
    (sum, d) => sum + resolveDeductionKg(d, grossWeightKg, sackCount),
    0,
  )
  const netWeightKg = Math.max(0, grossWeightKg - deductionKg)
  const netQuintals = netWeightKg / KG_PER_QUINTAL
  const amount = roundRupees(netQuintals * line.pricePerQuintal)
  return { sackCount, grossWeightKg, deductionKg, netWeightKg, amount }
}

/**
 * Bill total = sum of each line's already-rounded amount (no penny drift), 2 dp.
 */
export function computeBillTotal(lines: GrainLineInput[]): number {
  const total = lines.reduce((sum, line) => sum + computeGrainLine(line).amount, 0)
  return roundRupees(total)
}
