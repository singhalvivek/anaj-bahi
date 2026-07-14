'use client'

import { useState } from 'react'
import type { RoleRoute } from '@/lib/auth/membership'
import { RoleChooser } from './RoleChooser'
import { CreateBusiness } from './CreateBusiness'
import { JoinByCode } from './JoinByCode'

/**
 * Orchestrates first-run onboarding by LOCAL component state (no routes) while
 * the AuthGate holds `status === 'onboarding'`. Full-screen, no app chrome.
 *
 * Google already supplies the user's name, so there is no standalone name prompt
 * up front — the name is captured inline (prefilled, editable) in whichever form
 * the role choice routes to.
 *
 * Steps:
 *   1. RoleChooser    — Owner / Employee → lifts a pure RoleRoute here.
 *   2a. CreateBusiness — route `{ kind:'create' }` (Owner): name + shop + mobile.
 *   2b. JoinByCode     — route `{ kind:'join' }`  (Employee): code → mobile → name.
 *
 * On the create/join success the AuthProvider flips `status` → `ready`, so this
 * component simply unmounts (the AuthGate switches surfaces).
 */
export function OnboardingFlow() {
  const [route, setRoute] = useState<RoleRoute | null>(null)

  function renderStep() {
    if (route?.kind === 'create') {
      return <CreateBusiness />
    }
    if (route?.kind === 'join') {
      return <JoinByCode />
    }
    return <RoleChooser onDecision={setRoute} />
  }

  return <div data-testid="onboarding-flow">{renderStep()}</div>
}
