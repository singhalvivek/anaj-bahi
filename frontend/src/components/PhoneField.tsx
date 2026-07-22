'use client'

// Shared India-only phone entry. The app serves Indian traders only, so every
// phone field carries a FIXED, non-editable "🇮🇳 +91" prefix and the user types
// just the local 10-digit number. Value in/out is always E.164 (`+91XXXXXXXXXX`)
// or `''` when empty — so callers (login/employees/farmer/business) store and
// validate one canonical shape everywhere.

/**
 * Local 10-digit part of a value the user TYPED into the field — tolerant of a
 * full number pasted with the country code. A leading `91` is stripped only when
 * the value is longer than 10 digits (so a genuine 10-digit number starting with
 * `91` survives), then the first 10 digits are kept (extra digits are ignored).
 *
 * NOTE: use `displayLocal` (below) — not this — to render a STORED E.164 value, so
 * the fixed `+91` prefix never leaks back into the visible input as you type.
 */
export function localDigits(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.length > 10 && d.startsWith('91')) d = d.slice(2)
  return d.slice(0, 10)
}

/**
 * Local digits to SHOW for a stored value. Our own `onChange` always stores a
 * canonical `+91…`, so we strip exactly that country-code prefix — making the
 * type → store → display round-trip an identity (typing `9` shows `9`, never
 * `919`). Legacy/free-form values (no `+91` prefix) fall back to the tolerant
 * parser and normalise on the first edit.
 */
export function displayLocal(value: string): string {
  if (value.startsWith('+91')) return value.slice(3).replace(/\D/g, '').slice(0, 10)
  return localDigits(value)
}

/** Compose the canonical E.164 (`+91` + local 10 digits) from typed input; `''` stays `''`. */
export function toE164(raw: string): string {
  const d = localDigits(raw)
  return d ? `+91${d}` : ''
}

/** True for a complete Indian mobile number in E.164 form. */
export function isValidIndianPhone(e164: string): boolean {
  return /^\+91\d{10}$/.test(e164.trim())
}

interface PhoneFieldProps {
  /** Current value in E.164 (or '' / any legacy value — the last 10 digits show). */
  value: string
  /** Fires with the canonical E.164 value ('' when the field is cleared). */
  onChange: (e164: string) => void
  testId?: string
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  /** Soft-keyboard action key for the number input (e.g. 'done' to end a field
   *  chain, 'next' to advance). Omitted → the browser's default. */
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
  /** Classes for the OUTER field box (border/height/rounding) so each call-site
   *  keeps its existing look; text size set here is inherited by the input. */
  className?: string
}

/**
 * Renders the fixed `+91` prefix chip beside a borderless numeric input. The outer
 * box owns the border + focus ring (`focus-within`), so the prefix and the number
 * read as one control. The input carries `testId` (tests target it directly, e.g.
 * `toBeDisabled()`), and Tailwind's `font-size:100%` on inputs means it inherits
 * the text size from `className`.
 */
export function PhoneField({
  value,
  onChange,
  testId,
  ariaLabel,
  placeholder,
  disabled,
  readOnly,
  enterKeyHint,
  className = '',
}: PhoneFieldProps) {
  const local = displayLocal(value)
  return (
    <div
      className={`flex items-stretch overflow-hidden ${
        disabled ? 'opacity-60' : ''
      } ${className}`}
    >
      <span
        aria-hidden
        className="flex select-none items-center gap-1 border-r border-inherit bg-stone-100 px-3 font-medium text-stone-600"
      >
        🇮🇳 +91
      </span>
      <input
        data-testid={testId}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        aria-label={ariaLabel}
        value={local}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        enterKeyHint={enterKeyHint}
        onChange={(e) => onChange(toE164(e.target.value))}
        className="min-w-0 flex-1 bg-transparent px-4 outline-none"
      />
    </div>
  )
}
