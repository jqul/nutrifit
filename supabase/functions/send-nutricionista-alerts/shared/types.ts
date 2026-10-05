// GENERADO por scripts/sync-edge-shared.mjs a partir de src/types/index.ts (subconjunto) — NO EDITAR A MANO.
export type FollowedPlan = 'si' | 'parcial' | 'no'

export interface DailyCheckin {
  id: string
  clientId: string
  date: string
  followedPlan: FollowedPlan
  hunger: number
  energy: number
  mood: number
  waterL: number | null
  notes: string
  bristolScale?: number | null
  bloating?: number | null
  abdominalPain?: number | null
}

export interface WeightEntry {
  id: string
  clientId: string
  date: string
  weightKg: number
  note: string
}
