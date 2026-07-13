import { defineConfig } from 'vitest/config'

// Dedicated config for the Firestore Security-Rules unit tests. These run ONLY
// against the Firestore emulator (via `pnpm run test:rules`, which wraps them in
// `firebase emulators:exec`) — NOT part of the default `vitest run` unit path
// (whose include is `src/**` only). Node environment (no jsdom / fake-indexeddb).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
