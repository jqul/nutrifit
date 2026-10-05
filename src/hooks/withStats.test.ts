import { describe, it, expect } from 'vitest'
import { ClientData, DailyCheckin, WeightEntry } from '../types'
import { ActivitySummary } from '../lib/activitySummary'
import { withStats } from './useNutricionistaClients'

const today = new Date()
const iso = (daysAgo: number) => {
  const d = new Date(today); d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const client = (over: Partial<ClientData> = {}): ClientData => ({
  id: 'c1', nutricionistaId: 'n', token: 't', name: 'Ana', surname: 'X', phone: '', email: '', birthDate: null, gender: null, heightCm: null,
  goal: 'perder_peso', allergies: '', notes: '', reportNotes: '', consentAcceptedAt: null, consentSignedName: null, monthlyPrice: null,
  goalWeightKg: 75, customMessages: {}, tags: [], createdAt: Date.now() - 400 * 86400000, lastReviewedAt: null, ...over,
} as ClientData)
const ck = (daysAgo: number): DailyCheckin => ({ id: `c${daysAgo}`, clientId: 'c1', date: iso(daysAgo), followedPlan: 'si', hunger: 3, energy: 3, mood: 3, waterL: null, notes: '' })
const w = (daysAgo: number, weightKg: number): WeightEntry => ({ id: `w${daysAgo}`, clientId: 'c1', date: iso(daysAgo), weightKg, note: '' })
const activity = (over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  client_id: 'c1', last_checkin: null, last_weigh_in: null, first_weigh_in: null, first_weight_kg: null, last_weight_kg: null, ...over,
})
const stats = (c: ClientData, checkins: DailyCheckin[], weights: WeightEntry[], act?: ActivitySummary) =>
  withStats([c], { [c.id]: checkins }, {}, {}, {}, { [c.id]: weights }, act ? { [c.id]: act } : {})[0]

describe('withStats con una ventana de historial', () => {
  it('uses the activity summary for the last check-in when the window has none', () => {
    const s = stats(client(), [], [], activity({ last_checkin: iso(200) }))
    expect(s.lastCheckin).toBe(iso(200))
    expect(s.healthLabel).toBe('Sin check-in hace 200d')   // y no «Sin check-ins todavía»
  })

  it('takes the more recent of the window and the summary', () => {
    expect(stats(client(), [ck(2)], [], activity({ last_checkin: iso(2) })).lastCheckin).toBe(iso(2))
    expect(stats(client(), [ck(2)], [], activity({ last_checkin: iso(300) })).lastCheckin).toBe(iso(2))
  })

  it('knows the starting weight even when the first weigh-in is outside the window', () => {
    const s = stats(client(), [ck(1)], [w(10, 82), w(2, 81)], activity({ first_weigh_in: iso(300), first_weight_kg: '95.0', last_weigh_in: iso(2), last_weight_kg: 81 }))
    expect(s.weightStartKg).toBe(95)
    expect(s.weightKg).toBe(81)
  })

  it('detects a reached goal using the first weight from the summary', () => {
    // 95 → 74,6 con meta de 75: alcanzado; sin el primer peso del resumen la ventana (82 → 74,6) no daría un recorrido de ≥ 1 kg claro
    const s = stats(client({ goalWeightKg: 75 }), [ck(1)], [w(10, 76), w(2, 74.6)], activity({ first_weigh_in: iso(300), first_weight_kg: 95, last_weigh_in: iso(2), last_weight_kg: 74.6 }))
    expect(s.alerts?.some(a => a.kind === 'goal_reached')).toBe(true)
  })

  it('flags "sin registrar peso" for a client whose only weigh-ins are older than the window', () => {
    const s = stats(client(), [ck(1)], [], activity({ first_weigh_in: iso(200), first_weight_kg: 90, last_weigh_in: iso(150), last_weight_kg: 88 }))
    const alert = s.alerts?.find(a => a.kind === 'no_weigh_in')
    expect(alert?.label).toBe('Sin registrar peso hace 150d')
    expect(s.weightKg).toBe(88)
    expect(s.lastActivity).toBe(iso(1))
  })

  it('still works without any summary (demo data and tests)', () => {
    const s = stats(client(), [ck(1), ck(0)], [w(5, 80), w(1, 79)])
    expect(s.lastCheckin).toBe(iso(0))
    expect(s.weightKg).toBe(79)
    expect(s.weightStartKg).toBe(80)
  })
})
