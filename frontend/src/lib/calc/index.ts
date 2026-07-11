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

/**
 * Phase 5 — the figures transcribed for a summary (quick-entry) grain line.
 * Structurally equal to `GrainLineSummary` in lib/db/schema. Its `amount` is
 * entered verbatim from the paper bill and is authoritative — never recomputed.
 */
export interface SummaryFigures {
  totalWeightKg: number // gross, one number (not per sack)
  sackCount?: number // optional integer count
  deductionKg?: number // optional single total-kg deduction
  amount: number // ₹ entered verbatim — AUTHORITATIVE
}

export interface GrainLineInput {
  pricePerQuintal: number // ₹ per 100 kg
  sackWeights: number[] // kg, in entry order (may be decimal)
  deductions: Deduction[] // zero or more, applied additively
  summary?: SummaryFigures // Phase 5 — present → summary line (dispatch discriminant)
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
 * Phase 5 — compute the totals for a summary (quick-entry) grain line.
 * The engine does NOT sum sacks and does NOT recompute the amount:
 *   grossWeightKg = totalWeightKg; deductionKg = deductionKg ?? 0;
 *   netWeightKg   = max(0, gross − deduction); sackCount = sackCount ?? 0;
 *   amount        = roundRupees(entered amount)  — the ENTERED figure, verbatim,
 *                   NOT netQuintals × price. The entered value always wins.
 * `pricePerQuintal` is retained/shown as the rate but never drives the amount.
 */
export function computeSummaryLine(
  pricePerQuintal: number,
  s: SummaryFigures,
): GrainLineTotals {
  void pricePerQuintal // rate is displayed, but a summary line's amount ignores it
  const grossWeightKg = s.totalWeightKg
  const deductionKg = s.deductionKg ?? 0
  const netWeightKg = Math.max(0, grossWeightKg - deductionKg)
  const sackCount = s.sackCount ?? 0
  const amount = roundRupees(s.amount)
  return { sackCount, grossWeightKg, deductionKg, netWeightKg, amount }
}

/**
 * Compute the full set of totals for one grain line.
 * Dispatches on `line.summary`: present → the summary rule (entered amount is
 * authoritative); absent → the unchanged sacks rule below. The sacks path only
 * ever runs when `summary` is absent, so sacks bills are provably unaffected.
 * Weights are kept exactly as entered (not rounded); only the final ₹ amount is rounded.
 */
export function computeGrainLine(line: GrainLineInput): GrainLineTotals {
  if (line.summary) {
    return computeSummaryLine(line.pricePerQuintal, line.summary)
  }
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

// ---------------------------------------------------------------------------
// Payments, balance & due status (Phase 2). Still pure — no I/O, no Dexie.
// These take structural shapes so the module stays decoupled from the db layer;
// a stored `Bill`/`Payment` is assignable to them.
// ---------------------------------------------------------------------------

/** Minimal payment shape needed for balance math (a stored Payment satisfies it). */
export interface PaymentLike {
  amount: number
}

/** Minimal bill shape needed for balance math (a stored Bill satisfies it). */
export interface BillLike {
  lines: GrainLineInput[]
  payments: PaymentLike[]
}

/** Total paid to date = rounded sum of all payment amounts, 2 dp. */
export function computePaid(payments: PaymentLike[]): number {
  return roundRupees(payments.reduce((sum, p) => sum + p.amount, 0))
}

/**
 * Outstanding = billTotal − paid, 2 dp. May be ≤ 0 when the bill is fully paid
 * or overpaid (callers treat ≤ 0 as "settled", never as a negative debt).
 */
export function computeOutstanding(billTotal: number, payments: PaymentLike[]): number {
  return roundRupees(billTotal - computePaid(payments))
}

/** A bill is fully paid once outstanding reaches or passes zero. */
export function isFullyPaid(billTotal: number, payments: PaymentLike[]): boolean {
  return computeOutstanding(billTotal, payments) <= 0
}

export interface BillBalance {
  total: number
  paid: number
  outstanding: number
  fullyPaid: boolean
}

/** Convenience: full balance snapshot for a bill (total, paid, outstanding, fullyPaid). */
export function billBalance(bill: BillLike): BillBalance {
  const total = computeBillTotal(bill.lines)
  const paid = computePaid(bill.payments)
  const outstanding = roundRupees(total - paid)
  return { total, paid, outstanding, fullyPaid: outstanding <= 0 }
}

// ---------------------------------------------------------------------------
// Due status (Phase 2). ISO `yyyy-mm-dd` dates compare correctly as strings.
// ---------------------------------------------------------------------------

export type DueStatus = 'overdue' | 'due_soon' | 'upcoming' | 'none'

/** Today's local calendar date as ISO `yyyy-mm-dd` (device clock). */
export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Add `days` calendar days to an ISO `yyyy-mm-dd` date (UTC math, no DST drift). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Classify a bill's due state.
 *   none      → no due date, or nothing outstanding (settled bills never chase)
 *   overdue   → dueDate is before today and money is still owed
 *   due_soon  → today ≤ dueDate ≤ today + soonDays
 *   upcoming  → dueDate is beyond the soon window
 * ISO `yyyy-mm-dd` strings order lexicographically, so string compares are exact.
 */
export function dueStatus(
  dueDate: string | undefined,
  outstanding: number,
  today: string,
  soonDays = 7,
): DueStatus {
  if (!dueDate || outstanding <= 0) return 'none'
  if (dueDate < today) return 'overdue'
  const soonLimit = addDaysIso(today, soonDays)
  if (dueDate <= soonLimit) return 'due_soon'
  return 'upcoming'
}
