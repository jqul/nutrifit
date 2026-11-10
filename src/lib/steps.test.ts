import { describe, it, expect } from 'vitest'
import { parseSteps, formatSteps, stepsSummary, lastDaysSeries, hasSteps, MAX_STEPS } from './steps'

describe('parseSteps', () => {
  it('reads plain numbers', () => {
    expect(parseSteps('8432')).toBe(8432)
    expect(parseSteps('  500 ')).toBe(500)
    expect(parseSteps('0')).toBe(0)
  })
  it('reads the thousands separators a health app would copy', () => {
    expect(parseSteps('8.432')).toBe(8432)
    expect(parseSteps('8,432')).toBe(8432)
    expect(parseSteps('8 432')).toBe(8432)
    expect(parseSteps('12.345')).toBe(12345)
    expect(parseSteps('1.234.567')).toBeNull()
  })
  it('is null when empty so the day can be cleared', () => {
    expect(parseSteps('')).toBeNull()
    expect(parseSteps('   ')).toBeNull()
  })
  it('rejects decimals, negatives, text and absurd numbers', () => {
    for (const bad of ['8.5', '8,5', '-100', 'ocho mil', '8k', '1e4', '100001', '99999999', '8.43', '8..432']) expect(parseSteps(bad), bad).toBeNull()
  })
  it('accepts the maximum and nothing above', () => {
    expect(parseSteps(String(MAX_STEPS))).toBe(MAX_STEPS)
    expect(parseSteps('100.000')).toBe(MAX_STEPS)
    expect(parseSteps('100.001')).toBeNull()
  })
})

describe('formatSteps', () => {
  it('puts a point every thousand, also in four digits', () => {
    expect(formatSteps(8432)).toBe('8.432')
    expect(formatSteps(12345)).toBe('12.345')
    expect(formatSteps(950)).toBe('950')
    expect(formatSteps(8431.6)).toBe('8.432')
  })
})

const d = (date: string, steps: number | null) => ({ date, steps })
const TODAY = '2026-11-10'

describe('stepsSummary', () => {
  it('averages only the days that have steps, and says how many', () => {
    const s = stepsSummary([d('2026-11-10', 10000), d('2026-11-08', 6000), d('2026-11-07', null)], TODAY)
    expect(s.last7).toEqual({ average: 8000, days: 2 })
    expect(s.last30!.days).toBe(2)
  })
  it('has nothing when no day has steps', () => {
    const s = stepsSummary([d('2026-11-10', null)], TODAY)
    expect(s.last7).toBeNull(); expect(s.last30).toBeNull(); expect(s.changeVsPrevious).toBeNull()
  })
  it('splits the last 7 days from the 7 before, boundaries included', () => {
    const rows = [d('2026-11-04', 10000), d('2026-11-03', 4000)]   // 6 y 7 días atrás
    const s = stepsSummary(rows, TODAY)
    expect(s.last7).toEqual({ average: 10000, days: 1 })
    expect(s.previous7).toEqual({ average: 4000, days: 1 })
  })
  it('compares weeks only with at least 3 days in each', () => {
    const thisWeek = ['10', '09', '08'].map(x => d(`2026-11-${x}`, 9000))
    const lastWeek = ['03', '02', '01'].map(x => d(`2026-11-${x}`, 7000))
    expect(stepsSummary([...thisWeek, ...lastWeek], TODAY).changeVsPrevious).toBe(2000)
    expect(stepsSummary([...thisWeek, lastWeek[0], lastWeek[1]], TODAY).changeVsPrevious).toBeNull()
  })
  it('ignores days in the future and older than 30 days for the monthly average', () => {
    const s = stepsSummary([d('2026-11-11', 20000), d('2026-10-10', 20000), d('2026-10-12', 5000)], TODAY)
    expect(s.last30).toEqual({ average: 5000, days: 1 })
  })
})

describe('lastDaysSeries', () => {
  it('returns 14 days oldest first ending today, with null for the days without data', () => {
    const s = lastDaysSeries([d('2026-11-10', 9000), d('2026-11-01', 4000)], TODAY)
    expect(s).toHaveLength(14)
    expect(s[0].date).toBe('2026-10-28')
    expect(s[13]).toEqual({ date: '2026-11-10', steps: 9000 })
    expect(s.find(x => x.date === '2026-11-01')!.steps).toBe(4000)
    expect(s.find(x => x.date === '2026-11-05')!.steps).toBeNull()
  })
})

describe('hasSteps', () => {
  it('is true if any day has steps, even 0', () => {
    expect(hasSteps([d('2026-11-10', null)])).toBe(false)
    expect(hasSteps([d('2026-11-10', 0)])).toBe(true)
    expect(hasSteps([])).toBe(false)
  })
})
