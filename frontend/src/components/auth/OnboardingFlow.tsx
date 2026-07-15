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
 * Steps (role-free onboarding — no owner/partner/employee wording):
 *   1. RoleChooser    — New business / Business already registered → lifts a RoleRoute.
 *   2a. CreateBusiness — route `{ kind:'create' }` (New business): name + shop + mobile;
 *                        the creator becomes owner.
 *   2b. JoinByCode     — route `{ kind:'join' }` (Business already registered): code →
 *                        mobile → name; the joiner's role comes from the invite.
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
