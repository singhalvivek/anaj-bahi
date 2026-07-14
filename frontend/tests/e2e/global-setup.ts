import { clearFirestore, clearAuth, PROJECT_ID } from './support/emulator'

/**
 * Playwright global setup — runs ONCE before the specs boot the dev server.
 *
 * The whole suite runs under the Firebase Auth (9099) + Firestore (8080) EMULATORS
 * (started by `firebase emulators:exec` — see package.json `test:e2e`). This reset
 * wipes both emulators via their documented REST clear endpoints — the emulator
 * equivalent of the old cloud/SQLite wipe — so every run starts from a clean slate:
 *
 *   • Firestore: DELETE /emulator/v1/projects/<projectId>/databases/(default)/documents
 *   • Auth:      DELETE /emulator/v1/projects/<projectId>/accounts
 *
 * No Admin SDK and no service-account key are needed (the old FIREBASE_SERVICE_ACCOUNT
 * / firebase-admin paths are gone). The dedicated `auth-onboarding.spec.ts` sorts
 * first (workers:1, fullyParallel:false) so it sees the clean state and drives the
 * full Google-sign-in → owner-creates-business path; later specs reuse the persisted
 * emulator state (the owner's users/{uid}.bizId → straight to ready).
 *
 * Specs seed their own users (owner/employee) — nothing is seeded globally here.
 */
async function globalSetup(): Promise<void> {
  try {
    await clearFirestore()
    await clearAuth()
    console.log(`[e2e global-setup] emulators reset (project ${PROJECT_ID}) — clean run`)
  } catch (err) {
    // If the emulators are not reachable, fail loudly: the whole suite depends on
    // them, so a silent continue would only produce confusing downstream failures.
    throw new Error(
      `[e2e global-setup] could not reset the Firebase emulators — are Auth (9099) + ` +
        `Firestore (8080) running (via \`firebase emulators:exec\`)?\n${String(err)}`,
    )
  }
}

export default globalSetup
