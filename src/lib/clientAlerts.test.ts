import { describe, it, expect } from 'vitest'
import { DailyCheckin, WeightEntry } from '../types'
import { computeClientAlerts, AlertInput } from './clientAlerts'

const today = new Date('2026-10-05T12:00:00')
const iso = (daysAgo: number) => {
  const d = new Date(today); d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const w = (daysAgo: number, weightKg: number): WeightEntry => ({ id: `w${daysAgo}`, clientId: 'c', date: iso(daysAgo), weightKg, note: '' })
const ck = (daysAgo: number, over: Partial<DailyCheckin> = {}): DailyCheckin => ({
  id: `c${daysAgo}`, clientId: 'c', date: iso(daysAgo), followedPlan: 'si', hunger: 3, energy: 3, mood: 3, waterL: null, notes: '', ...over,
})
const base = (over: Partial<AlertInput> = {}): AlertInput => ({
  checkins: [], weights: [], goal: 'perder_peso', goalWeightKg: null, createdAt: today.getTime() - 200 * 86400000, ...over,
})
const kinds = (input: AlertInput) => computeClientAlerts(input, today).map(a => a.kind)

describe('weight_stalled', () => {
  it('flags 3+ weigh-ins over ~3 weeks within 0.5 kg for a weight-change goal', () => {
    expect(kinds(base({ weights: [w(20, 80), w(10, 79.8), w(1, 80.2)] }))).toContain('weight_stalled')
  })
  it('does not flag when the weight is still moving', () => {
    expect(kinds(base({ weights: [w(20, 82), w(10, 80.5), w(1, 79)] }))).not.toContain('weight_stalled')
  })
  it('needs at least 3 weigh-ins and a span of two weeks', () => {
    expect(kinds(base({ weights: [w(20, 80), w(1, 80)] }))).not.toContain('weight_stalled')
    expect(kinds(base({ weights: [w(9, 80), w(5, 80), w(1, 80)] }))).not.toContain('weight_stalled')
  })
  it('only applies to lose/gain goals, because stable is good for maintenance', () => {
    expect(kinds(base({ goal: 'mantener', weights: [w(20, 80), w(10, 80), w(1, 80)] }))).not.toContain('weight_stalled')
    expect(kinds(base({ goal: 'ganar_masa', weights: [w(20, 70), w(10, 70.1), w(1, 70)] }))).toContain('weight_stalled')
  })
  it('does not call it stalled when the goal weight was already reached', () => {
    const r = kinds(base({ goalWeightKg: 75, weights: [w(60, 85), w(20, 75), w(10, 75.1), w(1, 75)] }))
    expect(r).not.toContain('weight_stalled')
    expect(r).toContain('goal_reached')
  })
})

describe('goal_reached', () => {
  it('detects a reached goal for losing and gaining', () => {
    expect(kinds(base({ goalWeightKg: 70, weights: [w(40, 78), w(1, 69.8)] }))).toContain('goal_reached')
    expect(kinds(base({ goal: 'ganar_masa', goalWeightKg: 80, weights: [w(40, 72), w(1, 80.3)] }))).toContain('goal_reached')
  })
  it('does not fire when still far away or with a single weigh-in', () => {
    expect(kinds(base({ goalWeightKg: 70, weights: [w(40, 78), w(1, 74)] }))).not.toContain('goal_reached')
    expect(kinds(base({ goalWeightKg: 70, weights: [w(1, 70)] }))).not.toContain('goal_reached')
  })
  it('ignores clients who started at their goal weight', () => {
    expect(kinds(base({ goalWeightKg: 70, weights: [w(40, 70.3), w(1, 70)] }))).not.toContain('goal_reached')
  })
  it('is good news, not an action item', () => {
    const a = computeClientAlerts(base({ goalWeightKg: 70, weights: [w(40, 78), w(1, 69.8)] }), today).find(x => x.kind === 'goal_reached')!
    expect(a.priority).toBe('info')
  })
})

describe('hunger and energy', () => {
  it('flags sustained high hunger and low energy with the average', () => {
    const checkins = [ck(0, { hunger: 5, energy: 2 }), ck(1, { hunger: 4, energy: 2 }), ck(2, { hunger: 5, energy: 1 })]
    const alerts = computeClientAlerts(base({ checkins }), today)
    expect(alerts.find(a => a.kind === 'high_hunger')?.label).toBe('Hambre alta (4,7/5)')
    expect(alerts.find(a => a.kind === 'low_energy')?.label).toBe('Energía baja (1,7/5)')
  })
  it('needs at least three check-ins to say anything', () => {
    expect(kinds(base({ checkins: [ck(0, { hunger: 5, energy: 1 }), ck(1, { hunger: 5, energy: 1 })] }))).not.toContain('high_hunger')
  })
  it('stays quiet when values are normal', () => {
    expect(kinds(base({ checkins: [ck(0), ck(1), ck(2)] }))).not.toContain('high_hunger')
  })
})

describe('low_adherence', () => {
  it('flags adherence below 70% when there was activity this week', () => {
    const checkins = [ck(0), ck(1), ck(2, { followedPlan: 'no' }), ck(3, { followedPlan: 'no' }), ck(4, { followedPlan: 'no' })]
    const a = computeClientAlerts(base({ checkins }), today).find(x => x.kind === 'low_adherence')
    expect(a?.label).toBe('Adherencia 29% esta semana')
  })
  it('does not double up with the inactivity warning when there are no check-ins at all', () => {
    expect(kinds(base({ checkins: [] }))).not.toContain('low_adherence')
  })
  it('does not flag a brand-new client', () => {
    const checkins = [ck(0, { followedPlan: 'no' })]
    expect(kinds(base({ checkins, createdAt: today.getTime() - 2 * 86400000 }))).not.toContain('low_adherence')
  })
  it('does not flag healthy adherence', () => {
    expect(kinds(base({ checkins: [0, 1, 2, 3, 4, 5].map(d => ck(d)) }))).not.toContain('low_adherence')
  })
})

describe('no_weigh_in', () => {
  it('flags more than 14 days without weighing', () => {
    const a = computeClientAlerts(base({ weights: [w(20, 80)] }), today).find(x => x.kind === 'no_weigh_in')
    expect(a?.label).toBe('Sin registrar peso hace 20d')
  })
  it('flags an established client who never weighed in', () => {
    expect(computeClientAlerts(base(), today).find(x => x.kind === 'no_weigh_in')?.label).toBe('Sin pesajes registrados')
  })
  it('leaves a new client and a recent weigh-in alone', () => {
    expect(kinds(base({ createdAt: today.getTime() - 5 * 86400000 }))).not.toContain('no_weigh_in')
    expect(kinds(base({ weights: [w(3, 80)] }))).not.toContain('no_weigh_in')
  })
})

describe('all alerts', () => {
  it('returns nothing for a client who is fine', () => {
    const input = base({ checkins: [0, 1, 2, 3, 4, 5, 6].map(d => ck(d)), weights: [w(20, 82), w(10, 80.5), w(2, 79)] })
    expect(computeClientAlerts(input, today)).toEqual([])
  })
  it('does not mutate its input', () => {
    const weights = [w(1, 79), w(20, 82)]
    computeClientAlerts(base({ weights }), today)
    expect(weights.map(x => x.weightKg)).toEqual([79, 82])
  })
})
