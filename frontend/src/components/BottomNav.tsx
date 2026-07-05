'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'

interface Tab {
  href: string
  key: string
  icon: string
  match: (path: string) => boolean
}

const TABS: Tab[] = [
  { href: '/', key: 'nav.bills', icon: '📒', match: (p) => p === '/' || p.startsWith('/bill') },
  { href: '/due', key: 'nav.due', icon: '⏳', match: (p) => p.startsWith('/due') },
  { href: '/settings', key: 'nav.settings', icon: '⚙️', match: (p) => p.startsWith('/settings') },
]

/**
 * Thumb-reachable bottom navigation. Bills is the active/real tab; Due and
 * Settings route to labelled "coming soon" screens in Phase 1.
 */
export function BottomNav() {
  const { t } = useI18n()
  const pathname = usePathname() ?? '/'
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-md items-stretch border-t border-stone-200 bg-white">
      {TABS.map((tab) => {
        const active = tab.match(pathname)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-testid={`nav-${tab.key.split('.')[1]}`}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium ${
              active ? 'text-green-700' : 'text-stone-400'
            }`}
          >
            <span aria-hidden className="text-lg leading-none">
              {tab.icon}
            </span>
            <span>{t(tab.key)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
