'use client'

import { Suspense, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { useI18n } from '@/lib/i18n/context'
import * as repo from '@/lib/db/repo'
import type { Bill } from '@/lib/db/repo'
import { computeGrainLine, computeBillTotal, billBalance, todayIso } from '@/lib/calc'
import type { StoredGrainLine } from '@/lib/db/schema'
import { formatRupees, formatDate } from '@/components/format'
import Receipt from '@/components/receipt/Receipt'
import { shareReceiptImage, type ShareResult } from '@/lib/share/shareImage'
import { getProfile } from '@/lib/settings/profile'

/** Keep digits and at most one decimal point; strip everything else. */
function sanitizeDecimal(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, '')
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
  }
  return s
}

/**
 * Payments panel: paid / outstanding / fully-paid badge, the payment history
 * (newest first) and an add-payment form. Balance math comes only from
 * `billBalance` in lib/calc. Payments are always addable, even once the bill
 * is edit-locked. Live reactivity comes from the parent's useLiveQuery on the
 * bill (addPayment writes db.bills → the query re-runs and re-renders here).
 */
function PaymentsPanel({ bill }: { bill: Bill }) {
  const { t } = useI18n()
  const { paid, outstanding, fullyPaid } = billBalance(bill)

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  const parsedAmount = parseFloat(amount)
  const canAdd = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0 && !saving

  // Newest first without mutating the stored array.
  const history = [...bill.payments].sort((a, b) => b.createdAt - a.createdAt)

  async function addPayment() {
    if (!canAdd) return
    setSaving(true)
    setError(false)
    try {
      await repo.addPayment(bill.id, {
        amount: parsedAmount,
        date,
        note: note.trim() || undefined,
      })
      setAmount('')
      setNote('')
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-stone-800">{t('payment.title')}</h3>
        {fullyPaid && (
          <span
            data-testid="fully-paid"
            className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800"
          >
            ✓ {t('payment.fullyPaid')}
          </span>
        )}
      </div>

      {/* Balance summary */}
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-stone-500">{t('payment.paid')}</dt>
        <dd data-testid="paid-total" className="text-right font-semibold text-stone-800">
          {formatRupees(paid)}
        </dd>
        <dt className="font-medium text-stone-600">{t('payment.outstanding')}</dt>
        <dd
          data-testid="outstanding-balance"
          className={`text-right text-lg font-bold ${
            outstanding > 0 ? 'text-amber-700' : 'text-green-700'
          }`}
        >
          {formatRupees(Math.max(0, outstanding))}
        </dd>
        {outstanding < 0 && (
          <>
            <dt className="text-stone-500">{t('payment.advance')}</dt>
            <dd data-testid="advance-credit" className="text-right font-semibold text-green-700">
              {formatRupees(Math.abs(outstanding))}
            </dd>
          </>
        )}
      </dl>

      {/* Payment history — newest first */}
      {history.length > 0 ? (
        <ul className="flex flex-col divide-y divide-stone-100 rounded-lg border border-stone-100">
          {history.map((p) => (
            <li
              key={p.id}
              data-testid="payment-row"
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span className="font-medium text-stone-800">{formatRupees(p.amount)}</span>
              <div className="flex flex-col items-end">
                <span className="text-stone-500">{formatDate(p.date)}</span>
                {p.note ? <span className="text-xs text-stone-400">{p.note}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-400">{t('payment.none')}</p>
      )}

      {/* Add-payment form — always enabled, even when the bill is locked */}
      <div className="space-y-2 rounded-lg bg-stone-50 p-3">
        <label className="text-sm font-medium text-stone-700">{t('payment.amount')}</label>
        <input
          data-testid="payment-amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(sanitizeDecimal(e.target.value))}
          placeholder={t('payment.amount')}
          className="h-14 w-full rounded-lg border border-stone-300 px-4 text-lg focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        <label className="text-sm font-medium text-stone-700">{t('payment.date')}</label>
        <input
          data-testid="payment-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 w-full rounded-lg border border-stone-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
        />

        <label className="text-sm font-medium text-stone-700">{t('payment.note')}</label>
        <input
          data-testid="payment-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('payment.note')}
          className="h-12 w-full rounded-lg border border-stone-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
        />

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {t('error.generic')}
          </p>
        )}

        <button
          type="button"
          data-testid="payment-add"
          onClick={addPayment}
          disabled={!canAdd}
          className="h-14 w-full rounded-xl bg-emerald-600 text-lg font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t('action.saving') : t('payment.add')}
        </button>
      </div>
    </section>
  )
}

/**
 * Share-as-image panel. A real Share button opens a receipt preview (a bottom
 * sheet, positioned BELOW the sticky top bar so the language toggle stays
 * reachable — language of the rasterised image follows the live toggle). The
 * preview renders <Receipt> and shares it as a PNG via shareReceiptImage:
 *   - phone with native file share  → native share sheet ('shared')
 *   - otherwise (desktop/headless)  → PNG download + a clear fallback note
 * Never a dead button.
 */
function SharePanel({
  bill,
  farmerPhone,
  grainName,
}: {
  bill: Bill
  farmerPhone?: string
  grainName: (id: string) => string
}) {
  const { t } = useI18n()
  const receiptRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<ShareResult | null>(null)
  const [error, setError] = useState(false)

  // Business profile drives the receipt header; useLiveQuery keeps it in sync if
  // the trader edits Settings. Undefined while loading; never a blank shopName.
  const profile = useLiveQuery(() => getProfile(), [])

  function openPreview() {
    setResult(null)
    setError(false)
    setOpen(true)
  }

  function closePreview() {
    setOpen(false)
    setResult(null)
    setError(false)
  }

  async function onShare() {
    const node = receiptRef.current
    if (!node || generating) return
    setGenerating(true)
    setError(false)
    setResult(null)
    try {
      const filename = `receipt-${bill.id.replace(/\//g, '-')}.png`
      const r = await shareReceiptImage(node, filename)
      setResult(r)
    } catch {
      setError(true)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="share-receipt"
        onClick={openPreview}
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-green-700 text-lg font-semibold text-white shadow active:bg-green-800"
      >
        <span aria-hidden>📤</span>
        {t('share.button')}
      </button>

      {open ? (
        <div
          className="fixed inset-x-0 bottom-0 top-[72px] z-30 mx-auto flex w-full max-w-md flex-col bg-stone-900/50"
          role="dialog"
          aria-modal="true"
          aria-label={t('share.preview')}
        >
          {/* Tap the backdrop above the sheet to dismiss */}
          <button
            type="button"
            aria-label={t('share.close')}
            onClick={closePreview}
            className="h-6 w-full flex-shrink-0 cursor-default"
            tabIndex={-1}
          />

          <div
            data-testid="receipt-preview"
            className="flex min-h-0 flex-1 flex-col rounded-t-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <h3 className="text-base font-semibold text-stone-800">{t('share.preview')}</h3>
              <button
                type="button"
                data-testid="share-close"
                onClick={closePreview}
                className="rounded-full px-3 py-1 text-sm font-medium text-stone-500 active:bg-stone-100"
              >
                ✕ {t('share.close')}
              </button>
            </div>

            {/* Scrollable receipt preview */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-stone-100 p-4">
              <div className="mx-auto w-fit rounded-lg shadow-sm">
                {profile ? (
                  <Receipt
                    ref={receiptRef}
                    bill={bill}
                    profile={profile}
                    farmerPhone={farmerPhone}
                    grainName={grainName}
                  />
                ) : (
                  <div
                    className="h-64 w-[380px] animate-pulse rounded bg-stone-200"
                    aria-hidden
                  />
                )}
              </div>
            </div>

            {/* Actions + fallback / error messaging */}
            <div className="flex flex-col gap-2 border-t border-stone-200 px-4 py-3">
              {error ? (
                <p
                  data-testid="share-error"
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm font-medium text-red-700"
                >
                  {t('share.error')}
                </p>
              ) : null}

              {result === 'downloaded' ? (
                <p
                  data-testid="share-fallback"
                  role="status"
                  className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm font-medium text-amber-800"
                >
                  {t('share.unsupported')}
                </p>
              ) : null}

              <button
                type="button"
                data-testid="share-image"
                onClick={onShare}
                disabled={generating || !profile}
                className="flex h-14 items-center justify-center gap-2 rounded-xl bg-green-700 text-lg font-semibold text-white shadow active:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? t('share.generating') : t('share.button')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

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

  // Edit-lock is derived from data (never a stored flag): once a payment exists,
  // purchase details are frozen and only payments may be added.
  const locked = bill.payments.length > 0

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
          {bill.dueDate ? (
            <span>
              {t('dueDate.label')}: {formatDate(bill.dueDate)}
            </span>
          ) : null}
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

      {/* Payments + outstanding balance (Phase 2) */}
      <PaymentsPanel bill={bill} />

      {/* Edit action / edit-lock notice.
          Editable (no payments) → Edit re-opens the form pre-filled.
          Locked (≥1 payment)    → Edit is disabled and a clear lock notice shows;
          add-payment above stays enabled. */}
      {locked ? (
        <>
          <p
            data-testid="edit-locked"
            className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
          >
            🔒 {t('lock.locked')}
          </p>
          <button
            type="button"
            data-testid="detail-edit"
            disabled
            aria-disabled="true"
            className="flex h-12 items-center justify-center rounded-full border border-stone-300 text-sm font-semibold text-stone-400"
          >
            {t('action.edit')}
          </button>
        </>
      ) : (
        <Link
          href={`/bills/new?edit=${encodeURIComponent(bill.id)}`}
          data-testid="detail-edit"
          className="flex h-12 items-center justify-center rounded-full border border-green-700 text-sm font-semibold text-green-700 active:bg-green-50"
        >
          {t('action.edit')}
        </Link>
      )}

      {/* Share the bill as a bilingual receipt image (Phase 3) */}
      <SharePanel bill={bill} farmerPhone={farmer?.phone} grainName={grainName} />
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
