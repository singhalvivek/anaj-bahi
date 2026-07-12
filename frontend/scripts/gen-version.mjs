// Prebuild (deploy path only). Compute a per-deploy build id and expose it to the app
// as NEXT_PUBLIC_APP_VERSION via `.env.production.local`, which `next build` inlines
// into the client bundle. The matching sw.js CACHE_VERSION stamp is applied postbuild
// by stamp-sw.mjs using the SAME id (git short hash is deterministic per commit).
//
// Runs ONLY in `build:pages` (the GitHub Pages deploy). The plain `pnpm build` used by
// the E2E gate is untouched, so tests are unaffected. Never touches data.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

function buildId() {
  if (process.env.NEXT_PUBLIC_BUILD_ID) return process.env.NEXT_PUBLIC_BUILD_ID
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'b' + Date.now().toString(36)
  }
}

const id = buildId()
const date = new Date().toISOString().slice(0, 10)
const version = `${id} · ${date}`

const scriptDir = dirname(fileURLToPath(import.meta.url))
const envPath = join(scriptDir, '..', '.env.production.local')

// Merge: preserve any existing keys, set/replace only the two version keys.
const set = { NEXT_PUBLIC_APP_VERSION: version, NEXT_PUBLIC_BUILD_ID: id }
let lines = []
if (existsSync(envPath)) {
  lines = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !(l.split('=')[0]?.trim() in set))
}
for (const [k, v] of Object.entries(set)) lines.push(`${k}=${v}`)
writeFileSync(envPath, lines.join('\n') + '\n', 'utf8')
console.log(`[gen-version] APP_VERSION="${version}" -> .env.production.local`)
