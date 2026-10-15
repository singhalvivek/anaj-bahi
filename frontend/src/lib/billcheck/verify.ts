// Phase 13 — Bill Check verification. PURE: no I/O, no network, no clock, no
// randomness. Identical input always yields identical output.
//
// This module is the answer to "is my paper bill right?", and it is deliberately
// the part the model does not touch. The model reads digits; this computes money,
// by delegating to the SAME `lib/calc` engine every other rupee in the app goes
// through. Three consequences, all intentional:
//
//   1. The figures are exact, reproducible and hand-checkable — plan.md's rule is
//      "if your total is off by 0.01, every number on the screen dies with it".
//   2. The whole verdict is unit-testable with no API key and no network.
//   3. Correcting a misread digit re-verifies instantly, on the phone, with no
//      second API call.
//
// See spec/agent.md (the eyes-only rule) and spec/architecture.md § Bill Check
// (the frozen contract, incl. the seven rules each named test below pins).

import {
  computeBillTotal,
  computeGrainLine,
  roundRupees,
  type GrainLineInput,
} from '@/lib/calc'
import type { ReadBill, ReadBillLine, ReadField } from './types'

/**
 * A field read below this confidence renders amber and tappable. 0.75 is a
 * starting point, not a measured threshold — the bake-off described in
 * spec/roadmap.md § Phase 13 has to establish whether the model's confidence
 * correlates with being wrong at all before this number means much.
 */
export const CONFIDENCE_THRESHOLD = 0.75

/** The per-line fields whose absence makes a bill unverifiable, not just incomplete. */
const AMOUNT_BEARING_FIELDS = ['ratePerQuintal', 'weightKg', 'amount'] as const

export interface LineCheck {
  grainName: string | null
  ratePerQuintal: number | null
  weightKg: number | null
  /** Resolved to a number — an unread deduction is 0, which is the paper's meaning. */
  deductionKg: number
  sackCount: number | null
  /** max(0, weight − deduction); null when the weight was unreadable. */
  netWeightKg: number | null
  /** ₹ as written on the paper. */
  writtenAmount: number | null
  /** ₹ per lib/calc from rate + net weight; null when a required input was unreadable. */
  computedAmount: number | null
  /** written − computed, 2 dp; null when either side is null. NEVER 0 as a stand-in. */
  lineDiff: number | null
  /** Names of this line's fields below CONFIDENCE_THRESHOLD, in declaration order. */
  unsureFields: string[]
}

export type Verdict = 'ok' | 'check' | 'incomplete'

export interface BillCheckResult {
  lines: LineCheck[]
  /**
   * Σ written line amounts, 2 dp, GROSS of paldari; null when any line's amount
   * was unreadable. Gross because that is how the lines are written on the paper —
   * paldari appears once near the total, not inside a grain line.
   */
  sumWritten: number | null
  /** Σ computed line amounts, 2 dp, also GROSS of paldari (so it compares like with like). */
  sumComputed: number | null
  /**
   * What the paper's own lines imply is payable: `sumWritten − paldari`. This is
   * the figure the written grand total should match.
   */
  payableWritten: number | null
  /** The grand total written on the paper; null when none was written. */
  paperTotal: number | null
  /**
   * sumWritten − sumComputed: his per-line rate × weight was off.
   * Deliberately paldari-FREE — both sides are gross, so a bill-level labour
   * charge can never masquerade as a line-arithmetic error.
   */
  mathDiff: number | null
  /**
   * paperTotal − payableWritten: he added his own column wrong (or mis-applied
   * the paldari). null when the paper carried no grand total.
   */
  additionDiff: number | null
  paldari: number
  verdict: Verdict
  /** Total count of unsure fields across all lines plus the bill-level fields. */
  unsureCount: number
}

/** A field is unsure when it is below threshold OR could not be read at all. */
function isUnsure<T>(f: ReadField<T>): boolean {
  return f.value === null || f.confidence < CONFIDENCE_THRESHOLD
}

/** Read a numeric field, treating a non-finite value as unread rather than as 0. */
function num(f: ReadField<number>): number | null {
  return f.value !== null && Number.isFinite(f.value) ? f.value : null
}

/** Read an optional numeric field that means 0 when absent (deduction, paldari). */
function numOrZero(f: ReadField<number> | undefined): number {
  if (!f) return 0
  const v = num(f)
  return v === null ? 0 : v
}

/**
 * Build the `lib/calc` input for one read line.
 *
 * Deliberately the SACKS path, not the `summary` path: a summary line's whole
 * purpose is to return the entered amount verbatim (see
 * spec/capabilities/quick-bill-entry.md), which would make this check vacuous —
 * it would "verify" the paper against itself. Modelling the written weight as a
 * single sack and the deduction as `flat_kg` makes `computeGrainLine` derive
 * `amount` from rate × net, which is exactly the figure we need to compare.
 */
function toCalcInput(rate: number, weightKg: number, deductionKg: number): GrainLineInput {
  return {
    pricePerQuintal: rate,
    sackWeights: [weightKg],
    deductions: [{ basis: 'flat_kg', value: deductionKg }],
  }
}

function checkLine(line: ReadBillLine): LineCheck {
  const rate = num(line.ratePerQuintal)
  const weightKg = num(line.weightKg)
  const deductionKg = numOrZero(line.deductionKg)
  const writtenAmount = num(line.amount)

  const netWeightKg = weightKg === null ? null : Math.max(0, weightKg - deductionKg)

  // Computable only when BOTH the rate and the weight were read. A missing rate
  // must not silently compute as ₹0 and then "prove" the paper wrong by its full
  // amount — that is the single most damaging failure this screen could have.
  const computedAmount =
    rate === null || weightKg === null
      ? null
      : computeGrainLine(toCalcInput(rate, weightKg, deductionKg)).amount

  const lineDiff =
    writtenAmount === null || computedAmount === null
      ? null
      : roundRupees(writtenAmount - computedAmount)

  const unsureFields: string[] = []
  if (isUnsure(line.grainName)) unsureFields.push('grainName')
  if (isUnsure(line.ratePerQuintal)) unsureFields.push('ratePerQuintal')
  if (isUnsure(line.weightKg)) unsureFields.push('weightKg')
  if (isUnsure(line.deductionKg)) unsureFields.push('deductionKg')
  if (isUnsure(line.amount)) unsureFields.push('amount')

  return {
    grainName: line.grainName.value,
    ratePerQuintal: rate,
    weightKg,
    deductionKg,
    sackCount: num(line.sackCount),
    netWeightKg,
    writtenAmount,
    computedAmount,
    lineDiff,
    unsureFields,
  }
}

/**
 * Verify a read bill against its own arithmetic.
 *
 * Two diffs, kept strictly independent because they are two different mistakes
 * with two different fixes:
 *   mathDiff     — the line amounts disagree with rate × net weight (gross of
 *                  paldari on both sides, so a labour charge never looks like a
 *                  line error)
 *   additionDiff — the written grand total disagrees with his own lines less
 *                  paldari (which is where the paper puts it: lines gross, one
 *                  labour charge, then the payable total)
 * A bill can fail either without the other, and the UI reports each as its own
 * sentence rather than blending them into one misleading number.
 *
 * No tolerance and no heuristics: diffs are reported exactly as computed. A
 * trader who rounded to the nearest ₹5 on purpose presses "the paper is right";
 * the app does not guess at his intent. (Warn, never block.)
 */
export function verifyReadBill(read: ReadBill): BillCheckResult {
  const lines = read.lines.map(checkLine)
  const paldari = roundRupees(numOrZero(read.paldari))

  // A null anywhere propagates to null — never to 0. A partial sum presented as a
  // total would be a wrong number stated confidently, which is worse than no answer.
  const anyWrittenMissing = lines.some((l) => l.writtenAmount === null)
  const sumWritten = anyWrittenMissing
    ? null
    : roundRupees(lines.reduce((s, l) => s + (l.writtenAmount as number), 0))

  const anyComputedMissing = lines.some((l) => l.computedAmount === null)
  // Round-then-sum via computeBillTotal (the ledger's own path), and GROSS of
  // paldari so it is directly comparable to the written line amounts.
  const sumComputed = anyComputedMissing
    ? null
    : computeBillTotal(
        lines.map((l) =>
          toCalcInput(l.ratePerQuintal as number, l.weightKg as number, l.deductionKg),
        ),
      )

  const paperTotal = num(read.paperTotal)

  // PALDARI-FREE on purpose: both sides are gross of it. Subtracting paldari from
  // only one side would make every bill that carries a labour charge look like it
  // had a line-arithmetic error of exactly that amount — a false accusation on a
  // screen whose entire value rests on being trustworthy when it accuses.
  const mathDiff =
    sumWritten === null || sumComputed === null ? null : roundRupees(sumWritten - sumComputed)

  // Paldari belongs HERE, in the total comparison, because that is where the trader
  // writes it: grain lines gross, then one labour charge, then the payable total.
  // Subtracted exactly once.
  const payableWritten = sumWritten === null ? null : roundRupees(sumWritten - paldari)

  // null, not 0: "no total written on the paper" is a different statement from
  // "your addition is correct", and conflating them would invent a pass.
  const additionDiff =
    paperTotal === null || payableWritten === null ? null : roundRupees(paperTotal - payableWritten)

  const unsureCount =
    lines.reduce((n, l) => n + l.unsureFields.length, 0) +
    (isUnsure(read.paperTotal) ? 1 : 0) +
    (isUnsure(read.paldari) ? 1 : 0)

  // An incomplete read is never reported as a pass. Only a bill whose every
  // amount-bearing field was read can be called 'ok'.
  const incomplete =
    lines.length === 0 ||
    read.lines.some((line) =>
      AMOUNT_BEARING_FIELDS.some((f) => num(line[f] as ReadField<number>) === null),
    )

  let verdict: Verdict
  if (incomplete) {
    verdict = 'incomplete'
  } else if ((mathDiff ?? 0) !== 0 || (additionDiff ?? 0) !== 0) {
    verdict = 'check'
  } else {
    verdict = 'ok'
  }

  return {
    lines,
    sumWritten,
    sumComputed,
    payableWritten,
    paperTotal,
    mathDiff,
    additionDiff,
    paldari,
    verdict,
    unsureCount,
  }
}
