'use client'

// Owner-only activity feed (Phase 9). Renders the live, newest-first log from
// `useActivity()`. `undefined` = not loaded yet (loading state); `[]` = loaded &
// empty (also the fail-safe value a non-owner listener resolves to). Each row
// shows the actor, a translated action label, the summary, and the time.

import { useI18n } from '@/lib/i18n/context'
import { useActivity } from '@/lib/db/hooks'
import type { ActivityType } from '@/lib/db/schema'

// Map each activity type to its translation key (labels live in the dictionary).
const ACTION_KEY: Record<ActivityType, string> = {
  'bill-create': 'activity.action.billCreate',
  payment: 'activity.action.payment',
  'bill-edit': 'activity.action.billEdit',
}

// Locale-neutral "dd/mm/yyyy HH:MM" from an epoch-ms timestamp (Western digits in
// both languages — mirrors format.ts's date convention). Falls back to an empty
// string for an unparseable value so a bad row never crashes the list.
function formatAt(at: number): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function ActivityLog() {
  const { t } = useI18n()
  const entries = useActivity()

  // Loading — first snapshot not in yet.
  if (entries === undefined) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <div className="h-20 animate-pulse rounded-2xl bg-stone-200" />
        <div className="h-20 animate-pulse rounded-2xl bg-stone-200" />
        <div className="h-20 animate-pulse rounded-2xl bg-stone-200" />
      </div>
    )
  }

  // Empty — loaded, nothing to show.
  if (entries.length === 0) {
    return (
      <p data-testid="activity-empty" className="rounded-2xl bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
        {t('activity.empty')}
      </p>
    )
  }

  return (
    <ul data-testid="activity-log" className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li
          key={entry.id}
          data-testid="activity-row"
          className="flex flex-col gap-1 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-base font-semibold text-stone-800">{entry.actorName}</span>
            <span className="shrink-0 text-xs text-stone-400">{formatAt(entry.at)}</span>
          </div>
          <span className="text-sm font-medium text-emerald-700">{t(ACTION_KEY[entry.type])}</span>
          <span className="break-words text-sm text-stone-600">{entry.summary}</span>
        </li>
      ))}
    </ul>
  )
}
