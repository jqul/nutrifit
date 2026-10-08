import { describe, expect, it } from 'vitest'
import { reviewLabel } from './reviewStatus'

const NOW = new Date(2026, 9, 8, 12, 0, 0)   // 8 oct 2026, mediodía

describe('reviewLabel', () => {
  it('says it was never reviewed when there is no date', () => {
    expect(reviewLabel(null, NOW)).toBe('Todavía sin revisar')
    expect(reviewLabel('no es una fecha', NOW)).toBe('Todavía sin revisar')
  })
  it('counts calendar days, not 24-hour blocks', () => {
    expect(reviewLabel(new Date(2026, 9, 8, 0, 5).toISOString(), NOW)).toBe('Revisado hoy')
    expect(reviewLabel(new Date(2026, 9, 7, 23, 55).toISOString(), NOW)).toBe('Revisado ayer')
    expect(reviewLabel(new Date(2026, 9, 3, 9, 0).toISOString(), NOW)).toBe('Revisado hace 5 días')
  })
})
