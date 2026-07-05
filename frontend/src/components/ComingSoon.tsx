'use client'

import { useI18n } from '@/lib/i18n/context'

/**
 * Shared "coming soon" stub. Every deferred Phase-1 feature (Search, Payments,
 * Due, Share, Sync, Settings) renders through this so a stub always reads as
 * intentional — dashed border, reduced opacity, non-interactive.
 */
export function ComingSoon({
  feature,
  testid,
  className = '',
}: {
  feature: string
  testid: string
  className?: string
}) {
  const { t } = useI18n()
  return (
    <div
      data-testid={testid}
      aria-disabled="true"
      className={`pointer-events-none select-none rounded-xl border-2 border-dashed border-stone-300 bg-stone-100/60 px-4 py-3 opacity-60 ${className}`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-stone-500">
        <span aria-hidden>🔒</span>
        <span>
          {t('stub.comingSoon')} — {feature}
        </span>
      </div>
    </div>
  )
}
