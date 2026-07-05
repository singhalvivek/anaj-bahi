'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { useI18n } from '@/lib/i18n/context'
import * as repo from '@/lib/db/repo'
import { computeGrainLine, computeBillTotal } from '@/lib/calc'
import type { StoredGrainLine } from '@/lib/db/schema'
import { ComingSoon } from '@/components/ComingSoon'
import { formatRupees, formatDate } from '@/components/format'

function DetailBody() {
  const { t, lang } = useI18n()
  const params = useSearchParams()
  const id = params.get('id') ?? '' // Next already decodes query params.

  // Return `null` (not undefined) for a missing bill so loading (undefined) and
  // not-found (null) are distinguishable.
  const bill = useLiveQuery(
    () => (id ? repo.getBill(id).then((b) => b ?? null) : Promise.resolve(null)),
    [id],
  )
  const farmer = useLiveQuery(
    () => (bill ? repo.getFarmer(bill.farmerId) : Promise.resolve(undefined)),
    [bill?.farmerId],
  )
  const grainTypes = useLiveQuery(() => repo.listGrainTypes(), [])

  const grainName = (gid: string): string => {
    const g = grainTypes?.find((gt) => gt.id === gid)
    if (!g) return gid
    return lang === 'hi' ? g.nameHi : g.nameEn
  }

  if (bill === undefined) {
    return (
      <div className="px-4 py-8">
        <div className="h-40 animate-pulse rounded-xl bg-stone-200" aria-hidden />
      </div>
    )
  }

  if (bill === null) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="text-4xl" aria-hidden>
          🔍
        </span>
        <p className="text-stone-500">{t('bills.empty')}</p>
        <Link
          href="/"
          className="rounded-full bg-green-700 px-5 py-2.5 text-sm font-semibold text-white"
        >
          {t('action.back')}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Farmer + bill meta */}
      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        <p className="text-lg font-bold text-stone-900">{bill.farmerName}</p>
        {bill.farmerPlace ? <p className="text-stone-500">{bill.farmerPlace}</p> : null}
        {farmer?.phone ? (
          <p className="text-sm text-stone-500">
            {t('detail.phone')}: {farmer.phone}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-stone-400">
          <span>{bill.id}</span>
          <span>
            {t('bills.card.date')}: {formatDate(bill.purchaseDate)}
          </span>
        </div>
      </section>

      {/* Grain lines with full sack-by-sack breakdown */}
      {bill.lines.map((line: StoredGrainLine, li: number) => {
        const totals = computeGrainLine(line)
        return (
          <section
            key={line.id ?? li}
            className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-stone-800">{grainName(line.grainTypeId)}</h3>
              <span className="text-sm text-stone-500">
                {t('grain.price')}: {formatRupees(line.pricePerQuintal)}
              </span>
            </div>

            {/* Sack-by-sack list */}
            <ol
              data-testid="detail-sack-list"
              className="mt-3 flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-100"
            >
              {line.sackWeights.map((w, si) => (
                <li
                  key={si}
                  data-testid="detail-sack-row"
                  className="flex items-center justify-between px-3 py-1.5 text-sm"
                >
                  <span className="text-stone-400">#{si + 1}</span>
                  <span className="font-medium text-stone-700">{w} kg</span>
                </li>
              ))}
            </ol>

            {/* Deductions */}
            {line.deductions.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-stone-400">{t('deduction.label')}</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {line.deductions.map((d, di) => (
                    <li key={di} className="flex justify-between text-sm text-stone-600">
                      <span>{t(`deduction.basis.${d.basis}`)}</span>
                      <span>{d.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Line totals */}
            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-stone-400">{t('sack.summary')}</dt>
              <dd className="text-right text-stone-700">{totals.sackCount}</dd>
              <dt className="text-stone-400">{t('totals.gross')}</dt>
              <dd className="text-right text-stone-700">{totals.grossWeightKg} kg</dd>
              <dt className="text-stone-400">{t('totals.deduction')}</dt>
              <dd className="text-right text-stone-700">{totals.deductionKg} kg</dd>
              <dt className="font-medium text-stone-600">{t('totals.net')}</dt>
              <dd className="text-right font-medium text-stone-800">{totals.netWeightKg} kg</dd>
              <dt className="font-medium text-stone-600">{t('totals.lineAmount')}</dt>
              <dd className="text-right font-semibold text-green-700">
                {formatRupees(totals.amount)}
              </dd>
            </dl>
          </section>
        )
      })}

      {/* Bill total */}
      <section className="flex items-center justify-between rounded-xl bg-green-700 px-4 py-4 text-white shadow-sm">
        <span className="text-sm font-medium">{t('totals.billTotal')}</span>
        <span data-testid="detail-bill-total" className="text-2xl font-bold">
          {formatRupees(computeBillTotal(bill.lines))}
        </span>
      </section>

      {/* Edit action (Phase 1: links to the form). */}
      <Link
        href="/bills/new"
        data-testid="detail-edit"
        className="flex h-12 items-center justify-center rounded-full border border-green-700 text-sm font-semibold text-green-700 active:bg-green-50"
      >
        {t('action.edit')}
      </Link>

      {/* Deferred features — labelled stubs */}
      <ComingSoon feature={t('stub.payments')} testid="stub-payments" />
      <ComingSoon feature={t('stub.share')} testid="stub-share" />
    </div>
  )
}

export default function BillDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-8">
          <div className="h-40 animate-pulse rounded-xl bg-stone-200" aria-hidden />
        </div>
      }
    >
      <DetailBody />
    </Suspense>
  )
}
