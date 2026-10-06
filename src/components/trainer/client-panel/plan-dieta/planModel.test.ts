import { describe, it, expect } from 'vitest'
import { EditableItem, EditableMeal, sumItemMacros, sumMealsMacros, scaleRecipeToKcal, scaleItemToQuantity, applyFitToMeals, demoPlanToEditable } from './planModel'
import { DEMO_DIET_PLANS } from '../../../../lib/demo-data'

const item = (over: Partial<EditableItem> = {}): EditableItem => ({
  id: 'i', foodName: 'x', quantity: '100', unit: 'g', kcal: '', proteinG: '', carbsG: '', fatG: '',
  fiberG: '', sugarG: '', sodiumMg: '', saturatedFatG: '', calciumMg: '', ironMg: '', zincMg: '', ...over,
})
const meal = (items: EditableItem[]): EditableMeal => ({
  id: 'm', name: 'Comida', time: '', kcalTarget: '', dayOfWeek: null, optionGroup: null, optionLabel: null, dayType: null, items,
})

describe('sumItemMacros', () => {
  it('sums every macro and treats empty or invalid values as 0', () => {
    const r = sumItemMacros([
      item({ kcal: '200', proteinG: '20', carbsG: '10', fatG: '5', fiberG: '2' }),
      item({ kcal: '100', proteinG: 'abc', carbsG: '', fatG: '1.5', fiberG: '' }),
    ])
    expect(r).toEqual({ kcal: 300, proteinG: 20, carbsG: 10, fatG: 6.5, fiberG: 2 })
  })

  it('returns zeros for no items', () => {
    expect(sumItemMacros([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
  })
})

describe('sumMealsMacros', () => {
  it('adds up the totals of several meals', () => {
    const r = sumMealsMacros([meal([item({ kcal: '300', proteinG: '30' })]), meal([item({ kcal: '500', proteinG: '10' })])])
    expect(r.kcal).toBe(800)
    expect(r.proteinG).toBe(40)
  })
})

describe('scaleRecipeToKcal', () => {
  it('scales quantity and macros by the same factor, keeping proportions', () => {
    const base = [item({ quantity: '100', kcal: '200', proteinG: '20' }), item({ quantity: '50', kcal: '100', proteinG: '5' })]
    const scaled = scaleRecipeToKcal(base, 600) // 300 kcal -> 600 kcal: factor 2
    expect(scaled.map(i => i.quantity)).toEqual(['200', '100'])
    expect(sumItemMacros(scaled).kcal).toBe(600)
    expect(sumItemMacros(scaled).proteinG).toBe(50)
  })

  it('gives every scaled item a fresh id and does not touch the originals', () => {
    const base = [item({ id: 'orig', kcal: '100' })]
    const scaled = scaleRecipeToKcal(base, 200)
    expect(scaled[0].id).not.toBe('orig')
    expect(base[0].kcal).toBe('100')
  })

  it('returns plain copies with new ids when the recipe has no kcal to scale from', () => {
    const scaled = scaleRecipeToKcal([item({ id: 'a', kcal: '' })], 500)
    expect(scaled).toHaveLength(1)
    expect(scaled[0].id).not.toBe('a')
  })
})

describe('scaleItemToQuantity', () => {
  it('changes the quantity and scales every value by the same proportion', () => {
    const r = scaleItemToQuantity(item({ quantity: '200', kcal: '330', proteinG: '62', carbsG: '0', fatG: '7.2', fiberG: '', calciumMg: '20' }), 150)
    expect(r.quantity).toBe('150')
    expect(r.kcal).toBe('247.5')
    expect(r.proteinG).toBe('46.5')
    expect(r.fatG).toBe('5.4')
    expect(r.calciumMg).toBe('15')
    expect(r.fiberG).toBe('')   // lo vacío sigue vacío
  })

  it('does not change an item without a numeric quantity', () => {
    const it = item({ quantity: 'al gusto', kcal: '50' })
    expect(scaleItemToQuantity(it, 10)).toBe(it)
  })

  it('does not mutate the original', () => {
    const it = item({ quantity: '100', kcal: '100' })
    scaleItemToQuantity(it, 50)
    expect(it.kcal).toBe('100')
  })
})

describe('applyFitToMeals', () => {
  const a = item({ id: 'a', quantity: '100', kcal: '200' })
  const b = item({ id: 'b', quantity: '50', kcal: '100' })
  const meals: EditableMeal[] = [
    { ...meal([a, b]), id: 'm1', kcalTarget: '300' },
    { ...meal([item({ id: 'c', quantity: '10', kcal: '90' })]), id: 'm2', kcalTarget: '' },
  ]

  it('rescales the foods that change and follows with the meal target', () => {
    const r = applyFitToMeals(meals, { quantities: { a: 80 }, mealFactors: { m1: 0.9 } })
    expect(r[0].items[0].quantity).toBe('80')
    expect(r[0].items[0].kcal).toBe('160')
    expect(r[0].items[1]).toBe(b)               // el que no cambia, el mismo objeto
    expect(r[0].kcalTarget).toBe('270')
  })

  it('leaves untouched meals as they were', () => {
    const r = applyFitToMeals(meals, { quantities: { a: 80 }, mealFactors: { m1: 0.9 } })
    expect(r[1]).toBe(meals[1])
  })

  it('does not invent a target for a meal that had none', () => {
    const r = applyFitToMeals(meals, { quantities: { c: 8 }, mealFactors: { m2: 0.8 } })
    expect(r[1].kcalTarget).toBe('')
    expect(r[1].items[0].quantity).toBe('8')
  })

  it('does not mutate the originals', () => {
    applyFitToMeals(meals, { quantities: { a: 80 }, mealFactors: { m1: 0.9 } })
    expect(meals[0].items[0].quantity).toBe('100')
    expect(meals[0].kcalTarget).toBe('300')
  })
})

describe('demoPlanToEditable', () => {
  it('turns a demo plan into editor strings, keeping meals and items', () => {
    const plan = DEMO_DIET_PLANS['demo-client-001']
    const e = demoPlanToEditable(plan)
    expect(e.kcalTarget).toBe(String(plan.kcalTarget))
    expect(e.meals).toHaveLength(plan.meals.length)
    expect(e.meals[0].items[0].foodName).toBe(plan.meals[0].items[0].foodName)
    expect(e.supplements).toHaveLength(plan.supplements.length)
  })
})
