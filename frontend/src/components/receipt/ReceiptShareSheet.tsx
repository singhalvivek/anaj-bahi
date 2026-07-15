'use client'

import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useI18n } from '@/lib/i18n/context'
import type { Bill } from '@/lib/db/repo'
import Receipt from '@/components/receipt/Receipt'
import { shareReceiptImage, type ShareResult } from '@/lib/share/shareImage'
import { getProfile } from '@/lib/settings/profile'

/**
 * Controlled receipt preview + share bottom-sheet — the DRY extraction of the
 * detail-page SharePanel's preview body. Both the detail page (`bill/page.tsx`)
 * and the post-save prompt (`PostSaveSharePrompt`) consume it so the share flow
 * exists in exactly ONE place.
 *
 * Positioned BELOW the sticky top bar so the language toggle stays reachable —
 * the language of the rasterised image follows the live toggle. Renders <Receipt>
 * to a ref and shares it as a PNG via shareReceiptImage:
 *   - phone with native file share  → native share sheet ('shared')
 *   - otherwise (desktop/headless)  → PNG download + a clear fallback note
 * Never a dead button.
 *
 * Testids preserved byte-for-byte from the original SharePanel so the frozen
 * detail-page E2E (`receipt-share.spec.ts`) stays green unchanged:
 *   receipt-preview / receipt / share-image / share-close / share-fallback / share-error
 */
export default function ReceiptShareSheet({
  bill,
  farmerPhone,
  grainName,
  open,
  onClose,
}: {
  bill: Bill
  farmerPhone?: string
  grainName: (id: string) => string
  open: boolean
  onClose: () => void
}) {
  const { t } = useI18n()
  const receiptRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<ShareResult | null>(null)
  const [error, setError] = useState(false)

  // Business profile drives the receipt header; useLiveQuery keeps it in sync if
  // the trader edits Settings. Undefined while loading; never a blank shopName.
  const profile = useLiveQuery(() => getProfile(), [])

  // Clear any prior share result/error whenever the sheet toggles — mirrors the
  // original openPreview/closePreview reset so a re-open always starts clean.
  useEffect(() => {
    setResult(null)
    setError(false)
  }, [open])

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

  if (!open) return null

  return (
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
        onClick={onClose}
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
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-medium text-stone-500 active:bg-stone-100"
          >
            ✕ {t('share.close')}
          </button>
        </div>

        {/* Scrollable receipt preview — scrolls in BOTH axes so a wide
            many-column ledger receipt never clips; html-to-image still
            captures the Receipt root at its full scroll width. */}
        <div className="min-h-0 flex-1 overflow-auto bg-stone-100 p-4">
          <div className="w-fit rounded-lg shadow-sm">
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
  )
}
