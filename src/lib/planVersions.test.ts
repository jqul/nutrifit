import { describe, it, expect } from 'vitest'
import { PlanSnapshot, SnapshotMeal, describeRestore, mealLabel, summarizeSnapshot } from './planVersions'

const item = (food_name: string, quantity = '100', unit = 'g') => ({ food_name, quantity, unit, kcal: null, protein_g: null, carbs_g: null, fat_g: null, sort_order: 0 })
const meal = (name: string, items: string[] = [], over: Partial<SnapshotMeal> = {}): SnapshotMeal => ({
  name, time: '14:00', kcal_target: null, sort_order: 0, day_of_week: null, option_label: null, items: items.map(f => item(f)), ...over,
})
const snap = (over: Partial<PlanSnapshot> = {}): PlanSnapshot => ({
  name: 'Plan', kcal_target: 1800, protein_g: 130, carbs_g: 180, fat_g: 60, fiber_g: 25, advice: 'A',
  meals: [meal('Desayuno', ['Avena']), meal('Comida', ['Pollo', 'Arroz'])], supplements: [], ...over,
})

describe('mealLabel', () => {
  it('adds the day and the option when there are any', () => {
    expect(mealLabel(meal('Cena'))).toBe('Cena')
    expect(mealLabel(meal('Cena', [], { day_of_week: 1 }))).toBe('Cena · martes')
    expect(mealLabel(meal('Cena', [], { day_of_week: 6, option_label: 'Opción B' }))).toBe('Cena · domingo · Opción B')
  })
})

describe('summarizeSnapshot', () => {
  it('counts meals, foods and supplements', () => {
    const s = summarizeSnapshot(snap({ supplements: [{ name: 'Creatina', dose: '5g', timing: 'x', visible_to_client: true }] }))
    expect(s).toMatchObject({ kcal: 1800, proteinG: 130, meals: 2, items: 3, supplements: 1 })
  })
})

describe('describeRestore', () => {
  it('says nothing when the plans are identical', () => {
    expect(describeRestore(snap(), snap())).toEqual([])
  })

  it('lists target changes from the current plan to the version being restored', () => {
    const lines = describeRestore(snap({ kcal_target: 1600, protein_g: 140 }), snap())
    expect(lines).toContain('Kcal: 1600 → 1800')
    expect(lines).toContain('Proteína: 140 → 130 g')
  })

  it('lists meals that come back, disappear or change their foods', () => {
    const current = snap({ meals: [meal('Desayuno', ['Avena']), meal('Cena', ['Salmón']), meal('Comida', ['Pollo', 'Pasta'])] })
    const target = snap({ meals: [meal('Desayuno', ['Avena']), meal('Merienda', ['Fruta']), meal('Comida', ['Pollo', 'Arroz'])] })
    const lines = describeRestore(current, target)
    expect(lines).toContain('Vuelven las comidas: Merienda')
    expect(lines).toContain('Dejan de estar las comidas: Cena')
    expect(lines).toContain('Alimentos distintos en: Comida')
  })

  it('tells apart the same meal on different days', () => {
    const current = snap({ meals: [meal('Cena', ['Pollo'], { day_of_week: 0 })] })
    const target = snap({ meals: [meal('Cena', ['Pollo'], { day_of_week: 1 })] })
    const lines = describeRestore(current, target)
    expect(lines).toContain('Vuelven las comidas: Cena · martes')
    expect(lines).toContain('Dejan de estar las comidas: Cena · lunes')
  })

  it('lists supplements that come back or go away', () => {
    const creatina = { name: 'Creatina', dose: '5g', timing: 'x', visible_to_client: true }
    const omega = { name: 'Omega 3', dose: '1', timing: 'y', visible_to_client: true }
    const lines = describeRestore(snap({ supplements: [omega] }), snap({ supplements: [creatina] }))
    expect(lines).toContain('Vuelven los suplementos: Creatina')
    expect(lines).toContain('Dejan de estar los suplementos: Omega 3')
  })
})
