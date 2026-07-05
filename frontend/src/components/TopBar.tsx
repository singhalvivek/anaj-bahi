'use client'

import { useI18n } from '@/lib/i18n/context'
import { LanguageToggle } from './LanguageToggle'

/** App top bar: title on the left, language toggle on the right. */
export function TopBar() {
  const { t } = useI18n()
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-green-700 px-4 py-2.5 text-white shadow-sm">
      <h1 className="text-xl font-bold tracking-tight">{t('app.title')}</h1>
      <LanguageToggle />
    </header>
  )
}
