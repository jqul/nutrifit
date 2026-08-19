import { describe, it, expect } from 'vitest'
import {
  bmrMifflinStJeor, bmrHarrisBenedict, bmrKatchMcArdle, computeMetabolicPlan, ageFromBirthDate,
} from './metabolicCalculator'

describe('bmrMifflinStJeor', () => {
  it('computes BMR for a man', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(bmrMifflinStJeor('hombre', 80, 180, 30)).toBe(1780)
  })
  it('computes BMR for a woman', () => {
    // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25
    expect(bmrMifflinStJeor('mujer', 60, 165, 28)).toBeCloseTo(1330.25)
  })
})

describe('bmrHarrisBenedict', () => {
  it('computes BMR for a man', () => {
    const bmr = bmrHarrisBenedict('hombre', 80, 180, 30)
    expect(bmr).toBeGreaterThan(1700)
  })
})

describe('bmrKatchMcArdle', () => {
  it('uses lean mass instead of total weight', () => {
    // leanMass = 80*(1-0.15) = 68; BMR = 370 + 21.6*68 = 1838.8
    expect(bmrKatchMcArdle(80, 15)).toBeCloseTo(1838.8)
  })
})

describe('computeMetabolicPlan', () => {
  const base = {
    formula: 'mifflin' as const, sex: 'hombre' as const, weightKg: 80, heightCm: 180, age: 30,
    activity: 'moderado' as const, goal: 'deficit' as const, proteinGPerKg: 2, fatGPerKg: 1,
  }

  it('returns null when required fields are missing', () => {
    expect(computeMetabolicPlan({ ...base, weightKg: 0 })).toBeNull()
  })

  it('returns null for katch formula without body fat %', () => {
    expect(computeMetabolicPlan({ ...base, formula: 'katch' })).toBeNull()
  })

  it('computes a full plan with a deficit applied to TDEE', () => {
    const result = computeMetabolicPlan(base)
    expect(result).not.toBeNull()
    // bmr 1780 * 1.55 = 2759 tdee; deficit 20% -> 2207.2 kcal target
    expect(result!.bmr).toBe(1780)
    expect(result!.tdee).toBe(Math.round(1780 * 1.55))
    expect(result!.kcalTarget).toBe(Math.round(1780 * 1.55 * 0.8))
  })

  it('splits protein and fat by g/kg and fills the rest with carbs', () => {
    const result = computeMetabolicPlan(base)!
    expect(result.proteinG).toBe(160) // 2 g/kg * 80kg
    expect(result.fatG).toBe(80) // 1 g/kg * 80kg
    const expectedCarbs = Math.round((result.kcalTarget - (160 * 4 + 80 * 9)) / 4)
    expect(result.carbsG).toBe(expectedCarbs)
  })

  it('estimates fiber at ~14g per 1000 kcal', () => {
    const result = computeMetabolicPlan(base)!
    expect(result.fiberG).toBe(Math.round((result.kcalTarget / 1000) * 14))
  })
})

describe('ageFromBirthDate', () => {
  it('returns null for missing birth date', () => {
    expect(ageFromBirthDate(null)).toBeNull()
  })
  it('computes age correctly before the birthday this year', () => {
    const ref = new Date('2026-03-01')
    expect(ageFromBirthDate('1990-04-12', ref)).toBe(35)
  })
  it('computes age correctly after the birthday this year', () => {
    const ref = new Date('2026-05-01')
    expect(ageFromBirthDate('1990-04-12', ref)).toBe(36)
  })
})
