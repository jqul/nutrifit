import { describe, it, expect } from 'vitest'
import { EditableItem, EditableMeal, sumItemMacros, sumMealsMacros, scaleRecipeToKcal, demoPlanToEditable } from './planModel'
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
