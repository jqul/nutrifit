import { describe, it, expect } from 'vitest'
import { DailyCheckin, WeightEntry } from '../types'
import { buildWeeklyReview, weekStartISO, isReviewable, ReviewInput } from './weeklyReview'

// Lunes 5 oct 2026 al mediodía.
const today = new Date('2026-10-05T12:00:00')
const iso = (daysAgo: number) => {
  const d = new Date(today); d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ck = (daysAgo: number, over: Partial<DailyCheckin> = {}): DailyCheckin => ({
  id: `c${daysAgo}`, clientId: 'c', date: iso(daysAgo), followedPlan: 'si', hunger: 3, energy: 3, mood: 3, waterL: null, notes: '', ...over,
})
const w = (daysAgo: number, weightKg: number): WeightEntry => ({ id: `w${daysAgo}`, clientId: 'c', date: iso(daysAgo), weightKg, note: '' })
const input = (over: Partial<ReviewInput> = {}): ReviewInput => ({
  checkins: [], weights: [], goal: 'perder_peso', goalWeightKg: null, createdAt: today.getTime() - 200 * 86400000, ...over,
})
const item = (r: ReturnType<typeof buildWeeklyReview>, key: string) => r.items.find(i => i.key === key)!
const days = (from: number, to: number, over: Partial<DailyCheckin> = {}) => Array.from({ length: to - from + 1 }, (_, i) => ck(from + i, over))

describe('weekStartISO', () => {
  it('returns the Monday of the week, including Sundays', () => {
    expect(weekStartISO(new Date('2026-10-05T12:00:00'))).toBe('2026-10-05') // lunes
    expect(weekStartISO(new Date('2026-10-08T23:30:00'))).toBe('2026-10-05') // jueves
    expect(weekStartISO(new Date('2026-10-11T08:00:00'))).toBe('2026-10-05') // domingo
    expect(weekStartISO(new Date('2026-10-12T00:10:00'))).toBe('2026-10-12') // siguiente lunes
  })
})

describe('isReviewable', () => {
  it('needs a check-in in the last two weeks', () => {
    expect(isReviewable({ lastCheckin: iso(0) }, today)).toBe(true)
    expect(isReviewable({ lastCheckin: iso(14) }, today)).toBe(true)
    expect(isReviewable({ lastCheckin: iso(15) }, today)).toBe(false)
    expect(isReviewable({}, today)).toBe(false)
  })
})

describe('buildWeeklyReview items', () => {
  it('reports there is no data for a client with nothing recent', () => {
    const r = buildWeeklyReview(input(), today)
    expect(r.hasData).toBe(false)
    expect(r.weekStart).toBe('2026-10-05')
  })

  it('compares adherence and check-ins with the previous week', () => {
    const checkins = [...days(0, 5), ...days(7, 12, { followedPlan: 'no' })]
    const r = buildWeeklyReview(input({ checkins }), today)
    expect(item(r, 'checkins').value).toBe('6/7')
    expect(item(r, 'adherence').value).toBe('86%')
    expect(item(r, 'adherence').tone).toBe('good')
    expect(item(r, 'adherence').detail).toBe('+86 pts vs semana anterior')
  })

  it('shows the hunger change against last week and warns on a jump of 1 or more', () => {
    const checkins = [...days(0, 3, { hunger: 4 }), ...days(7, 10, { hunger: 2 })]
    const r = buildWeeklyReview(input({ checkins }), today)
    expect(item(r, 'hunger').value).toBe('4,0/5')
    expect(item(r, 'hunger').detail).toBe('+2,0 vs semana anterior')
    expect(item(r, 'hunger').tone).toBe('warn')
  })

  it('warns on low energy', () => {
    const r = buildWeeklyReview(input({ checkins: days(0, 3, { energy: 2 }) }), today)
    expect(item(r, 'energy').tone).toBe('warn')
  })

  it('judges the weight change by the goal', () => {
    const losing = buildWeeklyReview(input({ checkins: [ck(0)], weights: [w(12, 80), w(1, 79.4)] }), today)
    expect(item(losing, 'weight').value).toBe('↓ 0,6 kg')
    expect(item(losing, 'weight').tone).toBe('good')
    const gaining = buildWeeklyReview(input({ goal: 'ganar_masa', checkins: [ck(0)], weights: [w(12, 80), w(1, 79.4)] }), today)
    expect(item(gaining, 'weight').tone).toBe('warn')
  })

  it('says so when there are fewer than two weigh-ins', () => {
    const r = buildWeeklyReview(input({ checkins: [ck(0)], weights: [w(1, 80)] }), today)
    expect(item(r, 'weight').value).toBe('Sin datos')
  })

  it('counts concerning digestion days', () => {
    const checkins = [ck(0, { bloating: 3 }), ck(1, { abdominalPain: 2 }), ck(2, { bloating: 0 })]
    const r = buildWeeklyReview(input({ checkins }), today)
    expect(item(r, 'digestion').value).toBe('2 días con molestias')
  })
})

describe('buildWeeklyReview suggestion', () => {
  it('asks to get in touch when there were no check-ins', () => {
    const r = buildWeeklyReview(input({ weights: [w(1, 80)] }), today)
    expect(r.suggestion).toMatch(/Sin check-ins esta semana/)
  })

  it('says to keep the plan when everything is fine', () => {
    const r = buildWeeklyReview(input({ checkins: days(0, 6), weights: [w(12, 82), w(1, 80)] }), today)
    expect(r.suggestion).toBe('Buena semana: mantener el plan.')
  })

  it('prioritises adherence over adjusting the plan', () => {
    const checkins = [ck(0), ck(1, { followedPlan: 'no' }), ck(2, { followedPlan: 'no' }), ck(3, { followedPlan: 'no' })]
    const r = buildWeeklyReview(input({ checkins, weights: [w(1, 80)] }), today)
    expect(r.suggestion).toMatch(/^Adherencia baja/)
  })

  it('suggests holding calories and checking hunger when hunger climbs', () => {
    const checkins = [...days(0, 6, { hunger: 5 }), ...days(7, 13, { hunger: 2 })]
    const r = buildWeeklyReview(input({ checkins, weights: [w(12, 82), w(1, 80)] }), today)
    expect(r.suggestion).toMatch(/Hambre en aumento: valorar mantener las calorías/)
  })

  it('suggests adjusting calories when adherence is high and the weight is stalled', () => {
    const r = buildWeeklyReview(input({ checkins: days(0, 6), weights: [w(20, 80), w(10, 79.9), w(1, 80.1)] }), today)
    expect(r.suggestion).toMatch(/peso estancado: valorar ajustar las calorías/)
  })

  it('celebrates a reached goal first', () => {
    const r = buildWeeklyReview(input({ checkins: days(0, 6), goalWeightKg: 70, weights: [w(40, 78), w(1, 69.8)] }), today)
    expect(r.suggestion).toMatch(/^Objetivo alcanzado/)
  })

  it('never suggests more than two things', () => {
    const checkins = days(0, 4, { followedPlan: 'no', hunger: 5, energy: 1, bloating: 3 })
    const r = buildWeeklyReview(input({ checkins, weights: [w(20, 80), w(1, 80)] }), today)
    expect(r.suggestion.split('. ').length).toBeLessThanOrEqual(2)
  })
})

import { pendingReviews } from './weeklyReview'

describe('pendingReviews', () => {
  const c = (id: string, lastCheckin?: string) => ({ id, lastCheckin })
  it('lists active clients whose review for this week is not done, keeping the given order', () => {
    const clients = [c('a', iso(1)), c('b', iso(30)), c('c', iso(0)), c('d')]
    expect(pendingReviews(clients, new Set(['c']), today).map(x => x.id)).toEqual(['a'])
  })
  it('is empty when everyone was reviewed', () => {
    expect(pendingReviews([c('a', iso(1))], new Set(['a']), today)).toEqual([])
  })
})
