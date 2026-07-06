import { rm } from 'node:fs/promises'
import path from 'node:path'

/**
 * Playwright global setup — runs ONCE before all specs boot the web servers.
 *
 * Deletes the backend E2E SQLite file (and its -shm / -wal siblings) so the cloud
 * store starts EMPTY every run. This makes the sync-journey restore assertions
 * deterministic: what restore pulls back is exactly what THIS run pushed, never
 * leftovers from a previous run.
 *
 * The path mirrors the DATABASE_URL passed to the backend webServer in
 * playwright.config.ts (`sqlite:///./data/e2e.db`, cwd `backend/`), resolved here
 * relative to this frontend package's parent.
 */
async function globalSetup(): Promise<void> {
  const backendDataDir = path.resolve(__dirname, '../../../backend/data')
  const files = ['e2e.db', 'e2e.db-shm', 'e2e.db-wal']
  await Promise.all(
    files.map((f) =>
      // Guard against the file not existing (first run / already clean).
      rm(path.join(backendDataDir, f), { force: true }).catch(() => {}),
    ),
  )
}

export default globalSetup
