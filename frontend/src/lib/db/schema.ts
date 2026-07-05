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

export interface StoredGrainLine {
  id: string
  grainTypeId: string
  pricePerQuintal: number
  sackWeights: number[]
  deductions: StoredDeduction[]
}

// Phase 2 — modelled now, populated later.
export interface Payment {
  id: string
  amount: number
  date: string
  note?: string
  createdAt: number
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
  createdAt: number
  updatedAt: number
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
