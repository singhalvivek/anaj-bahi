'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import { PhoneField, isValidIndianPhone } from '@/components/PhoneField'
import { checkInvite, type InviteRecord } from '@/lib/auth/membership'
import { getInvite } from '@/lib/tenancy/invite'

/** Pull a translatable i18n key off an AuthError, else a generic fallback. */
function errorKey(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'messageKey' in err &&
    typeof (err as { messageKey: unknown }).messageKey === 'string'
  ) {
    return (err as { messageKey: string }).messageKey
  }
  return 'auth.error.generic'
}

type Phase = 'code' | 'mobile' | 'name'

/**
 * Onboarding (Employee, route `join`): redeem an owner-generated invite in three
 * sequential steps inside one screen (replaces the retired "ask your owner"
 * dead-end).
 *
 *   1. code   — enter the 6-char code; `getInvite` must find it (else notFound),
 *               then advance.
 *   2. mobile — enter the mobile; `checkInvite` must match `invite.phoneKey`
 *               (distinct phone-mismatch vs not-found errors), then advance.
 *   3. name   — confirm the name (prefilled from Google); `joinByCode` performs
 *               the atomic claim. On success the provider flips status → ready and
 *               this screen unmounts.
 *
 * A Back affordance steps between phases; a Sign-out fallback lets the user bail.
 */
export function JoinByCode() {
  const { t } = useI18n()
  const { user, joinByCode, signOut } = useAuth()

  const [phase, setPhase] = useState<Phase>('code')
  const [code, setCode] = useState('')
  const [invite, setInvite] = useState<InviteRecord | null>(null)
  const [mobile, setMobile] = useState('') // canonical E.164 from PhoneField
  const [name, setName] = useState(user?.displayName ?? '')

  const [busy, setBusy] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const normalizedCode = code.trim().toUpperCase()
  const trimmedName = name.trim()
  const mobileValid = isValidIndianPhone(mobile)

  async function onVerifyCode() {
    setError(null)
    if (!normalizedCode || busy) return
    setBusy(true)
    try {
      const found = await getInvite(normalizedCode)
      if (!found) {
        setError(t('onboarding.join.notFound'))
        return
      }
      setInvite(found)
      setPhase('mobile')
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  function onVerifyMobile() {
    setError(null)
    if (!mobileValid || busy) return
    const check = checkInvite(invite, mobile)
    if (check.kind === 'phone-mismatch') {
      setError(t('onboarding.join.phoneMismatch'))
      return
    }
    if (check.kind !== 'ok') {
      setError(t('onboarding.join.notFound'))
      return
    }
    setPhase('name')
  }

  async function onJoin() {
    setError(null)
    if (!trimmedName || busy) return
    setBusy(true)
    try {
      // Atomic claim; on success the provider flips status → ready and unmounts us.
      await joinByCode({ code: normalizedCode, phoneE164: mobile, name: trimmedName })
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }

  function goBack() {
    setError(null)
    if (phase === 'mobile') setPhase('code')
    else if (phase === 'name') setPhase('mobile')
  }

  async function onSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      // Keep the screen usable even if sign-out rejects; nothing to surface.
      setSigningOut(false)
    }
  }

  const inputClass =
    'h-14 w-full rounded-xl border-2 border-stone-300 bg-white px-4 text-lg text-stone-800 outline-none focus:border-green-600'
  const fieldBox = 'h-14 rounded-xl border-2 border-stone-300 bg-white text-lg text-stone-800 focus-within:border-green-600'
  const primaryBtn =
    'flex min-h-[56px] w-full items-center justify-center rounded-xl bg-green-700 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-green-800'
  const backBtn =
    'text-sm font-medium text-green-700 underline underline-offset-2 disabled:opacity-60'
  const signOutBtn =
    'flex min-h-[56px] w-full items-center justify-center rounded-xl border-2 border-stone-300 bg-white text-lg font-semibold text-stone-700 transition-colors disabled:opacity-60 active:bg-stone-100'

  return (
    <div
      data-testid="join-by-code"
      className="flex min-h-screen w-full flex-col items-center justify-center px-5 py-10"
    >
      <div className="flex w-full max-w-md flex-col gap-6">
        <h1 className="text-2xl font-bold text-green-800">{t('onboarding.join.title')}</h1>

        {phase === 'code' && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-600">
                {t('onboarding.join.codeLabel')}
              </span>
              <input
                data-testid="join-code-input"
                className={`${inputClass} font-mono uppercase tracking-[0.3em]`}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t('onboarding.join.codePlaceholder')}
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={6}
              />
              <span className="text-xs text-stone-500">{t('onboarding.join.codeHint')}</span>
            </label>

            {error && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              data-testid="join-code-next"
              onClick={onVerifyCode}
              disabled={!normalizedCode || busy}
              className={primaryBtn}
            >
              {busy ? t('onboarding.join.verifying') : t('onboarding.join.next')}
            </button>
          </div>
        )}

        {phase === 'mobile' && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-600">
                {t('onboarding.join.mobileLabel')}
              </span>
              <PhoneField
                testId="join-mobile-input"
                value={mobile}
                onChange={setMobile}
                ariaLabel={t('onboarding.join.mobileLabel')}
                className={fieldBox}
              />
              <span className="text-xs text-stone-500">{t('onboarding.join.mobileHint')}</span>
            </label>

            {error && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              data-testid="join-mobile-next"
              onClick={onVerifyMobile}
              disabled={!mobileValid || busy}
              className={primaryBtn}
            >
              {t('onboarding.join.next')}
            </button>

            <button type="button" onClick={goBack} disabled={busy} className={backBtn}>
              {t('onboarding.join.back')}
            </button>
          </div>
        )}

        {phase === 'name' && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-600">
                {t('onboarding.join.nameLabel')}
              </span>
              <input
                data-testid="join-name-input"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>

            {error && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              data-testid="join-submit"
              onClick={onJoin}
              disabled={!trimmedName || busy}
              className={primaryBtn}
            >
              {busy ? t('onboarding.join.joining') : t('onboarding.join.submit')}
            </button>

            <button type="button" onClick={goBack} disabled={busy} className={backBtn}>
              {t('onboarding.join.back')}
            </button>
          </div>
        )}

        <button
          type="button"
          data-testid="join-signout"
          onClick={onSignOut}
          disabled={signingOut || busy}
          className={signOutBtn}
        >
          {t('onboarding.join.signOut')}
        </button>
      </div>
    </div>
  )
}
