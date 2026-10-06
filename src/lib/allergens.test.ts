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

  it('flags the dairy foods whose name does not say "leche" or "queso"', () => {
    for (const name of ['Skyr', 'Kéfir', 'Proteína de suero (polvo)', 'Queso cottage']) {
      expect(detectAllergenConflict('Intolerancia a la lactosa', name), name).toBe('lactosa')
    }
  })

  it('does not flag plant drinks or nut butters for lactose: they are the usual replacement', () => {
    for (const name of ['Leche de avena', 'Leche de almendra', 'Bebida de soja', 'Mantequilla de cacahuete']) {
      expect(detectAllergenConflict('Intolerancia a la lactosa', name), name).not.toBe('lactosa')
    }
  })

  it('still flags the real thing next to them', () => {
    expect(detectAllergenConflict('Intolerancia a la lactosa', 'Leche entera')).toBe('lactosa')
    expect(detectAllergenConflict('Intolerancia a la lactosa', 'Mantequilla')).toBe('lactosa')
  })

  it('plant drinks are still flagged for the allergy they do carry', () => {
    expect(detectAllergenConflict('Alergia a los frutos secos', 'Leche de almendra')).toBe('frutos_secos')
    expect(detectAllergenConflict('Alergia a la soja', 'Bebida de soja')).toBe('soja')
  })

  it('does not flag a food explicitly labeled free of the allergen', () => {
    expect(detectAllergenConflict('Intolerancia a la lactosa', 'Yogur natural sin lactosa')).toBeNull()
  })
})
