import { describe, it, expect } from 'vitest'
import { convertQuantity, computeMacros, computeSubstitution } from './foodConversion'
import { Food } from '../types'

const pollo: Food = { id: '1', name: 'Pechuga de pollo', category: 'Proteína', kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 }
const tofu: Food = { id: '2', name: 'Tofu', category: 'Proteína', kcal: 76, proteinG: 8, carbsG: 1.9, fatG: 4.8 }
const aceite: Food = { id: '3', name: 'Aceite de oliva', category: 'Grasa', kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 }

describe('convertQuantity', () => {
  it('converts between common household units via their gram equivalence', () => {
    expect(convertQuantity(1, 'cucharada', 'g')).toBe(15)
    expect(convertQuantity(2, 'taza', 'ml')).toBe(480)
  })

  it('is a no-op when converting a unit to itself', () => {
    expect(convertQuantity(100, 'g', 'g')).toBe(100)
  })

  it('returns null for units with no fixed gram equivalence (e.g. "unidad")', () => {
    expect(convertQuantity(1, 'unidad', 'g')).toBeNull()
  })
})

describe('computeSubstitution', () => {
  it('finds how many grams of the substitute food match the same amount of a macro', () => {
    // 100g pollo = 31g proteína; tofu tiene 8g proteína/100g → 31*100/8 = 387.5g
    expect(computeSubstitution(pollo, 100, 'g', tofu, 'proteinG')).toBeCloseTo(387.5)
  })

  it('scales with the source quantity', () => {
    // 200g pollo = 62g proteína → 62*100/8 = 775g de tofu
    expect(computeSubstitution(pollo, 200, 'g', tofu, 'proteinG')).toBeCloseTo(775)
  })

  it('can match by kcal instead of protein', () => {
    // 100g pollo = 165 kcal; aceite tiene 884 kcal/100g → 165*100/884 ≈ 18.66g
    expect(computeSubstitution(pollo, 100, 'g', aceite, 'kcal')).toBeCloseTo(18.66, 1)
  })

  it('returns null when the substitute has none of the matched macro (division by zero)', () => {
    expect(computeSubstitution(pollo, 100, 'g', aceite, 'proteinG')).toBeNull()
  })

  it('returns null for a non-convertible source unit', () => {
    expect(computeSubstitution(pollo, 1, 'unidad', tofu, 'proteinG')).toBeNull()
  })
})

describe('computeMacros', () => {
  it('scales macros per 100g proportionally to the given quantity', () => {
    expect(computeMacros(pollo, 200, 'g')).toEqual({ kcal: 330, proteinG: 62, carbsG: 0, fatG: 7.2 })
  })

  it('converts household units before scaling', () => {
    // 1 cucharada = 15g = 0.15x
    expect(computeMacros(pollo, 1, 'cucharada')).toEqual({ kcal: 25, proteinG: 4.6, carbsG: 0, fatG: 0.5 })
  })

  it('returns null for a non-convertible unit', () => {
    expect(computeMacros(pollo, 1, 'unidad')).toBeNull()
  })
})
