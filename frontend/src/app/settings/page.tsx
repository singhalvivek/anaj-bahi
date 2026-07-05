'use client'

import { useI18n } from '@/lib/i18n/context'
import { ComingSoon } from '@/components/ComingSoon'

export default function SettingsPage() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="text-5xl" aria-hidden>
        ⚙️
      </span>
      <h2 className="text-xl font-semibold text-stone-700">{t('nav.settings')}</h2>
      <div className="flex w-full flex-col gap-3">
        <ComingSoon feature={t('stub.sync')} testid="stub-sync" />
        <ComingSoon feature={t('stub.share')} testid="stub-share-settings" />
      </div>
    </div>
  )
}
