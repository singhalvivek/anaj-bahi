'use client'

// Owner-only Employees screen (Phase 8 · slice-c). Renders inside the AuthGate's
// `ready` branch as the `/employees` route (static-export-safe). Employees are
// refused the screen and see a labelled "owner only" notice; Security Rules are the
// real boundary — this UI gate is the friendly first line.
//
// The owner GENERATES a one-time invite code (by employee name + mobile), shares the
// code + mobile out-of-band, then manages PENDING (unclaimed) invites and the CLAIMED
// member roster below.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import { PhoneField, isValidIndianPhone } from '@/components/PhoneField'
import { createInvite, listPendingInvites, cancelInvite } from '@/lib/tenancy/invite'
import type { InviteRecord } from '@/lib/auth/membership'
import { listMembers, removeEmployee, type MemberRecord } from '@/lib/tenancy/business'

export default function EmployeesPage() {
  const { t } = useI18n()
  const { user } = useAuth()

  // AuthGate only renders children when status === 'ready', so `user` is set;
  // guard for the type and bail cleanly if it is somehow absent.
  if (!user) return null

  if (user.role !== 'owner') {
    return (
      <div
        data-testid="employees-forbidden"
        className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-5 py-12 text-center"
      >
        <span aria-hidden className="text-4xl">
          🔒
        </span>
        <p className="text-base font-medium text-stone-600">{t('employees.ownerOnly')}</p>
        <Link
          href="/"
          data-testid="employees-back"
          className="text-sm font-medium text-emerald-700 underline"
        >
          {t('employees.back')}
        </Link>
      </div>
    )
  }

  return <EmployeesOwnerView bizId={user.bizId ?? ''} />
}

function EmployeesOwnerView({ bizId }: { bizId: string }) {
  const { t } = useI18n()
  const { user } = useAuth()

  // Roster (claimed members)
  const [members, setMembers] = useState<MemberRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [removingUid, setRemovingUid] = useState<string | null>(null)

  // Pending (unclaimed) invites
  const [pending, setPending] = useState<InviteRecord[]>([])
  const [pendingError, setPendingError] = useState(false)
  const [cancellingCode, setCancellingCode] = useState<string | null>(null)

  // Generate-code form
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(false)
  const [lastInvite, setLastInvite] = useState<InviteRecord | null>(null)
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLSpanElement | null>(null)

  const refreshRoster = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setMembers(await listMembers(bizId))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [bizId])

  const refreshPending = useCallback(async () => {
    setPendingError(false)
    try {
      setPending(await listPendingInvites(bizId))
    } catch {
      setPendingError(true)
    }
  }, [bizId])

  useEffect(() => {
    void refreshRoster()
    void refreshPending()
  }, [refreshRoster, refreshPending])

  const trimmedName = name.trim()
  const canGenerate = trimmedName !== '' && isValidIndianPhone(mobile) && !generating

  async function onGenerate() {
    if (!user || !canGenerate) return
    setGenError(false)
    setGenerating(true)
    try {
      const invite = await createInvite(user, bizId, trimmedName, mobile)
      setLastInvite(invite)
      setCopied(false)
      setName('')
      setMobile('')
      await refreshPending()
    } catch {
      setGenError(true)
    } finally {
      setGenerating(false)
    }
  }

  async function onCopy(code: string) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
      } else if (codeRef.current) {
        // Fallback for browsers without the async clipboard API: select the text.
        const range = document.createRange()
        range.selectNodeContents(codeRef.current)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      setCopied(true)
    } catch {
      // Copy is best-effort; if it fails the code is still visible to type.
      setCopied(false)
    }
  }

  async function onCancel(code: string) {
    setCancellingCode(code)
    try {
      await cancelInvite(code)
      await refreshPending()
    } catch {
      setPendingError(true)
    } finally {
      setCancellingCode(null)
    }
  }

  async function onRemove(member: MemberRecord) {
    // Never remove an owner, and never remove yourself.
    if (member.role === 'owner') return
    if (user && member.uid === user.uid) return
    setRemovingUid(member.uid)
    try {
      await removeEmployee(bizId, { uid: member.uid, phone: member.phone })
      await refreshRoster()
    } catch {
      setRemovingUid(null)
    }
  }

  const inputClass =
    'w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-base text-stone-800 outline-none focus:border-emerald-500'
  const labelClass = 'text-sm font-medium text-stone-600'

  return (
    <div
      data-testid="employees-screen"
      className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8"
    >
      <h2 className="text-2xl font-semibold text-stone-800">{t('employees.title')}</h2>

      {/* Generate invite code */}
      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-800">{t('employees.addTitle')}</h3>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('employees.nameLabel')}</span>
          <input
            data-testid="employee-name-input"
            className={inputClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setGenError(false)
            }}
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('employees.phoneLabel')}</span>
          <PhoneField
            testId="employee-mobile-input"
            value={mobile}
            onChange={(next) => {
              setMobile(next)
              setGenError(false)
            }}
            ariaLabel={t('employees.phoneLabel')}
            className="min-h-[48px] rounded-xl border-2 border-stone-300 bg-white text-base text-stone-800 focus-within:border-emerald-500"
          />
        </label>

        {genError && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {t('error.generic')}
          </p>
        )}

        <button
          type="button"
          data-testid="generate-code-btn"
          onClick={() => void onGenerate()}
          disabled={!canGenerate}
          className="min-h-[56px] w-full rounded-xl bg-emerald-600 px-4 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-emerald-700"
        >
          {generating ? t('employees.generating') : t('employees.generateCode')}
        </button>

        {/* Freshly-generated code — shown large + prominent to copy and share */}
        {lastInvite && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 text-center">
            <p className="text-sm font-medium text-emerald-800">{t('employees.codeTitle')}</p>
            <span
              ref={codeRef}
              data-testid="invite-code"
              className="select-all font-mono text-4xl font-bold tracking-[0.35em] text-emerald-900"
            >
              {lastInvite.code}
            </span>
            <button
              type="button"
              data-testid="copy-code-btn"
              onClick={() => void onCopy(lastInvite.code)}
              className="rounded-lg border-2 border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 active:bg-emerald-100"
            >
              {copied ? t('employees.copied') : t('employees.copyCode')}
            </button>
            <p className="text-sm text-emerald-800">
              {t('employees.inviteMobile')}:{' '}
              <span className="font-semibold">{lastInvite.assignedPhone}</span>
            </p>
            <p className="text-xs text-emerald-700">{t('employees.codeShareHint')}</p>
          </div>
        )}
      </section>

      {/* Pending (unclaimed) invites */}
      <section
        data-testid="pending-invites"
        className="flex flex-col gap-3"
      >
        <h3 className="text-lg font-semibold text-stone-800">{t('employees.pendingTitle')}</h3>

        {pendingError && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {t('error.generic')}
          </p>
        )}

        {!pendingError && pending.length === 0 && (
          <p className="text-sm text-stone-500">{t('employees.pendingEmpty')}</p>
        )}

        {!pendingError &&
          pending.map((invite) => (
            <div
              key={invite.code}
              data-testid="pending-row"
              className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-base font-semibold text-stone-800">
                  {invite.displayName || invite.assignedPhone}
                </span>
                <span className="truncate text-sm text-stone-500">{invite.assignedPhone}</span>
                <span className="font-mono text-sm font-bold tracking-widest text-emerald-800">
                  {invite.code}
                </span>
              </div>
              <button
                type="button"
                data-testid="cancel-invite-btn"
                onClick={() => void onCancel(invite.code)}
                disabled={cancellingCode === invite.code}
                className="min-h-[44px] shrink-0 rounded-xl border-2 border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors disabled:opacity-60 active:bg-red-50"
              >
                {cancellingCode === invite.code
                  ? t('employees.cancelling')
                  : t('employees.cancelInvite')}
              </button>
            </div>
          ))}
      </section>

      {/* Claimed member roster */}
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-stone-800">{t('employees.rosterTitle')}</h3>

        {loading && (
          <div aria-busy="true" className="flex flex-col gap-3">
            <div className="h-16 animate-pulse rounded-2xl bg-stone-200" />
            <div className="h-16 animate-pulse rounded-2xl bg-stone-200" />
          </div>
        )}

        {!loading && loadError && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {t('error.generic')}
          </p>
        )}

        {!loading && !loadError && members.length === 0 && (
          <p className="text-sm text-stone-500">{t('employees.empty')}</p>
        )}

        {!loading &&
          !loadError &&
          members.map((member) => {
            const isOwner = member.role === 'owner'
            const isSelf = user != null && member.uid === user.uid
            const canRemove = !isOwner && !isSelf
            return (
              <div
                key={member.uid}
                data-testid="employee-row"
                className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base font-semibold text-stone-800">
                      {member.displayName || member.phone}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        isOwner
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {isOwner ? t('employees.roleOwner') : t('employees.roleEmployee')}
                    </span>
                  </div>
                  <span className="truncate text-sm text-stone-500">{member.phone}</span>
                </div>

                {canRemove && (
                  <button
                    type="button"
                    data-testid="remove-employee-btn"
                    onClick={() => void onRemove(member)}
                    disabled={removingUid === member.uid}
                    className="min-h-[44px] shrink-0 rounded-xl border-2 border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors disabled:opacity-60 active:bg-red-50"
                  >
                    {removingUid === member.uid
                      ? t('employees.removing')
                      : t('employees.remove')}
                  </button>
                )}
              </div>
            )
          })}
      </section>

      <Link
        href="/"
        data-testid="employees-back"
        className="text-center text-sm font-medium text-emerald-700 underline"
      >
        {t('employees.back')}
      </Link>
    </div>
  )
}
