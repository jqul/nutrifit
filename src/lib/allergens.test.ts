import { describe, it, expect } from 'vitest'
import { detectAllergenConflict } from './allergens'

describe('detectAllergenConflict', () => {
  it('returns null when the client has no allergies', () => {
    expect(detectAllergenConflict('', 'Leche entera')).toBeNull()
  })

  it('returns null when the food name is empty', () => {
    expect(detectAllergenConflict('Alergia a la lactosa', '')).toBeNull()
  })

  it('flags a matching category (lactosa)', () => {
    expect(detectAllergenConflict('Intolerancia a la lactosa', 'Yogur natural')).toBe('lactosa')
  })

  it('flags frutos secos regardless of case', () => {
    expect(detectAllergenConflict('ALERGIA A LOS FRUTOS SECOS', 'Almendras')).toBe('frutos_secos')
  })

  it('does not flag unrelated foods', () => {
    expect(detectAllergenConflict('Alergia a los frutos secos', 'Pechuga de pollo')).toBeNull()
  })

  it('does not flag foods from a different allergen category', () => {
    expect(detectAllergenConflict('Alergia al marisco', 'Salmón')).toBeNull()
  })

  it('does not flag a food explicitly labeled free of the allergen', () => {
    expect(detectAllergenConflict('Intolerancia a la lactosa', 'Yogur natural sin lactosa')).toBeNull()
  })
})
