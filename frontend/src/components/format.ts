// Locale-neutral display formatting (Western digits in both languages).

/** ₹ amount with exactly 2 decimals, no thousands separators (locale-neutral). */
export function formatRupees(amount: number): string {
  return `₹${amount.toFixed(2)}`
}

/** ISO "yyyy-mm-dd" → "dd/mm/yyyy"; returns the input unchanged if not parseable. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const [, y, mo, d] = m
  return `${d}/${mo}/${y}`
}
