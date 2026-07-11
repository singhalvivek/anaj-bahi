'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '@/lib/auth/context'
import { useI18n } from '@/lib/i18n/context'
import { firestore } from '@/lib/firebase/app'

/**
 * The signed-in identity strip shown when `status === 'ready'`, mounted by the
 * AuthGate directly under the TopBar. It shows who is signed in (display name),
 * the business name, a role badge (owner/employee), and a Sign out button.
 *
 * On the home screen ('/') it also renders the labelled "shared cloud & roles —
 * coming soon" banner so the trader understands the bill list below is still the
 * current LOCAL store and that the shared-cloud/roles wiring lands next — it must
 * read as intentional, not a bug. The banner stays out of the way on other
 * screens; the identity strip (with Sign out) stays reachable everywhere.
 *
 * Phase 6's `useAuth().user` carries `bizId`/`role` but not the business name, so
 * the name is read once from Firestore `businesses/{bizId}`; if it is unavailable
 * (offline / first render) the role still renders and the name shows a neutral
 * placeholder until it resolves.
 */
export function GatedHomeHeader() {
  const { user, signOut } = useAuth()
  const { t } = useI18n()
  const pathname = usePathname() ?? '/'
  const isHome = pathname === '/'

  const [bizName, setBizName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const bizId = user?.bizId
    if (!bizId) {
      setBizName(null)
      return
    }
    getDoc(doc(firestore, 'businesses', bizId))
      .then((snap) => {
        if (cancelled) return
        const data = snap.data() as { shopName?: string } | undefined
        setBizName(data?.shopName ?? null)
      })
      .catch(() => {
        // Offline / read error — leave the placeholder; never crash the shell.
        if (!cancelled) setBizName(null)
      })
    return () => {
      cancelled = true
    }
  }, [user?.bizId])

  const roleKey = user?.role === 'employee' ? 'home.role.employee' : 'home.role.owner'
  const isEmployee = user?.role === 'employee'

  return (
    <div data-testid="gated-home" className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm text-stone-500">
            {t('home.greeting')}{' '}
            <span data-testid="home-user-name" className="font-semibold text-stone-800">
              {user?.displayName ?? '—'}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <span
              data-testid="home-business-name"
              className="truncate text-base font-bold text-stone-900"
            >
              {bizName ?? '—'}
            </span>
            <span
              data-testid="home-role"
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                isEmployee ? 'bg-sky-100 text-sky-700' : 'bg-green-100 text-green-700'
              }`}
            >
              {t(roleKey)}
            </span>
          </div>
        </div>
        <button
          type="button"
          data-testid="sign-out-btn"
          onClick={() => {
            void signOut()
          }}
          className="shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 active:bg-stone-100"
        >
          {t('home.signOut')}
        </button>
      </div>

      {isHome && (
        <div className="px-4 pt-3">
          <div
            data-testid="stub-shared-cloud"
            aria-disabled="true"
            className="select-none rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 px-4 py-3"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <span aria-hidden>🔒</span>
              <span>{t('home.comingSoon.title')}</span>
            </div>
            <p className="mt-1 text-xs leading-snug text-amber-700/90">{t('home.comingSoon.body')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
