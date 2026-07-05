// Bill-id generator: "DDMMYY/xxxxx"
//   DDMMYY  — zero-padded day/month/2-digit-year of the given date
//   xxxxx   — 5 chars from [a-z0-9], drawn via crypto.getRandomValues (not Math.random)
// Regenerates the random suffix on collision against existing bill ids.

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789' // 36 symbols
const CODE_LENGTH = 5
const MAX_ATTEMPTS = 100

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** DDMMYY date part for a bill id (local date components). */
export function billDatePart(date: Date): string {
  const dd = pad2(date.getDate())
  const mm = pad2(date.getMonth() + 1)
  const yy = pad2(date.getFullYear() % 100)
  return `${dd}${mm}${yy}`
}

/** Random 5-char [a-z0-9] suffix from crypto.getRandomValues. */
export function randomBillCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

/**
 * Generate a unique bill id for `date`, regenerating the suffix while `exists(id)`
 * resolves true. Throws only if it cannot find a free id after MAX_ATTEMPTS.
 */
export async function generateBillId(
  date: Date,
  exists: (id: string) => Promise<boolean>,
): Promise<string> {
  const datePart = billDatePart(date)
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const id = `${datePart}/${randomBillCode()}`
    if (!(await exists(id))) return id
  }
  throw new Error('Could not generate a unique bill id after multiple attempts')
}
