'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { Bill } from '@/lib/db/repo'
import ReceiptShareSheet from '@/components/receipt/ReceiptShareSheet'

/**
 * Post-save share prompt (Phase 11) — shown once, immediately after a NEW bill is
 * created in either create flow (fresh sack or quick/summary), instead of jumping
 * straight to the home list. A bottom-sheet with the same visual language as the
 * detail-page SharePanel sheet, offering:
 *   - Share receipt → opens the reused ReceiptShareSheet (receipt preview + PNG share)
 *   - Done         → navigates home (onDone), the same destination as before Phase 11
 *
 * Frontend-only, offline: the reused ReceiptShareSheet owns the profile load, the
 * <Receipt> preview and the rasterise/share pipeline — no new share mechanism here.
 */
export default function PostSaveSharePrompt({
  bill,
  farmerPhone,
  grainName,
  onDone,
}: {
  bill: Bill
  farmerPhone?: string
  grainName: (id: string) => string
  onDone: () => void
}) {
  const { t } = useI18n()
  const [shareOpen, setShareOpen] = useState(false)

  return (
    <>
      {/* The prompt sheet — pinned below the sticky top bar (top-[72px]) so the
          language toggle stays reachable, mirroring the detail-page share sheet. */}
      <div
        data-testid="post-save-share-sheet"
        className="fixed inset-x-0 bottom-0 top-[72px] z-30 mx-auto flex w-full max-w-md flex-col justify-end bg-stone-900/50"
        role="dialog"
        aria-modal="true"
        aria-label={t('postsave.title')}
      >
        <div className="flex flex-col gap-3 rounded-t-2xl bg-white px-4 pb-6 pt-5 shadow-xl">
          <h3 className="text-center text-lg font-bold text-stone-900">
            {t('postsave.title')}
          </h3>

          <button
            type="button"
            data-testid="post-save-share-btn"
            onClick={() => setShareOpen(true)}
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-green-700 text-lg font-semibold text-white shadow active:bg-green-800"
          >
            <span aria-hidden>📤</span>
            {t('postsave.share')}
          </button>

          <button
            type="button"
            data-testid="post-save-done-btn"
            onClick={onDone}
            className="flex h-14 items-center justify-center rounded-xl border border-stone-300 text-lg font-semibold text-stone-700 active:bg-stone-100"
          >
            {t('postsave.done')}
          </button>
        </div>
      </div>

      {/* Reused receipt preview + share sheet (opens ON TOP of this prompt). */}
      <ReceiptShareSheet
        bill={bill}
        farmerPhone={farmerPhone}
        grainName={grainName}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </>
  )
}
