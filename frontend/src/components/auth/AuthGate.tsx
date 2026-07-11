'use client'

import { useAuth } from '@/lib/auth/context'
import { useI18n } from '@/lib/i18n/context'
import { TopBar } from '@/components/TopBar'
import { BottomNav } from '@/components/BottomNav'
import { GatedHomeHeader } from '@/components/GatedHomeHeader'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { OnboardingFlow } from '@/components/auth/OnboardingFlow'

/**
 * The single access gate that wraps the whole app. It switches surfaces purely
 * by conditional rendering on `useAuth().status` — **no new App-Router routes**,
 * so the static export is unaffected and the session survives reloads:
 *
 *   loading    → a minimal branded splash (no chrome).
 *   signed-out → the full-screen <LoginScreen/> (no TopBar/BottomNav).
 *   onboarding → the full-screen <OnboardingFlow/> (no TopBar/BottomNav).
 *   ready      → the full app shell: TopBar + gated-home header + the app
 *                (`children`) + BottomNav. AuthGate now owns the app chrome that
 *                the root layout used to render, so TopBar/BottomNav never show
 *                on the login/onboarding screens.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const { t } = useI18n()

  if (status === 'loading') {
    return (
      <div
        data-testid="auth-splash"
        className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <span aria-hidden className="text-5xl">
          📒
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-green-700">{t('app.title')}</h1>
      </div>
    )
  }

  if (status === 'signed-out') {
    return <LoginScreen />
  }

  if (status === 'onboarding') {
    return <OnboardingFlow />
  }

  // status === 'ready' — the full app shell.
  return (
    <>
      <TopBar />
      <GatedHomeHeader />
      <main className="flex flex-1 flex-col pb-24">{children}</main>
      <BottomNav />
    </>
  )
}
