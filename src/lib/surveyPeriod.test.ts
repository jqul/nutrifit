import { describe, it, expect } from 'vitest'
import { periodKeyFor, periodLabel } from './surveyPeriod'

describe('periodKeyFor', () => {
  it('computes the ISO week key for a weekly survey', () => {
    // 12 de agosto de 2026 es miércoles de la semana ISO 33 de 2026.
    expect(periodKeyFor('weekly', new Date(2026, 7, 12))).toBe('2026-W33')
  })

  it('computes the month key for a monthly survey', () => {
    expect(periodKeyFor('monthly', new Date(2026, 7, 12))).toBe('2026-08')
  })

  it('gives the same weekly key for any day within the same ISO week', () => {
    const monday = periodKeyFor('weekly', new Date(2026, 7, 10))
    const sunday = periodKeyFor('weekly', new Date(2026, 7, 16))
    expect(monday).toBe(sunday)
  })

  it('gives different weekly keys across a week boundary', () => {
    const sunday = periodKeyFor('weekly', new Date(2026, 7, 16))
    const nextMonday = periodKeyFor('weekly', new Date(2026, 7, 17))
    expect(sunday).not.toBe(nextMonday)
  })
})

describe('periodLabel', () => {
  it('labels a monthly period as "mes año"', () => {
    expect(periodLabel('monthly', '2026-08')).toBe('agosto de 2026')
  })

  it('labels a weekly period as its Monday-to-Sunday range', () => {
    expect(periodLabel('weekly', '2026-W33')).toBe('10 ago – 16 ago')
  })
})
