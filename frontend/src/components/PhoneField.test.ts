import { describe, it, expect } from 'vitest'
import { localDigits, toE164, displayLocal, isValidIndianPhone } from './PhoneField'

describe('PhoneField — India-only phone helpers', () => {
  describe('type → store → display round-trip is an identity (the +91-leak regression)', () => {
    // Bug: typing "9" showed "919" because the stored "+919" was re-parsed by
    // stripping ALL digits, folding the country code back into the local number.
    it('typing one digit at a time never re-injects the +91 prefix', () => {
      let stored = ''
      const type = (visible: string) => {
        stored = toE164(visible) // onChange stores canonical E.164
        return displayLocal(stored) // what the input then shows
      }
      expect(type('9')).toBe('9')
      expect(type('91')).toBe('91')
      expect(type('919')).toBe('919')
      expect(type('9196')).toBe('9196')
    })

    it('full 10-digit entry stores +91XXXXXXXXXX and shows the 10 local digits', () => {
      const stored = toE164('9352277260')
      expect(stored).toBe('+919352277260')
      expect(displayLocal(stored)).toBe('9352277260')
      expect(isValidIndianPhone(stored)).toBe(true)
    })
  })

  describe('tolerant input parsing (paste / E2E fill of a full number)', () => {
    it('pasting a full E.164 collapses to the 10 local digits', () => {
      expect(toE164('+919352277260')).toBe('+919352277260')
      expect(displayLocal(toE164('+919352277260'))).toBe('9352277260')
    })
    it('strips a leading country code only when the value exceeds 10 digits', () => {
      // genuine 10-digit number starting 91 survives untouched
      expect(localDigits('9112345678')).toBe('9112345678')
      // 12-digit "91" + 10 → country code dropped
      expect(localDigits('919112345678')).toBe('9112345678')
    })
    it('empty stays empty (never a bare +91)', () => {
      expect(toE164('')).toBe('')
      expect(displayLocal('')).toBe('')
    })
  })

  describe('displayLocal on legacy / non-prefixed stored values', () => {
    it('shows a bare 10-digit legacy number as-is', () => {
      expect(displayLocal('9998887776')).toBe('9998887776')
    })
    it('strips the exact +91 prefix from a canonical value', () => {
      expect(displayLocal('+919998887776')).toBe('9998887776')
    })
  })

  describe('isValidIndianPhone', () => {
    it('true only for +91 followed by exactly 10 digits', () => {
      expect(isValidIndianPhone('+919352277260')).toBe(true)
      expect(isValidIndianPhone('+9193522772')).toBe(false) // 8 digits
      expect(isValidIndianPhone('+9193522772601')).toBe(false) // 11 digits
      expect(isValidIndianPhone('9352277260')).toBe(false) // no +91
      expect(isValidIndianPhone('')).toBe(false)
    })
  })
})
