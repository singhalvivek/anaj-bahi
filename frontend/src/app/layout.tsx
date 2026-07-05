import type { Metadata, Viewport } from 'next'
import './globals.css'
import { I18nProvider } from '@/lib/i18n/context'
import { TopBar } from '@/components/TopBar'
import { BottomNav } from '@/components/BottomNav'
import { SwRegister } from '@/components/SwRegister'
import { PinGate } from '@/components/PinGate'

export const metadata: Metadata = {
  title: 'Anaj Bahi / अनाज बही',
  description:
    'Offline bill-book for grain traders — record grain purchases sack-by-sack and reopen bills. Works fully offline on your phone.',
  // Static export under basePath /app: the manifest in public/ is served at /app/…
  manifest: '/app/manifest.webmanifest',
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
            <main className="flex flex-1 flex-col pb-24">
              <PinGate>{children}</PinGate>
            </main>
            <BottomNav />
          </div>
        </I18nProvider>
      </body>
    </html>
  )
}
