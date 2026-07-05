'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { translate, type Lang } from './dictionary'

export type { Lang } from './dictionary'

const STORAGE_KEY = 'anajbahi.lang'
const DEFAULT_LANG: Lang = 'hi'

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

function readStoredLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'en' || stored === 'hi' ? stored : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start from the default so server and first client render agree (avoids hydration
  // mismatch); the stored preference is applied in an effect right after mount.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG)

  useEffect(() => {
    const stored = readStoredLang()
    if (stored !== lang) setLangState(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      window.localStorage.setItem(STORAGE_KEY, l)
    } catch {
      // localStorage unavailable — keep in-memory language only.
    }
  }, [])

  const t = useCallback((key: string) => translate(lang, key), [lang])

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return ctx
}
