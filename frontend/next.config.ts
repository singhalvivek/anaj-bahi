import type { NextConfig } from 'next'

// Base path for the static export. Defaults to `/app` so local dev, the default
// `pnpm build`, and the Playwright E2E suite (baseURL .../app/) are unchanged.
// The GitHub Pages production build overrides this via NEXT_PUBLIC_BASE_PATH
// (e.g. `/anaj-bahi`) so assets resolve under the project-pages sub-path.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '/app'

const config: NextConfig = {
  output: 'export',
  basePath: BASE,
  trailingSlash: true,
}

export default config
