'use client'

// Owner-only Employees screen (Phase 8). Renders inside the AuthGate's `ready`
// branch as the `/employees` route (static-export-safe). Employees are refused
// the roster/add form and see a labelled "owner only" notice; Security Rules are
// the real boundary — this UI gate is the friendly first line.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import {
  addEmployee,
  listMembers,
  removeEmployee,
  EmployeeExistsError,
  type MemberRecord,
} from '@/lib/tenancy/business'

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

  const [members, setMembers] = useState<MemberRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [phone, setPhone] = useState('+91')
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [removingUid, setRemovingUid] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const rows = await listMembers(bizId)
      setMembers(rows)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [bizId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const trimmedName = name.trim()
  const trimmedPhone = phone.trim()
  const canAdd = trimmedName !== '' && /^\+\d{7,15}$/.test(trimmedPhone) && !adding

  async function onAdd() {
    if (!user) return
    setAddError(null)
    if (!canAdd) return
    setAdding(true)
    try {
      await addEmployee(user, bizId, trimmedPhone, trimmedName)
      setPhone('+91')
      setName('')
      await refresh()
    } catch (err) {
      if (err instanceof EmployeeExistsError) {
        setAddError(t('employees.existsError'))
      } else {
        setAddError(t('error.generic'))
      }
    } finally {
      setAdding(false)
    }
  }

  async function onRemove(member: MemberRecord) {
    // Never remove an owner, and never remove yourself.
    if (member.role === 'owner') return
    if (user && member.uid === user.uid) return
    setRemovingUid(member.uid)
    try {
      await removeEmployee(bizId, { uid: member.uid, phone: member.phone })
      await refresh()
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

      {/* Add-employee form */}
      <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-stone-800">{t('employees.addTitle')}</h3>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('employees.phoneLabel')}</span>
          <input
            data-testid="employee-phone-input"
            className={inputClass}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setAddError(null)
            }}
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('employees.nameLabel')}</span>
          <input
            data-testid="employee-name-input"
            className={inputClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setAddError(null)
            }}
            autoComplete="off"
          />
        </label>

        {addError && (
          <p
            role="alert"
            data-testid="employees-add-error"
            className="text-sm font-medium text-red-600"
          >
            {addError}
          </p>
        )}

        <button
          type="button"
          data-testid="add-employee-btn"
          onClick={onAdd}
          disabled={!canAdd}
          className="min-h-[56px] w-full rounded-xl bg-emerald-600 px-4 text-lg font-semibold text-white transition-colors disabled:opacity-60 active:bg-emerald-700"
        >
          {adding ? t('employees.adding') : t('employees.add')}
        </button>
      </section>

      {/* Roster */}
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
