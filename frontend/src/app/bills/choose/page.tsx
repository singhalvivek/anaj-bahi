'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'

/**
 * New Bill chooser — the single entry point for creating a bill.
 * `+ New Bill` now routes here; the trader picks how to enter the bill:
 *   Fresh bill  → the unchanged sack-by-sack form (`/bills/new`).
 *   Quick entry → the summary form for a bill already written on paper (`/bills/quick`).
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
        {/* Fresh bill — the unchanged sack-by-sack flow */}
        <Link
          href="/bills/new"
          data-testid="choice-fresh"
          className="flex min-h-[96px] flex-col justify-center gap-1 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm active:bg-emerald-50"
        >
          <span className="flex items-center gap-2 text-xl font-bold text-stone-900">
            <span aria-hidden>📝</span>
            {t('choice.fresh.title')}
          </span>
          <span className="text-sm text-stone-500">{t('choice.fresh.hint')}</span>
        </Link>

        {/* Quick entry — the summary form for a paper bill */}
        <Link
          href="/bills/quick"
          data-testid="choice-quick"
          className="flex min-h-[96px] flex-col justify-center gap-1 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm active:bg-emerald-50"
        >
          <span className="flex items-center gap-2 text-xl font-bold text-stone-900">
            <span aria-hidden>⚡</span>
            {t('choice.quick.title')}
          </span>
          <span className="text-sm text-stone-500">{t('choice.quick.hint')}</span>
        </Link>
      </div>
    </div>
  )
}
