// Phase 13 — Bill Check shared types.
//
// These describe what the MODEL READ off a photo of a paper bill — nothing more.
// The model is eyes only: it transcribes digits and says how sure it was. Every
// rupee figure derived from these values is computed afterwards by the pure
// `lib/calc` engine (see `verify.ts`). See spec/agent.md for why that boundary is
// absolute, and spec/architecture.md § Bill Check for the frozen contract.
//
// Nothing in this module is ever persisted. There is no Dexie table, no Firestore
// document and no `Bill` produced from a `ReadBill`.

/**
 * One field the model read, with how sure it was.
 *
 * `value: null` means it could NOT read the field — deliberately distinct from
 * reading a zero. The prompt instructs the model to emit null rather than guess,
 * because a confidently wrong digit silently corrupts a verdict the trader is
 * trusting, whereas a blank is visible and fixable.
 */
export interface ReadField<T> {
  value: T | null
  /** 0..1, clamped by `parse.ts`. Below CONFIDENCE_THRESHOLD renders amber. */
  confidence: number
}

/** One grain line as written on the paper. */
export interface ReadBillLine {
  grainName: ReadField<string>
  /** ₹ per quintal (100 kg) — the rate column. */
  ratePerQuintal: ReadField<number>
  /** Gross kg, as written. For a sack column the model reads the WRITTEN total. */
  weightKg: ReadField<number>
  /** Total kg deducted. `0` when the paper shows none. */
  deductionKg: ReadField<number>
  /** Informational only — never used in any calculation. */
  sackCount: ReadField<number>
  /** ₹ as WRITTEN on the paper for this line. Never a recomputation. */
  amount: ReadField<number>
}

/** A whole paper bill as read. */
export interface ReadBill {
  farmerName: ReadField<string>
  place: ReadField<string>
  /** ISO `yyyy-mm-dd` when legible, else null. */
  date: ReadField<string>
  lines: ReadBillLine[]
  /** Bill-level labour charge borne by the farmer (₹). `0` when absent. */
  paldari: ReadField<number>
  /**
   * The grand total WRITTEN at the bottom of the paper — reported exactly as
   * written even when it disagrees with the lines, because that disagreement is
   * the entire product. `null` when the trader wrote no total.
   */
  paperTotal: ReadField<number>
}

/**
 * Why a read failed, as a typed cause. Each maps to its own visible bilingual
 * message — Bill Check is the only online-only screen in an otherwise fully
 * offline app, so "it didn't work" is never an acceptable thing to show.
 */
export type BillReadErrorKind =
  | 'offline'
  | 'not-configured'
  | 'rate-limited'
  | 'network'
  | 'bad-response'
  | 'no-bill-found'
  | 'image-too-large'

/** A read failure. Thrown by `reader.ts`/`parse.ts`; never a bare string. */
export class BillReadError extends Error {
  readonly kind: BillReadErrorKind
  readonly detail?: string

  constructor(kind: BillReadErrorKind, detail?: string) {
    super(detail ? `${kind}: ${detail}` : kind)
    this.name = 'BillReadError'
    this.kind = kind
    this.detail = detail
  }
}

/** Type guard — `catch` blocks get `unknown`. */
export function isBillReadError(e: unknown): e is BillReadError {
  return e instanceof BillReadError
}

/** An image ready to inline into a request: base64 WITHOUT a data-URL prefix. */
export interface InlineImage {
  mimeType: string
  base64: string
}

/**
 * The provider boundary. `reader.ts` implements this over Gemini; swapping
 * provider means a new implementation of this one type and nothing else —
 * `parse.ts`, `verify.ts` and the whole UI are provider-agnostic.
 */
export type BillReader = (image: InlineImage) => Promise<ReadBill>
