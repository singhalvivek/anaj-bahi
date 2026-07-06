// Postbuild base-path rewrite for the GitHub Pages production export.
//
// Next.js inlines NEXT_PUBLIC_BASE_PATH into the client bundle at build time, so
// the compiled SwRegister/layout already point at the deployed sub-path. The two
// hand-written static assets in public/ (manifest.webmanifest, sw.js) are copied
// verbatim, however, and still carry their SOURCE `/app` literals. This script
// rewrites those literals in the EXPORTED copies (frontend/out/*) only — it never
// touches the sources, so local dev, the default `pnpm build`, and the E2E suite
// stay on `/app`.
//
// No-op when NEXT_PUBLIC_BASE_PATH is unset or equal to `/app`. Idempotent (a
// second run against an already-rewritten file changes nothing) and guards
// missing files. No new dependencies — Node's built-in fs only.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DEFAULT_BASE = '/app'
const base = process.env.NEXT_PUBLIC_BASE_PATH

if (!base || base === DEFAULT_BASE) {
  console.log(
    `[apply-base-path] no rewrite needed (NEXT_PUBLIC_BASE_PATH=${base ?? '<unset>'}); default ${DEFAULT_BASE} preserved`,
  )
  process.exit(0)
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const outDir = join(scriptDir, '..', 'out')

// Files copied verbatim from public/ that still contain the source `/app` literal.
const targets = ['manifest.webmanifest', 'sw.js']

let rewritten = 0
for (const name of targets) {
  const filePath = join(outDir, name)
  if (!existsSync(filePath)) {
    console.warn(`[apply-base-path] skip (missing): ${filePath}`)
    continue
  }
  const original = readFileSync(filePath, 'utf8')
  // Replace every `/app` occurrence (start_url, scope, icon srcs, const BASE,
  // cache/shell paths). Whole-word-ish: match `/app` not followed by another
  // path-segment word char, so `/apple` etc. would be untouched (none exist here,
  // but this keeps the rewrite conservative and idempotent).
  const updated = original.replace(/\/app(?![\w-])/g, base)
  if (updated !== original) {
    writeFileSync(filePath, updated, 'utf8')
    rewritten += 1
    console.log(`[apply-base-path] rewrote /app -> ${base} in out/${name}`)
  } else {
    console.log(`[apply-base-path] no /app literals found in out/${name} (already ${base}?)`)
  }
}

console.log(`[apply-base-path] done — ${rewritten} file(s) rewritten to base ${base}`)
