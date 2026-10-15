'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useI18n, type TKey } from '@/lib/i18n/context'
import { formatRupees } from '@/components/format'
import { prepareBillPhoto, previewUrl } from '@/lib/billcheck/image'
import { isBillCheckConfigured, readBillWithGemini } from '@/lib/billcheck/reader'
import { verifyReadBill } from '@/lib/billcheck/verify'
import { isBillReadError, type BillReadErrorKind, type ReadBill } from '@/lib/billcheck/types'
import { ReadTable, type EditableField } from '@/components/billcheck/ReadTable'
import { VerdictCard } from '@/components/billcheck/VerdictCard'

/**
 * Bill Check — photograph a bill already written on paper, have it read, and have
 * the app check the arithmetic.
 *
 * This screen WRITES NOTHING. No Bill, no farmer, no Firestore document, no
 * payment. It cannot corrupt a ledger because it never touches one, which is also
 * what makes it safe for a trader to try on day one.
 *
 * It is the only ONLINE-ONLY screen in the app. Every other screen works in
 * airplane mode, so a trader has no reason to suspect the difference — which is
 * why each failure cause gets its own specific bilingual message rather than a
 * generic "something went wrong", and why the photo is always retained so a retry
 * never costs a re-shoot.
 *
 * The arithmetic is entirely local (`lib/calc` via `verifyReadBill`), so
 * correcting a misread digit re-verifies instantly with NO second API call.
 *
 * See spec/capabilities/bill-check.md and spec/agent.md.
 */

/** Map a typed read failure to its own message key. */
const ERROR_KEYS: Record<BillReadErrorKind, TKey> = {
  offline: 'check.error.offline',
  network: 'check.error.network',
  'rate-limited': 'check.error.rateLimited',
  'bad-response': 'check.error.badResponse',
  'no-bill-found': 'check.error.noBillFound',
  'image-too-large': 'check.error.imageTooLarge',
  'not-configured': 'check.error.notConfigured',
}

export default function BillCheckPage() {
  const { t } = useI18n()

  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [read, setRead] = useState<ReadBill | null>(null)
  const [errorKey, setErrorKey] = useState<TKey | null>(null)
  const [accepted, setAccepted] = useState(false)

  const fileInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  // Read once per render pass rather than at module scope: the value is inlined at
  // build time, but reading it here keeps the component honest under test.
  const configured = isBillCheckConfigured()

  // Revoke the previous object URL whenever it is replaced or the screen unmounts,
  // so a trader who shoots twenty bills does not leak twenty blobs.
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const choose = useCallback((file: File | undefined) => {
    if (!file) return
    setPhoto(file)
    setPreview(previewUrl(file))
    // A new photo invalidates the previous read, verdict and error.
    setRead(null)
    setErrorKey(null)
    setAccepted(false)
  }, [])

  const doRead = useCallback(async () => {
    if (!photo || reading) return
    setReading(true)
    setErrorKey(null)
    try {
      const image = await prepareBillPhoto(photo)
      setRead(await readBillWithGemini(image))
      setAccepted(false)
    } catch (e) {
      // The photo is deliberately NOT cleared here — re-shooting a bill because
      // the network blipped is the fastest way to lose a trader.
      setErrorKey(isBillReadError(e) ? ERROR_KEYS[e.kind] : 'check.error.badResponse')
    } finally {
      setReading(false)
    }
  }, [photo, reading])

  /**
   * Apply a correction to the read bill. Purely local state — `verifyReadBill`
   * re-runs below on the next render and every figure updates. No network.
   * A corrected field becomes fully confident: the trader just read it himself.
   */
  const correct = useCallback((lineIndex: number, field: EditableField, value: number) => {
    setRead((prev) => {
      if (!prev) return prev
      const lines = prev.lines.map((line, i) =>
        i === lineIndex ? { ...line, [field]: { value, confidence: 1 } } : line,
      )
      return { ...prev, lines }
    })
    // A correction is new information, so an earlier "the paper is right" no
    // longer applies — show him the recomputed verdict.
    setAccepted(false)
  }, [])

  const result = useMemo(() => (read ? verifyReadBill(read) : null), [read])

  return (
    <div className="flex flex-col pb-24">
      {/* Sub-header — same shape as every other secondary screen */}
      <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-2.5">
        <Link
          href="/"
          className="flex h-11 min-w-11 items-center text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          ← {t('action.back')}
        </Link>
        <h2 className="text-lg font-bold text-stone-900">{t('check.title')}</h2>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {!configured ? (
          // Labelled, explanatory, and NOT a crash or a blank screen. A fork or a
          // clean clone with no key must still get a usable app.
          <div
            data-testid="check-unconfigured"
            className="flex flex-col gap-2 rounded-xl border border-dashed border-stone-300 bg-white p-5"
          >
            <p className="flex items-center gap-2 text-base font-semibold text-stone-800">
              <span aria-hidden>🔑</span>
              {t('check.unconfigured.title')}
            </p>
            <p className="text-sm leading-relaxed text-stone-500">
              {t('check.unconfigured.body')}
            </p>
          </div>
        ) : (
          <>
            {/* ---- Photo step ---- */}
            {!preview ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-stone-500">{t('check.photo.intro')}</p>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  data-testid="check-photo-btn"
                  className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-green-700 text-base font-semibold text-white shadow-sm active:bg-green-800"
                >
                  <span aria-hidden className="text-xl">
                    📷
                  </span>
                  {t('check.photo.take')}
                </button>
                <button
                  type="button"
                  onClick={() => galleryInput.current?.click()}
                  data-testid="check-gallery-btn"
                  className="flex h-12 items-center justify-center rounded-xl border border-stone-300 bg-white text-sm font-medium text-stone-700 active:bg-stone-50"
                >
                  {t('check.photo.pick')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt=""
                  data-testid="check-photo-preview"
                  className={`w-full rounded-xl border border-stone-200 object-contain ${
                    reading ? 'opacity-50' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={reading}
                  data-testid="check-change-photo"
                  className="h-11 self-start rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 active:bg-stone-50 disabled:opacity-50"
                >
                  {t('check.photo.change')}
                </button>

                {reading ? (
                  <div
                    data-testid="check-reading"
                    className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-white p-5"
                  >
                    <span
                      aria-hidden
                      className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-green-700"
                    />
                    <p className="text-base font-medium text-stone-700">{t('check.reading')}</p>
                    <p className="text-xs text-stone-400">{t('check.readingHint')}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={doRead}
                    disabled={!photo}
                    data-testid="check-read-btn"
                    className="h-14 rounded-xl bg-green-700 text-base font-semibold text-white shadow-sm active:bg-green-800 disabled:opacity-50"
                  >
                    {t('check.read')}
                  </button>
                )}
              </div>
            )}

            {/* ---- Error ---- */}
            {errorKey ? (
              <div
                data-testid="check-error"
                data-error-key={errorKey}
                className="flex flex-col gap-3 rounded-xl border-2 border-red-300 bg-red-50 p-4"
              >
                <p className="text-sm leading-relaxed text-red-900">{t(errorKey)}</p>
                {errorKey !== 'check.error.notConfigured' ? (
                  <button
                    type="button"
                    onClick={doRead}
                    disabled={reading || !photo}
                    data-testid="check-retry"
                    className="h-12 rounded-lg bg-red-700 px-4 text-base font-semibold text-white active:bg-red-800 disabled:opacity-50"
                  >
                    {t('check.retry')}
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* ---- Result ---- */}
            {result && read ? (
              <div data-testid="check-result" className="flex flex-col gap-4">
                <VerdictCard
                  result={result}
                  accepted={accepted}
                  onAcceptPaper={() => setAccepted(true)}
                />

                {read.farmerName.value ? (
                  <p className="text-sm text-stone-500">
                    {t('check.farmer')}:{' '}
                    <span className="font-medium text-stone-800">{read.farmerName.value}</span>
                    {read.place.value ? ` · ${read.place.value}` : ''}
                  </p>
                ) : null}

                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold text-stone-700">
                    {t('check.result.title')}
                  </h3>
                  {result.unsureCount > 0 ? (
                    <span className="text-xs text-amber-700">{t('check.unsure.hint')}</span>
                  ) : null}
                </div>

                <ReadTable lines={result.lines} onCorrect={correct} />

                {/* Bill-level totals. Every figure is labelled with WHERE it came
                    from — the paper or the arithmetic — because the whole screen
                    is a comparison and an unlabelled total would be useless. */}
                <div className="flex flex-col divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white p-4">
                  <TotalRow
                    label={t('check.total.written')}
                    value={result.sumWritten}
                    testid="check-total-written"
                  />
                  <TotalRow
                    label={t('check.total.computed')}
                    value={result.sumComputed}
                    testid="check-total-computed"
                  />
                  {/* Paldari is shown as its own line between the gross sums and
                      the payable figure — exactly where the paper puts it — so it
                      is never mistaken for part of a grain line's arithmetic. */}
                  {result.paldari !== 0 ? (
                    <>
                      <TotalRow
                        label={t('check.paldari')}
                        value={-result.paldari}
                        testid="check-total-paldari"
                      />
                      <TotalRow
                        label={t('check.total.payable')}
                        value={result.payableWritten}
                        testid="check-total-payable"
                      />
                    </>
                  ) : null}
                  <TotalRow
                    label={t('check.total.paper')}
                    value={result.paperTotal}
                    testid="check-total-paper"
                    emphasis
                  />
                </div>

                <p className="text-center text-xs text-stone-400">{t('check.nothingSaved')}</p>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Hidden pickers. `capture="environment"` makes Android open the rear camera
          directly; the gallery input omits it so the same screen offers both. */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid="check-file-input"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        hidden
        data-testid="check-gallery-input"
        onChange={(e) => choose(e.target.files?.[0])}
      />
    </div>
  )
}

function TotalRow({
  label,
  value,
  testid,
  emphasis,
}: {
  label: string
  value: number | null
  testid: string
  emphasis?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className={`text-sm ${emphasis ? 'font-medium text-stone-700' : 'text-stone-600'}`}>
        {label}
      </span>
      <span
        data-testid={testid}
        data-amount={value ?? ''}
        className={emphasis ? 'text-lg font-bold text-stone-900' : 'text-base text-stone-800'}
      >
        {value === null ? '—' : formatRupees(value)}
      </span>
    </div>
  )
}
