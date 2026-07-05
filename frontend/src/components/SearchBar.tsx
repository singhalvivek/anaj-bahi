'use client'

import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useI18n } from '@/lib/i18n/context'
import { listGrainTypes } from '@/lib/db/repo'
import type { BillFilter } from '@/lib/db/queries'

/**
 * Home search + filter bar. Emits a `{ text?, grainTypeId?, date? }` filter (empty
 * fields omitted) whenever any control changes; the parent drives the bill list via
 * `searchBills(filter)`. Filters combine with AND in the query layer.
 */
export function SearchBar({ onChange }: { onChange: (filter: BillFilter) => void }) {
  const { t, lang } = useI18n()
  const grainTypes = useLiveQuery(() => listGrainTypes(), [])

  const [text, setText] = useState('')
  const [grainTypeId, setGrainTypeId] = useState('')
  const [date, setDate] = useState('')

  // Emit the combined filter (only set fields) whenever any control changes.
  useEffect(() => {
    const filter: BillFilter = {}
    if (text.trim()) filter.text = text.trim()
    if (grainTypeId) filter.grainTypeId = grainTypeId
    if (date) filter.date = date
    onChange(filter)
    // onChange is a stable setter from the parent; deps are the control values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, grainTypeId, date])

  const grainName = (g: { nameEn: string; nameHi: string }): string =>
    lang === 'hi' ? g.nameHi : g.nameEn

  function clearAll() {
    setText('')
    setGrainTypeId('')
    setDate('')
  }

  const hasAny = !!(text.trim() || grainTypeId || date)

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <input
        data-testid="search-input"
        type="search"
        inputMode="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        className="h-12 w-full rounded-lg border border-stone-300 px-3 text-base focus:border-green-600 focus:outline-none"
      />
      <div className="flex gap-2">
        <select
          data-testid="filter-grain"
          value={grainTypeId}
          onChange={(e) => setGrainTypeId(e.target.value)}
          aria-label={t('search.grain')}
          className="h-12 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-2 text-base focus:border-green-600 focus:outline-none"
        >
          <option value="">{t('search.all')}</option>
          {grainTypes?.map((g) => (
            <option key={g.id} value={g.id}>
              {grainName(g)}
            </option>
          ))}
        </select>
        <input
          data-testid="filter-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label={t('search.date')}
          className="h-12 min-w-0 flex-1 rounded-lg border border-stone-300 px-2 text-base focus:border-green-600 focus:outline-none"
        />
      </div>
      <button
        data-testid="search-clear"
        type="button"
        onClick={clearAll}
        disabled={!hasAny}
        className="h-11 self-start rounded-lg px-3 text-sm font-medium text-green-700 underline underline-offset-2 disabled:text-stone-300 disabled:no-underline"
      >
        {t('search.clear')}
      </button>
    </div>
  )
}
