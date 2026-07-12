// Postbuild (deploy path only). Stamp the EXPORTED out/sw.js CACHE_VERSION with the
// per-deploy build id (same git short hash as gen-version.mjs), so every deploy is a
// byte-different service worker → the browser detects it, re-installs, and its activate
// step clears the previous shell cache. Falls back to the source `v2` if no git.
//
// DATA SAFETY: only rewrites a string in the app-shell worker file. The worker touches
// only the Cache API (HTML/JS/CSS); IndexedDB (bills + unsynced writes) is never touched.

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

const scriptDir = dirname(fileURLToPath(import.meta.url))
const swPath = join(scriptDir, '..', 'out', 'sw.js')

if (!existsSync(swPath)) {
  console.warn('[stamp-sw] out/sw.js missing — skip')
  process.exit(0)
}

const id = buildId()
const src = readFileSync(swPath, 'utf8')
const updated = src.replace(
  /const CACHE_VERSION = `\$\{CACHE_PREFIX\}[^`]*`/,
  'const CACHE_VERSION = `${CACHE_PREFIX}' + id + '`',
)

if (updated !== src) {
  writeFileSync(swPath, updated, 'utf8')
  console.log(`[stamp-sw] out/sw.js CACHE_VERSION -> anajbahi-shell-${id}`)
} else {
  console.warn('[stamp-sw] CACHE_VERSION pattern not found — out/sw.js left unchanged')
}
