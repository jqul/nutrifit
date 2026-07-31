import { describe, it, expect } from 'vitest'
import { convertQuantity, computeMacros } from './foodConversion'
import { Food } from '../types'

const pollo: Food = { id: '1', name: 'Pechuga de pollo', category: 'Proteína', kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 }

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
