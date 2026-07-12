'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useBills, useGrainTypes } from '@/lib/db/hooks'
import { searchBills, type BillFilter } from '@/lib/db/queries'
import { computeBillTotal } from '@/lib/calc'
import { SearchBar } from '@/components/SearchBar'
import { formatRupees, formatDate } from '@/components/format'

export default function HomePage() {
  const { t, lang } = useI18n()

  const [filter, setFilter] = useState<BillFilter>({})
  const hasFilter = Object.keys(filter).length > 0

  // Reactive reads — the live Firestore bill list re-renders on any write; the
  // pure filter re-runs whenever the list or the search/filter changes.
  const allBills = useBills()
  const bills = useMemo(() => searchBills(allBills ?? [], filter), [allBills, filter])
  const grainTypes = useGrainTypes()

  const grainName = (id: string): string => {
    const g = grainTypes?.find((gt) => gt.id === id)
    if (!g) return id
    return lang === 'hi' ? g.nameHi : g.nameEn
  }

  const loading = allBills === undefined

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Search / Filter — real Phase-2 feature (replaces the Phase-1 stub) */}
      <SearchBar onChange={setFilter} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-700">{t('bills.title')}</h2>
      </div>

      {loading ? (
        <ul className="flex flex-col gap-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-24 animate-pulse rounded-xl bg-stone-200" />
          ))}
        </ul>
      ) : bills.length === 0 ? (
        hasFilter ? (
          <div
            data-testid="search-no-results"
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center"
          >
            <span className="text-4xl" aria-hidden>
              🔍
            </span>
            <p className="text-stone-500">{t('search.noResults')}</p>
          </div>
        ) : (
          <div
            data-testid="bill-list"
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center"
          >
            <span className="text-4xl" aria-hidden>
              📒
            </span>
            <p className="text-stone-500">{t('bills.empty')}</p>
          </div>
        )
      ) : (
        <ul data-testid="bill-list" className="flex flex-col gap-3">
          {bills.map((bill) => (
            <li key={bill.id}>
              <Link
                href={`/bill?id=${encodeURIComponent(bill.id)}`}
                data-testid="bill-card"
                className="block rounded-xl border border-stone-200 bg-white p-4 shadow-sm active:bg-stone-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-stone-900">
                      {bill.farmerName}
                      {bill.farmerPlace ? (
                        <span className="font-normal text-stone-500"> · {bill.farmerPlace}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {bill.id} · {formatDate(bill.purchaseDate)}
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-bold text-green-700">
                    {formatRupees(computeBillTotal(bill.lines))}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {bill.grainTypeIds.map((gid) => (
                    <span
                      key={gid}
                      className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
                    >
                      {grainName(gid)}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Primary action — large, thumb-reachable above the bottom nav. */}
      <Link
        href="/bills/choose"
        data-testid="new-bill-btn"
        className="fixed inset-x-0 bottom-16 z-10 mx-auto flex w-full max-w-md justify-center px-4"
      >
        <span className="flex h-14 w-full items-center justify-center rounded-full bg-green-700 text-base font-semibold text-white shadow-lg active:bg-green-800">
          {t('bills.new')}
        </span>
      </Link>
    </div>
  )
}
