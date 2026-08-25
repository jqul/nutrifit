import { describe, it, expect } from 'vitest'
import { calcBmi, bmiCategory } from './bmi'

describe('calcBmi', () => {
  it('computes weight over height-in-meters squared', () => {
    expect(calcBmi(70, 175)).toBeCloseTo(22.86, 1)
  })
})

describe('bmiCategory', () => {
  it('classifies each WHO range correctly, including the boundaries', () => {
    expect(bmiCategory(18.4)).toBe('bajo peso')
    expect(bmiCategory(18.5)).toBe('normal')
    expect(bmiCategory(24.9)).toBe('normal')
    expect(bmiCategory(25)).toBe('sobrepeso')
    expect(bmiCategory(29.9)).toBe('sobrepeso')
    expect(bmiCategory(30)).toBe('obesidad')
  })
})
