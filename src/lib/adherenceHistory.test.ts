import { describe, it, expect } from 'vitest'
import { adherenceBetween, adherenceTrend, monthlyAdherence } from './adherenceHistory'

const ci = (date: string, followedPlan = 'si') => ({ date, followedPlan })

function everyDay(from: string, to: string, followedPlan = 'si') {
  const out = []
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) out.push(ci(d.toISOString().slice(0, 10), followedPlan))
  return out
}

describe('monthlyAdherence', () => {
  it('computes each month from the first day the client counts until today', () => {
    const checkins = [...everyDay('2026-09-01', '2026-09-30'), ...everyDay('2026-10-01', '2026-10-15'), ...everyDay('2026-11-01', '2026-11-04')]
    const m = monthlyAdherence(checkins, '2026-11-04', { months: 3, startDate: '2026-09-01' })
    expect(m.map(x => x.month)).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(m.map(x => x.pct)).toEqual([100, 48, 100]) // octubre: 15 de 31 días
    expect(m[1]).toMatchObject({ daysCounted: 31, checkinDays: 15, label: 'oct 2026' })
    expect(m[2].daysCounted).toBe(4) // el mes en curso solo cuenta hasta hoy
  })

  it('does not count the months before the client started', () => {
    const m = monthlyAdherence(everyDay('2026-10-20', '2026-11-04'), '2026-11-04', { months: 6, startDate: '2026-10-20' })
    expect(m.map(x => x.month)).toEqual(['2026-10', '2026-11'])
    expect(m[0].daysCounted).toBe(12) // del 20 al 31
    expect(m[0].pct).toBe(100)
  })

  it('uses the first check-in when there is no start date, and returns nothing without data', () => {
    expect(monthlyAdherence(everyDay('2026-11-01', '2026-11-04'), '2026-11-04').map(x => x.month)).toEqual(['2026-11'])
    expect(monthlyAdherence([], '2026-11-04')).toEqual([])
  })

  it('counts «parcial» as followed and «no» as not, like the 7 and 30 day figures', () => {
    const checkins = [ci('2026-11-01', 'si'), ci('2026-11-02', 'parcial'), ci('2026-11-03', 'no'), ci('2026-11-04', 'si')]
    expect(monthlyAdherence(checkins, '2026-11-04', { months: 1, startDate: '2026-11-01' })[0].pct).toBe(75)
  })

  it('crosses the year boundary', () => {
    const m = monthlyAdherence(everyDay('2026-12-01', '2027-01-10'), '2027-01-10', { months: 2, startDate: '2026-12-01' })
    expect(m.map(x => x.month)).toEqual(['2026-12', '2027-01'])
    expect(m.map(x => x.pct)).toEqual([100, 100])
  })
})

describe('adherenceBetween', () => {
  it('measures a range, both ends included', () => {
    expect(adherenceBetween(everyDay('2026-10-12', '2026-10-15'), '2026-10-12', '2026-10-21')).toEqual({ pct: 40, daysCounted: 10 })
    expect(adherenceBetween([], '2026-10-12', '2026-10-21')).toEqual({ pct: 0, daysCounted: 10 })
  })
  it('returns null for an empty or inverted range', () => {
    expect(adherenceBetween([], '2026-10-21', '2026-10-12')).toBeNull()
  })
})

describe('adherenceTrend', () => {
  it('goes up or down when the last two months differ by 10 points or more', () => {
    expect(adherenceTrend([{ pct: 60 }, { pct: 75 }])).toBe('up')
    expect(adherenceTrend([{ pct: 80 }, { pct: 65 }])).toBe('down')
    expect(adherenceTrend([{ pct: 80 }, { pct: 85 }])).toBe('flat')
  })
  it('needs two months', () => {
    expect(adherenceTrend([{ pct: 80 }])).toBeNull()
    expect(adherenceTrend([])).toBeNull()
  })
})
