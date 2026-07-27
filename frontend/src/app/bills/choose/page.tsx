'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'

/**
 * New Bill chooser — the single entry point for creating a bill.
 * `+ New Bill` routes here; the trader picks how to enter the bill:
 *   Quick entry → the summary form for a bill already written on paper (`/bills/quick`).
 *   Fresh bill  → the unchanged sack-by-sack form (`/bills/new`).
 *
 * **Phase 12 — Quick entry is FIRST and primary.** Per-sack weights are proof for
 * the *farmer*, not a figure the trader reads back, and the paper bill is written
 * before the phone comes out. So transcribing totals is the everyday path, and the
 * sack-by-sack form is for when the farmer wants every sack itemised. Ordering the
 * slower flow first was asking the trader to take the long route by default.
 *
 * Both routes, testids and journeys are otherwise unchanged.
 */
export default function ChooseBillPage() {
  const { t } = useI18n()

  return (
    <div className="flex flex-col">
      {/* Sub-header: back link + screen title */}
      <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-2.5">
        <Link
          href="/"
          className="flex h-11 min-w-11 items-center text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          ← {t('action.back')}
        </Link>
        <h2 className="text-lg font-bold text-stone-900">{t('choice.title')}</h2>
      </div>

      <div data-testid="new-bill-choice" className="flex flex-col gap-4 p-4">
        {/* Quick entry — FIRST and primary (Phase 12): the everyday path, for a
            bill already written on paper. Stronger border + filled background so
            the recommendation reads at a glance, not just from the pill. */}
        <Link
          href="/bills/quick"
          data-testid="choice-quick"
          className="flex min-h-[112px] flex-col justify-center gap-1 rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-5 shadow-sm active:bg-emerald-100"
        >
          <span className="flex flex-wrap items-center gap-2 text-xl font-bold text-stone-900">
            <span aria-hidden>⚡</span>
            {t('choice.quick.title')}
            <span
              data-testid="choice-quick-badge"
              className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"
            >
              {t('choice.recommended')}
            </span>
          </span>
          <span className="text-sm text-stone-600">{t('choice.quick.hint')}</span>
        </Link>

        {/* Fresh bill — the unchanged sack-by-sack flow, now the secondary option */}
        <Link
          href="/bills/new"
          data-testid="choice-fresh"
          className="flex min-h-[96px] flex-col justify-center gap-1 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm active:bg-stone-50"
        >
          <span className="flex items-center gap-2 text-lg font-semibold text-stone-800">
            <span aria-hidden>📝</span>
            {t('choice.fresh.title')}
          </span>
          <span className="text-sm text-stone-500">{t('choice.fresh.hint')}</span>
        </Link>
      </div>
    </div>
  )
}
