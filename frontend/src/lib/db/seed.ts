// Seed grain-type list (idempotent, on first run). Slugs are stable ids for seeds.
import type { GrainType } from './schema'

export interface GrainSeed {
  id: string
  nameEn: string
  nameHi: string
}

// Order = display order in the grain-type selector.
export const GRAIN_SEEDS: GrainSeed[] = [
  { id: 'wheat', nameEn: 'Wheat', nameHi: 'गेहूँ' },
  { id: 'paddy', nameEn: 'Paddy / Rice', nameHi: 'धान' },
  { id: 'mustard', nameEn: 'Mustard', nameHi: 'सरसों' },
  { id: 'gram', nameEn: 'Gram / Chana', nameHi: 'चना' },
  { id: 'soybean', nameEn: 'Soybean', nameHi: 'सोयाबीन' },
  { id: 'maize', nameEn: 'Maize', nameHi: 'मक्का' },
  { id: 'bajra', nameEn: 'Bajra / Pearl millet', nameHi: 'बाजरा' },
]

/** Build the seed GrainType rows (isCustom 0), stamped with `now`. */
export function buildSeedGrainTypes(now: number): GrainType[] {
  return GRAIN_SEEDS.map((s) => ({
    id: s.id,
    nameEn: s.nameEn,
    nameHi: s.nameHi,
    isCustom: 0 as const,
    createdAt: now,
  }))
}
