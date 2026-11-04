import { describe, it, expect } from 'vitest'
import { gramsToPercent, percentToGrams, percentTotal } from './macroUnits'

describe('macroUnits', () => {
  it('converts grams to a percentage of the calories (4-4-9)', () => {
    expect(gramsToPercent(2000, 150, 'proteinG')).toBe(30)
    expect(gramsToPercent(2000, 200, 'carbsG')).toBe(40)
    expect(gramsToPercent(2000, 67, 'fatG')).toBe(30)
  })

  it('converts a percentage back to grams', () => {
    expect(percentToGrams(2000, 30, 'proteinG')).toBe(150)
    expect(percentToGrams(2000, 40, 'carbsG')).toBe(200)
    expect(percentToGrams(2000, 30, 'fatG')).toBe(67)
  })

  it('round-trips within rounding', () => {
    for (const macro of ['proteinG', 'carbsG', 'fatG'] as const) {
      const g = percentToGrams(1850, 25, macro)!
      expect(Math.abs(gramsToPercent(1850, g, macro)! - 25)).toBeLessThanOrEqual(1)
    }
  })

  it('refuses to convert without calories or with nonsense values', () => {
    expect(gramsToPercent(0, 100, 'proteinG')).toBeNull()
    expect(percentToGrams(0, 30, 'proteinG')).toBeNull()
    expect(gramsToPercent(2000, NaN, 'proteinG')).toBeNull()
    expect(percentToGrams(2000, -5, 'fatG')).toBeNull()
  })

  it('adds up the three percentages, so the nutritionist sees how close it is to 100', () => {
    expect(percentTotal(2000, { proteinG: 150, carbsG: 200, fatG: 67 })).toBe(100)
    expect(percentTotal(2000, { proteinG: 150, carbsG: NaN, fatG: 67 })).toBeNull()
    expect(percentTotal(0, { proteinG: 1, carbsG: 1, fatG: 1 })).toBeNull()
  })
})
