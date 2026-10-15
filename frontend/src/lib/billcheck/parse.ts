// Phase 13 — strict validation of the model's JSON. PURE: no I/O, no network.
//
// The request pins a `responseSchema`, but a schema is a CONSTRAINT, not a
// guarantee: a response can still arrive truncated, with a number as a string,
// with a null where a number was promised, or with a shape nobody asked for.
// Everything from the model passes through here first, and nothing downstream
// ever sees an unvalidated value.
//
// The hard rule: NO code path in this file may produce NaN. A NaN reaching the
// UI renders as "₹NaN" next to a real paper bill, which is worse than an error —
// it looks like an answer. Every failure is a typed BillReadError instead.
//
// Fully unit-tested against fixture JSON: no API key, no network, no model.

import { BillReadError, type ReadBill, type ReadBillLine, type ReadField } from './types'

/** Hard cap on lines in one bill. A runaway/hallucinated array is a bad response. */
const MAX_LINES = 40

/** Rupee/weight sanity ceiling. Beyond this a "read" is a misread, not a bill. */
const MAX_MAGNITUDE = 100_000_000

function fail(detail: string): never {
  throw new BillReadError('bad-response', detail)
}

/** Clamp confidence into 0..1; a missing or junk confidence reads as 0 (unsure). */
function coerceConfidence(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/**
 * Coerce a value the model claims is a number.
 *
 * Accepts a real number or a numeric string (models emit `"2455"` often enough
 * that rejecting it would waste reads), after stripping the separators and
 * symbols a model tends to copy off the paper — `₹`, `,`, `kg`, whitespace.
 * Anything else, including a non-finite or out-of-range value, reads as null —
 * i.e. "could not read", which is a visible amber cell, never a silent zero.
 */
function coerceNumber(raw: unknown): number | null {
  let n: number
  if (typeof raw === 'number') {
    n = raw
  } else if (typeof raw === 'string') {
    const cleaned = raw.replace(/[₹,\s]/g, '').replace(/(kg|किग्रा|क्विं)\.?$/iu, '')
    if (cleaned === '' || cleaned === '-') return null
    n = Number(cleaned)
  } else {
    return null
  }
  if (!Number.isFinite(n)) return null
  if (Math.abs(n) > MAX_MAGNITUDE) return null
  return n
}

function coerceString(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const s = raw.trim()
    return s === '' ? null : s
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  return null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Read one `{ value, confidence }` field.
 *
 * Tolerates the model flattening the wrapper to a bare scalar (it does, sometimes,
 * despite the schema) by treating a bare value as fully confident — the figure is
 * still validated, and a flattened field is not a reason to discard a whole read.
 */
function field<T>(raw: unknown, coerce: (v: unknown) => T | null): ReadField<T> {
  if (isRecord(raw)) {
    const value = coerce(raw.value)
    // A field the model could not read has no meaningful confidence — pin it to 0
    // so it always surfaces as amber regardless of what the model claimed.
    return { value, confidence: value === null ? 0 : coerceConfidence(raw.confidence) }
  }
  const value = coerce(raw)
  return { value, confidence: value === null ? 0 : 1 }
}

/** An optional numeric field that means 0 when the paper shows nothing. */
function zeroDefaultField(raw: unknown): ReadField<number> {
  if (raw === undefined || raw === null) return { value: 0, confidence: 1 }
  const f = field(raw, coerceNumber)
  // An unreadable deduction/paldari means "none written", which is 0, not unknown.
  return f.value === null ? { value: 0, confidence: 1 } : f
}

/** A weight/rate/amount must never be negative — a minus sign here is a misread. */
function nonNegative(f: ReadField<number>): ReadField<number> {
  if (f.value !== null && f.value < 0) return { value: null, confidence: 0 }
  return f
}

function parseLine(raw: unknown, index: number): ReadBillLine {
  if (!isRecord(raw)) fail(`line ${index} is not an object`)
  return {
    grainName: field(raw.grainName, coerceString),
    ratePerQuintal: nonNegative(field(raw.ratePerQuintal, coerceNumber)),
    weightKg: nonNegative(field(raw.weightKg, coerceNumber)),
    deductionKg: nonNegative(zeroDefaultField(raw.deductionKg)),
    sackCount: nonNegative(field(raw.sackCount, coerceNumber)),
    amount: nonNegative(field(raw.amount, coerceNumber)),
  }
}

/** ISO `yyyy-mm-dd` only, and it must be a real calendar date. */
function coerceIsoDate(raw: unknown): string | null {
  const s = coerceString(raw)
  if (s === null) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [, y, mo, d] = m
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  const roundTrips =
    dt.getUTCFullYear() === Number(y) &&
    dt.getUTCMonth() === Number(mo) - 1 &&
    dt.getUTCDate() === Number(d)
  return roundTrips ? s : null
}

/**
 * Validate a model response into a `ReadBill`.
 *
 * Throws `BillReadError('bad-response')` for a shape that cannot be salvaged, and
 * `BillReadError('no-bill-found')` when the response is well-formed but holds no
 * usable line — the trader needs "I couldn't find a bill in this photo", which is
 * a different instruction from "something went wrong".
 *
 * Unknown keys are ignored rather than rejected, so a model that volunteers extra
 * fields does not cost the trader a retry.
 */
export function parseReadBill(raw: unknown): ReadBill {
  if (!isRecord(raw)) fail('response is not an object')

  const rawLines = raw.lines
  if (!Array.isArray(rawLines)) fail('missing or non-array `lines`')
  if (rawLines.length === 0) throw new BillReadError('no-bill-found', 'zero lines')
  if (rawLines.length > MAX_LINES) fail(`absurd line count (${rawLines.length})`)

  const lines = rawLines.map(parseLine)

  // Well-formed but empty of substance: every line failed to yield even one of the
  // three figures the check needs. That is a photo problem, not a parse problem.
  const anyUsable = lines.some(
    (l) => l.ratePerQuintal.value !== null || l.weightKg.value !== null || l.amount.value !== null,
  )
  if (!anyUsable) throw new BillReadError('no-bill-found', 'no readable figures in any line')

  return {
    farmerName: field(raw.farmerName, coerceString),
    place: field(raw.place, coerceString),
    date: field(raw.date, coerceIsoDate),
    lines,
    paldari: nonNegative(zeroDefaultField(raw.paldari)),
    paperTotal: nonNegative(field(raw.paperTotal, coerceNumber)),
  }
}

/**
 * Pull the JSON payload out of a model text response.
 *
 * `responseMimeType: application/json` should make the text pure JSON, but models
 * still occasionally wrap it in a ```json fence, so strip one if present before
 * parsing. A truncated or non-JSON body is a typed `bad-response`.
 */
export function parseReadBillFromText(text: string): ReadBill {
  const trimmed = text.trim()
  if (trimmed === '') fail('empty response body')

  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed)
  const jsonText = fenced ? fenced[1] : trimmed

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    // Truncated output is the common cause (the model hit its token cap), and the
    // raw text is never shown to the trader — it would be noise at best.
    fail('response was not valid JSON (possibly truncated)')
  }
  return parseReadBill(parsed)
}
