import { describe, it, expect } from 'vitest'
import { DailyCheckin, WeightEntry } from '../types'
import { DietPlanChangeRow } from './supabase-types'
import { buildReportSummary, resolveRange } from './reportSummary'

// Lunes 5 oct 2026, mediodía.
const today = new Date('2026-10-05T12:00:00')
const iso = (daysAgo: number) => {
  const d = new Date(today); d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const w = (daysAgo: number, weightKg: number): WeightEntry => ({ id: `w${daysAgo}`, clientId: 'c', date: iso(daysAgo), weightKg, note: '' })
const ck = (daysAgo: number, over: Partial<DailyCheckin> = {}): DailyCheckin => ({
  id: `c${daysAgo}`, clientId: 'c', date: iso(daysAgo), followedPlan: 'si', hunger: 3, energy: 3, mood: 3, waterL: null, notes: '', ...over,
})
const chg = (daysAgo: number, over: Partial<DietPlanChangeRow> = {}): DietPlanChangeRow => ({
  id: `p${daysAgo}`, plan_id: 'pl', client_id: 'c', changed_at: new Date(today.getTime() - daysAgo * 86400000).toISOString(), changed_by: null,
  changes: [{ field: 'kcal_target', from: 1800, to: 1700 }], reason: null, ...over,
})

describe('resolveRange', () => {
  it('covers the last 30 / 90 days including today', () => {
    expect(resolveRange('30d', today, null)).toEqual({ start: '2026-09-06', end: '2026-10-05', days: 30 })
    expect(resolveRange('90d', today, null).start).toBe('2026-07-08')
  })
  it('covers everything since the first record, at least a week', () => {
    expect(resolveRange('all', today, iso(60))).toEqual({ start: iso(60), end: '2026-10-05', days: 61 })
    expect(resolveRange('all', today, iso(1)).days).toBe(7)
    expect(resolveRange('all', today, null).days).toBe(30)
  })
})

describe('buildReportSummary — weight', () => {
  it('goes from the first to the last weigh-in inside the period', () => {
    const s = buildReportSummary({ weights: [w(60, 90), w(25, 80), w(10, 79), w(1, 78.2)], checkins: [] }, '30d', today)
    expect(s.weight).toMatchObject({ startKg: 80, endKg: 78.2, changeKg: -1.8 })
    expect(s.weight!.entries).toHaveLength(3)
  })
  it('has no change with fewer than two weigh-ins in the period', () => {
    expect(buildReportSummary({ weights: [w(60, 90), w(5, 80)], checkins: [] }, '30d', today).weight).toBeNull()
  })
  it('uses the whole history for "all"', () => {
    expect(buildReportSummary({ weights: [w(60, 90), w(1, 78)], checkins: [] }, 'all', today).weight).toMatchObject({ startKg: 90, endKg: 78, changeKg: -12 })
  })
})

describe('buildReportSummary — adherence and check-ins', () => {
  it('compares adherence with the previous equal period', () => {
    const thisPeriod = Array.from({ length: 30 }, (_, i) => ck(i)) // 100 %
    const prev = Array.from({ length: 30 }, (_, i) => ck(30 + i, { followedPlan: i < 15 ? 'si' : 'no' })) // 50 %
    const s = buildReportSummary({ weights: [], checkins: [...thisPeriod, ...prev] }, '30d', today)
    expect(s.adherence).toEqual({ pct: 100, prevPct: 50 })
    expect(s.checkins).toEqual({ done: 30, days: 30 })
  })
  it('has nothing to compare against when the previous period had no check-ins', () => {
    const s = buildReportSummary({ weights: [], checkins: [ck(1), ck(2)] }, '30d', today)
    expect(s.adherence.prevPct).toBeNull()
    expect(s.checkins.done).toBe(2)
  })
})

describe('buildReportSummary — signals', () => {
  it('averages hunger and energy and compares with the previous period', () => {
    const now = [ck(0, { hunger: 4, energy: 2 }), ck(1, { hunger: 4, energy: 2 })]
    const before = [ck(31, { hunger: 2, energy: 4 })]
    const s = buildReportSummary({ weights: [], checkins: [...now, ...before] }, '30d', today)
    expect(s.signals!.hunger).toEqual({ avg: 4, prevAvg: 2 })
    expect(s.signals!.energy).toEqual({ avg: 2, prevAvg: 4 })
  })
  it('counts digestion days with discomfort', () => {
    const s = buildReportSummary({ weights: [], checkins: [ck(0, { bloating: 3 }), ck(1, { bloating: 0 }), ck(2, { abdominalPain: 2 })] }, '30d', today)
    expect(s.signals).toMatchObject({ concerningDigestionDays: 2, digestionDaysWithData: 3 })
  })
  it('is null without check-ins in the period', () => {
    expect(buildReportSummary({ weights: [w(1, 80)], checkins: [ck(50)] }, '30d', today).signals).toBeNull()
  })
})

describe('buildReportSummary — plan changes and review notes (nutritionist only)', () => {
  it('keeps the plan changes of the period in order', () => {
    const s = buildReportSummary({ weights: [], checkins: [], planChanges: [chg(40), chg(3, { id: 'late' }), chg(20, { id: 'mid' })] }, '30d', today)
    expect(s.planChanges.map(c => c.id)).toEqual(['mid', 'late'])
  })
  it('includes only the valuations the nutritionist edited, not accepted suggestions or ignored weeks', () => {
    const s = buildReportSummary({
      weights: [], checkins: [],
      reviews: [
        { week_start: '2026-09-28', status: 'edited', note: 'Mantener plan; revisar analítica.' },
        { week_start: '2026-09-21', status: 'accepted', note: 'Sugerencia del sistema' },
        { week_start: '2026-09-14', status: 'ignored', note: '' },
        { week_start: '2026-06-01', status: 'edited', note: 'Fuera del periodo' },
      ],
    }, '30d', today)
    expect(s.reviewNotes).toEqual([{ weekStart: '2026-09-28', note: 'Mantener plan; revisar analítica.' }])
  })
  it('is empty when none were provided', () => {
    const s = buildReportSummary({ weights: [], checkins: [] }, '30d', today)
    expect(s.planChanges).toEqual([])
    expect(s.reviewNotes).toEqual([])
  })
})
