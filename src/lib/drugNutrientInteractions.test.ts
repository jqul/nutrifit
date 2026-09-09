import { describe, it, expect } from 'vitest'
import { detectDrugInteraction } from './drugNutrientInteractions'

describe('detectDrugInteraction', () => {
  it('returns null when there is no medication text', () => {
    expect(detectDrugInteraction('', 'Espinacas')).toBeNull()
  })

  it('returns null when the food name is empty', () => {
    expect(detectDrugInteraction('Sintrom', '')).toBeNull()
  })

  it('flags vitamin K foods for anticoagulants', () => {
    const hit = detectDrugInteraction('Toma Sintrom por una trombosis previa', 'Espinacas salteadas')
    expect(hit?.category).toBe('anticoagulantes')
  })

  it('flags asparagus for anticoagulants too', () => {
    expect(detectDrugInteraction('Warfarina', 'Espárragos trigueros')?.category).toBe('anticoagulantes')
  })

  it('is case-insensitive on both sides', () => {
    expect(detectDrugInteraction('ACENOCUMAROL', 'BRÓCOLI al vapor')?.category).toBe('anticoagulantes')
  })

  it('flags coffee/soy/dairy/calcium/iron for levothyroxine', () => {
    expect(detectDrugInteraction('Levotiroxina para hipotiroidismo', 'Café con leche')?.category).toBe('tiroides')
  })

  it('flags grapefruit for statins', () => {
    expect(detectDrugInteraction('Atorvastatina 20mg', 'Zumo de pomelo')?.category).toBe('estatinas')
  })

  it('does not flag unrelated foods for a known medication', () => {
    expect(detectDrugInteraction('Sintrom', 'Pechuga de pollo')).toBeNull()
  })

  it('does not flag a trigger food when the medication is unrelated', () => {
    expect(detectDrugInteraction('Paracetamol si hay dolor', 'Espinacas')).toBeNull()
  })

  it('does not match a medication name that only appears inside another word', () => {
    // "estatinas" no debe dispararse por una palabra que solo contenga "statin"-like text sin relación
    expect(detectDrugInteraction('Toma un antihistamínico ocasional', 'Pomelo')).toBeNull()
  })
})
