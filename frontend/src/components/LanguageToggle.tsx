'use client'

import { useI18n } from '@/lib/i18n/context'

/**
 * Two-state language pill: हिं | EN. Active side highlighted; each side is a
 * ≥48px tap target. Flips the i18n context language (persisted by the provider).
 */
export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <div
      role="group"
      aria-label={t('lang.toggle')}
      data-testid="language-toggle"
      className="flex h-12 items-center overflow-hidden rounded-full border border-white/50 bg-white/10 text-sm font-semibold"
    >
      <button
        type="button"
        data-testid="lang-toggle-hi"
        aria-pressed={lang === 'hi'}
        onClick={() => setLang('hi')}
        className={`h-full min-w-[48px] px-3 transition-colors ${
          lang === 'hi' ? 'bg-white text-green-800' : 'text-white'
        }`}
      >
        {t('lang.hi')}
      </button>
      <button
        type="button"
        data-testid="lang-toggle-en"
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
        className={`h-full min-w-[48px] px-3 transition-colors ${
          lang === 'en' ? 'bg-white text-green-800' : 'text-white'
        }`}
      >
        {t('lang.en')}
      </button>
    </div>
  )
}
