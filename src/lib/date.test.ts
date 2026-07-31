import { describe, it, expect } from 'vitest'
import { toLocalISODate } from './date'

describe('toLocalISODate', () => {
  it('formats a date as YYYY-MM-DD using local fields', () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('pads single-digit month and day', () => {
    expect(toLocalISODate(new Date(2026, 8, 9))).toBe('2026-09-09')
  })

  it('does not shift the date near a UTC day boundary (the bug toISOString() has)', () => {
    // 23:30 local time on Dec 31 — toISOString() in a UTC+ timezone would push
    // this into the next day; toLocalISODate must not.
    const d = new Date(2026, 11, 31, 23, 30)
    expect(toLocalISODate(d)).toBe('2026-12-31')
  })
})
