import { describe, it, expect } from 'vitest'
import { proposeMenu, DEFAULT_SLOTS, MIN_FACTOR, MAX_FACTOR } from './menuProposal'
import { RecipeRow } from './supabase-types'

function recipe(id: string, name: string, kcal: number, proteinG: number, extra: Partial<RecipeRow> = {}, foodName = name): RecipeRow {
  return {
    id, nutricionista_id: 'n1', name, photo_url: null, steps: null, created_at: '',
    items: [{ id: `${id}-1`, foodName, quantity: '100', unit: 'g', kcal: String(kcal), proteinG: String(proteinG), carbsG: '10', fatG: '5', fiberG: '', sugarG: '', sodiumMg: '', saturatedFatG: '', calciumMg: '', ironMg: '', zincMg: '' }],
    ...extra,
  }
}

const library: RecipeRow[] = [
  recipe('d1', 'Bowl de avena', 500, 25, { meal_type: 'desayuno' }),
  recipe('c1', 'Pollo con arroz', 700, 55, { meal_type: 'comida' }),
  recipe('m1', 'Yogur con fruta', 200, 12, { meal_type: 'merienda' }),
  recipe('n1', 'Tortilla francesa', 600, 40, { meal_type: 'cena' }),
]

describe('proposeMenu', () => {
  it('fills each slot with a recipe of its type, scaled to the kcal that slot gets', () => {
    const p = proposeMenu({ recipes: library, targetKcal: 2000, targetProteinG: 140 })
    expect(p.meals.map(m => m.recipe?.id)).toEqual(['d1', 'c1', 'm1', 'n1'])
    expect(p.meals.map(m => m.kcalTarget)).toEqual([500, 700, 200, 600])
    expect(p.totalKcal).toBe(2000)
    for (const m of p.meals) {
      const kcal = m.items.reduce((s, i) => s + parseFloat(i.kcal), 0)
      expect(Math.abs(kcal - m.kcalTarget)).toBeLessThan(1)
      expect(m.items.every(i => i.recipeId === m.recipe!.id)).toBe(true)
    }
  })

  it('scales a recipe that is not the right size, within limits', () => {
    const p = proposeMenu({ recipes: [recipe('c2', 'Lentejas', 500, 30, { meal_type: 'comida' })], targetKcal: 1400, slots: [DEFAULT_SLOTS[1]] })
    expect(p.meals[0].recipe?.id).toBe('c2')
    expect(p.meals[0].factor).toBeCloseTo(490 / 500)
  })

  it('does not use a recipe that would need an absurd portion', () => {
    const tooSmall = recipe('x', 'Tentempié', 50, 2, { meal_type: 'comida' })
    const tooBig = recipe('y', 'Menú gigante', 3000, 90, { meal_type: 'comida' })
    const p = proposeMenu({ recipes: [tooSmall, tooBig], targetKcal: 2000, slots: [DEFAULT_SLOTS[1]] })
    expect(p.meals[0].recipe).toBeNull()
    expect(MIN_FACTOR).toBeLessThan(1)
    expect(MAX_FACTOR).toBeGreaterThan(1)
  })

  it('skips recipes that clash with the client allergies, even through an ingredient', () => {
    const withMilk = recipe('l1', 'Bowl cremoso', 500, 25, { meal_type: 'desayuno' }, 'Leche entera')
    const safe = recipe('l2', 'Tostada con aguacate', 500, 15, { meal_type: 'desayuno' })
    const p = proposeMenu({ recipes: [withMilk, safe], targetKcal: 2000, allergies: 'intolerancia a la lactosa', slots: [DEFAULT_SLOTS[0]] })
    expect(p.meals[0].recipe?.id).toBe('l2')
  })

  it('never repeats a recipe in two slots of the same day', () => {
    const untyped = recipe('u1', 'Plato único', 500, 30)
    const p = proposeMenu({ recipes: [untyped], targetKcal: 2000, slots: [DEFAULT_SLOTS[0], DEFAULT_SLOTS[3]] })
    expect(p.meals.filter(m => m.recipe).length).toBe(1)
  })

  it('lets recipes with no meal type fit anywhere, but prefers the ones typed for the slot', () => {
    const untyped = recipe('u2', 'Sin tipo', 500, 25)
    const typed = recipe('t2', 'Con tipo', 500, 25, { meal_type: 'desayuno' })
    expect(proposeMenu({ recipes: [untyped, typed], targetKcal: 2000, slots: [DEFAULT_SLOTS[0]] }).meals[0].recipe?.id).toBe('t2')
    expect(proposeMenu({ recipes: [untyped], targetKcal: 2000, slots: [DEFAULT_SLOTS[0]] }).meals[0].recipe?.id).toBe('u2')
  })

  it('accepts a snack for the afternoon slot, and not a dinner', () => {
    const snack = recipe('s1', 'Frutos secos', 200, 6, { meal_type: 'snack' })
    const dinner = recipe('s2', 'Cena ligera', 200, 6, { meal_type: 'cena' })
    expect(proposeMenu({ recipes: [snack, dinner], targetKcal: 2000, slots: [DEFAULT_SLOTS[2]] }).meals[0].recipe?.id).toBe('s1')
  })

  it('offers different proposals for different variants, and the same one for the same variant', () => {
    const many = Array.from({ length: 8 }, (_, i) => recipe(`c${i}`, `Comida ${i}`, 650 + i * 10, 45, { meal_type: 'comida' }))
    const pick = (variant: number) => proposeMenu({ recipes: many, targetKcal: 2000, targetProteinG: 140, slots: [DEFAULT_SLOTS[1]], variant }).meals[0].recipe?.id
    expect(pick(0)).toBe(pick(0))
    expect(pick(3)).toBe(pick(3))
    expect(new Set([1, 2, 3, 4, 5, 6].map(pick)).size).toBeGreaterThan(1)
  })

  it('prefers the recipe whose protein is closest to what the plan asks for', () => {
    const lean = recipe('p1', 'Alta en proteína', 700, 70, { meal_type: 'comida' })
    const poor = recipe('p2', 'Baja en proteína', 700, 15, { meal_type: 'comida' })
    const p = proposeMenu({ recipes: [poor, lean], targetKcal: 2000, targetProteinG: 200, slots: [DEFAULT_SLOTS[1]] })
    expect(p.meals[0].recipe?.id).toBe('p1')
  })

  it('returns empty slots, not a crash, with no recipes or no target', () => {
    expect(proposeMenu({ recipes: [], targetKcal: 2000 }).meals.every(m => m.recipe === null)).toBe(true)
    expect(proposeMenu({ recipes: library, targetKcal: 0 }).totalKcal).toBe(0)
  })
})
