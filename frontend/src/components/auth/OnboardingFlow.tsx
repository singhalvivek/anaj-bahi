'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import type { MembershipDecision } from '@/lib/auth/membership'
import { NamePrompt } from './NamePrompt'
import { RoleChooser } from './RoleChooser'
import { CreateBusiness } from './CreateBusiness'
import { AskOwner } from './AskOwner'

/**
 * Orchestrates first-run onboarding by LOCAL component state (no routes) while
 * the AuthGate holds `status === 'onboarding'`. Full-screen, no app chrome.
 *
 * Steps:
 *   1. NamePrompt      — until `user.displayName` is set.
 *   2. RoleChooser     — Owner / Employee → lifts a MembershipDecision here.
 *   3a. CreateBusiness — decision `new` (Owner, no prior membership).
 *   3b. AskOwner       — decision `employee-unadded` (Employee, not on a roster).
 *
 * For decisions `owner` / `employee-joined`, `chooseRole` inside the AuthProvider
 * has ALREADY claimed membership (as needed) and flipped `status` → `ready`, so
 * this component simply unmounts (the AuthGate switches surfaces) — no extra call
 * is needed here.
 */
export function OnboardingFlow() {
  const { user } = useAuth()
  const [decision, setDecision] = useState<MembershipDecision | null>(null)

  function renderStep() {
    // Step 1 — name must be set before anything else.
    if (!user?.displayName) {
      return <NamePrompt />
    }

    // Step 3 — branch on the stored role decision.
    if (decision?.kind === 'new') {
      return <CreateBusiness />
    }
    if (decision?.kind === 'employee-unadded') {
      return <AskOwner />
    }

    // Step 2 — role chooser (default). `owner` / `employee-joined` already
    // transitioned to `ready` in the provider, so we only store the two
    // decisions that need a further sub-screen.
    return (
      <RoleChooser
        onDecision={(d) => {
          if (d.kind === 'new' || d.kind === 'employee-unadded') {
            setDecision(d)
          }
        }}
      />
    )
  }

  return <div data-testid="onboarding-flow">{renderStep()}</div>
}
