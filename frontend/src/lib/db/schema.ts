// Dexie schema for Anaj Bahi — the ONLY layer that touches IndexedDB.
// Types mirror the frozen contract in architecture.md § Phase-1 module contract.

import Dexie, { type Table } from 'dexie'
import type { DeductionBasis } from '@/lib/calc'

export interface Farmer {
  id: string
  name: string
  place: string
  phone?: string
  createdAt: number
}

export interface GrainType {
  id: string
  nameEn: string
  nameHi: string
  isCustom: 0 | 1
  createdAt: number
}

export interface StoredDeduction {
  basis: DeductionBasis
  value: number
}

// Phase 5 — how a bill was captured. Absent on a stored bill ⇒ read as 'sacks'.
export type BillEntryMode = 'sacks' | 'summary'

// Phase 5 — present only on a summary (quick-entry) grain line. The per-line
// discriminant. Its `amount` is entered verbatim from the paper bill and is
// authoritative — never recomputed from weight × price.
export interface GrainLineSummary {
  totalWeightKg: number // gross, one number (not per sack); > 0
  sackCount?: number // optional integer count, no per-sack weights
  deductionKg?: number // optional single total-kg deduction
  amount: number // ₹ entered verbatim from the paper bill — AUTHORITATIVE; > 0
}

export interface StoredGrainLine {
  id: string
  grainTypeId: string
  pricePerQuintal: number
  sackWeights: number[] // 'summary' lines: [] (empty, never read)
  deductions: StoredDeduction[] // 'summary' lines: [] (empty, never read)
  summary?: GrainLineSummary // Phase 5 — present iff the bill is entryMode 'summary'
}

// Phase 8 — per-action attribution snapshot. Written at action time (never a live
// join to users/members), so it survives the actor renaming themselves or being
// removed from the business. Optional: legacy bills/payments predate it.
export interface Attribution {
  uid: string
  phone: string
  name: string
}

// Phase 2 — modelled now, populated later.
export interface Payment {
  id: string
  amount: number
  date: string
  note?: string
  createdAt: number
  createdBy?: Attribution // Phase 8 — who recorded this payment (snapshot)
}

export interface Bill {
  id: string // "DDMMYY/xxxxx"
  farmerId: string
  farmerName: string // denormalised (search)
  farmerPlace: string // denormalised (search)
  purchaseDate: string // ISO "yyyy-mm-dd"
  grainTypeIds: string[] // denormalised, multiEntry index (search)
  lines: StoredGrainLine[]
  dueDate?: string // Phase 2
  payments: Payment[] // Phase 2 (empty [] in Phase 1)
  entryMode?: BillEntryMode // Phase 5 — absent ⇒ 'sacks' (back-compat)
  paldari?: number // Phase 10 — bill-level labor (loading/unloading) charge in ₹, borne by the farmer; subtracted from the bill total. Absent ⇒ 0.
  createdBy?: Attribution // Phase 8 — who created this bill (snapshot); absent on legacy bills
  createdAt: number
  updatedAt: number
}

// Phase 9 — append-only owner-only activity log. One entry per ledger mutation
// (bill-create / payment / bill-edit), each stamped with an actor snapshot (uid +
// phone + name) taken at action time so the trail stays truthful after renames or
// removals. Written best-effort by the repo; read (OWNERS only) is enforced by Rules.
// No `bill-delete` type: the repo has no delete-bill mutation.
export type ActivityType = 'bill-create' | 'payment' | 'bill-edit'

export interface ActivityEntry {
  id: string
  type: ActivityType
  billId?: string
  actorUid: string
  actorPhone: string
  actorName: string // snapshot at action time (never a live join)
  at: number
  summary: string
}

export interface MetaRow {
  key: string
  value: unknown
}

export class AnajBahiDB extends Dexie {
  farmers!: Table<Farmer, string>
  grainTypes!: Table<GrainType, string>
  bills!: Table<Bill, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('anajbahi')
    // Search indexes (farmerName/farmerPlace prefix, purchaseDate range, *grainTypeIds
    // multiEntry) are created now so Phase-2 search needs no migration.
    this.version(1).stores({
      farmers: '&id, name, place, phone, createdAt',
      grainTypes: '&id, isCustom, createdAt',
      bills: '&id, farmerId, purchaseDate, farmerName, farmerPlace, *grainTypeIds, createdAt',
      meta: '&key',
    })
  }
}

// Single shared instance for the whole app.
export const db = new AnajBahiDB()
