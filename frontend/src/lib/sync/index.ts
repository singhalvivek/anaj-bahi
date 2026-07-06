// Public sync API barrel — slice-c (Settings UI) imports from `@/lib/sync`.

export { getSyncConfig, saveSyncConfig, type SyncConfig } from './config'
export {
  syncNow,
  restoreFromCloud,
  getSyncState,
  startAutoSync,
  type SyncResult,
  type SyncState,
  type SyncErrorKind,
} from './engine'
export {
  SyncAuthError,
  SyncNetworkError,
  SyncServerError,
  type SyncSnapshot,
  type PushCounts,
} from './client'
export { collectSnapshot, applySnapshot } from './snapshot'
