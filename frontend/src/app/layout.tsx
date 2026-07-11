import type { Metadata, Viewport } from 'next'
import './globals.css'
import { I18nProvider } from '@/lib/i18n/context'
import { TopBar } from '@/components/TopBar'
import { BottomNav } from '@/components/BottomNav'
import { SwRegister } from '@/components/SwRegister'

// Base path for the static export; defaults to `/app` (local dev + E2E). The
// Pages production build sets NEXT_PUBLIC_BASE_PATH (e.g. `/anaj-bahi`) so the
// manifest link resolves under the deployed sub-path.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '/app'

export const metadata: Metadata = {
  title: 'Anaj Bahi / अनाज बही',
  description:
    'Offline bill-book for grain traders — record grain purchases sack-by-sack and reopen bills. Works fully offline on your phone.',
  // Static export under basePath: the manifest in public/ is served at ${BASE}/…
  manifest: `${BASE}/manifest.webmanifest`,
  applicationName: 'Anaj Bahi',
  appleWebApp: { capable: true, title: 'Anaj Bahi', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: '#15803d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi">
      <body className="min-h-screen bg-stone-100 text-stone-900 antialiased">
        <I18nProvider>
          <SwRegister />
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-stone-50 shadow-sm">
            <TopBar />
            <main className="flex flex-1 flex-col pb-24">{children}</main>
            <BottomNav />
          </div>
        </I18nProvider>
      </body>
    </html>
  )
}
