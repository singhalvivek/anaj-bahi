'use client'

import { useI18n } from '@/lib/i18n/context'
import { formatRupees } from '@/components/format'
import type { BillCheckResult } from '@/lib/billcheck/verify'

interface VerdictCardProps {
  result: BillCheckResult
  accepted: boolean
  onAcceptPaper: () => void
}

/**
 * The answer to "is my bill right?", shown ABOVE the table because it is what the
 * trader came for.
 *
 * Line math and addition are reported as SEPARATE sentences. They are two
 * different mistakes — a wrong line amount vs a wrongly added column — with two
 * different fixes, and collapsing them into one figure would state something
 * untrue about his bill.
 *
 * `check-accept-paper` carries the same visual weight as the verdict itself. The
 * trader is frequently right and the app wrong (paldari, a verbal discount, a
 * deliberate round-off to ₹5), and an app that argues with a deliberate number
 * gets deleted. Warn, never block.
 */
export function VerdictCard({ result, accepted, onAcceptPaper }: VerdictCardProps) {
  const { t } = useI18n()
  const { verdict, mathDiff, additionDiff } = result

  if (accepted) {
    return (
      <div
        data-testid="check-verdict"
        data-verdict="accepted"
        className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500"
      >
        {t('check.accepted')}
      </div>
    )
  }

  // Signed difference as "₹13.32 above" / "₹13.32 below" — a bare minus sign in
  // front of a rupee figure is not how a trader reads a discrepancy.
  const diffPhrase = (diff: number): string =>
    `${formatRupees(Math.abs(diff))} ${diff > 0 ? t('check.verdict.above') : t('check.verdict.below')}`

  const tone =
    verdict === 'ok'
      ? 'border-emerald-600 bg-emerald-50'
      : verdict === 'check'
        ? 'border-amber-500 bg-amber-50'
        : 'border-stone-300 bg-stone-50'

  const heading =
    verdict === 'ok'
      ? t('check.verdict.ok')
      : verdict === 'check'
        ? t('check.verdict.check')
        : t('check.verdict.incomplete')

  return (
    <div
      data-testid="check-verdict"
      data-verdict={verdict}
      className={`flex flex-col gap-3 rounded-xl border-2 p-4 shadow-sm ${tone}`}
    >
      <p className="flex items-center gap-2 text-lg font-bold text-stone-900">
        <span aria-hidden>{verdict === 'ok' ? '✓' : verdict === 'check' ? '⚠' : '…'}</span>
        {heading}
      </p>

      {verdict === 'ok' ? (
        <p className="text-sm text-stone-600">{t('check.verdict.okHint')}</p>
      ) : null}

      {verdict === 'incomplete' ? (
        <p className="text-sm text-stone-600">{t('check.verdict.incompleteHint')}</p>
      ) : null}

      {/* Only the FAILING checks render. A passing check is not restated as a
          separate line — that would bury the one thing he needs to look at. */}
      {mathDiff !== null && mathDiff !== 0 ? (
        <p data-testid="check-verdict-math" className="text-base font-medium text-stone-800">
          {t('check.verdict.math').replace('{amount}', diffPhrase(mathDiff))}
        </p>
      ) : null}

      {additionDiff !== null && additionDiff !== 0 ? (
        <p data-testid="check-verdict-addition" className="text-base font-medium text-stone-800">
          {t('check.verdict.addition').replace('{amount}', diffPhrase(additionDiff))}
        </p>
      ) : null}

      {/* `additionDiff === null` means the paper carried no grand total. Saying so
          is NOT the same as saying the addition is correct, and the two must never
          be conflated into a pass. */}
      {additionDiff === null && result.sumWritten !== null ? (
        <p data-testid="check-verdict-no-total" className="text-sm text-stone-500">
          {t('check.verdict.noTotal')}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onAcceptPaper}
        data-testid="check-accept-paper"
        className="h-12 rounded-lg border border-stone-400 bg-white px-4 text-base font-semibold text-stone-800 active:bg-stone-100"
      >
        {t('check.acceptPaper')}
      </button>
    </div>
  )
}
