'use client'

// Activity-log screen — owner OR partner (managers) (Phase 9). Renders inside the
// AuthGate's `ready` branch as the `/activity` route (static-export-safe, mirrors
// `/employees`). Employees are refused the feed and see a labelled "owners & partners
// only" notice; Security Rules are the real boundary (activity reads are manager-only,
// `canManage`) — this UI gate is the friendly first line.

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useAuth } from '@/lib/auth/context'
import { ActivityLog } from '@/components/activity/ActivityLog'

export default function ActivityPage() {
  const { t } = useI18n()
  const { user } = useAuth()

  // AuthGate only renders children when status === 'ready', so `user` is set;
  // guard for the type and bail cleanly if it is somehow absent.
  if (!user) return null

  const canManage = user.role === 'owner' || user.role === 'partner'
  if (!canManage) {
    return (
      <div
        data-testid="activity-forbidden"
        className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-5 py-12 text-center"
      >
        <span aria-hidden className="text-4xl">
          🔒
        </span>
        <p className="text-base font-medium text-stone-600">{t('activity.ownerOnly')}</p>
        <Link
          href="/"
          data-testid="activity-back"
          className="text-sm font-medium text-emerald-700 underline"
        >
          {t('activity.back')}
        </Link>
      </div>
    )
  }

  return (
    <div
      data-testid="activity-screen"
      className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8"
    >
      <h2 className="text-2xl font-semibold text-stone-800">{t('activity.title')}</h2>

      <ActivityLog />

      <Link
        href="/"
        data-testid="activity-back"
        className="text-center text-sm font-medium text-emerald-700 underline"
      >
        {t('activity.back')}
      </Link>
    </div>
  )
}
