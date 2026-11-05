import { describe, it, expect } from 'vitest'
import { proposeMenu, proposeWeek, DEFAULT_SLOTS, MIN_FACTOR, MAX_FACTOR } from './menuProposal'
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

  it('skips a recipe whose allergen tag clashes with the client, even if no ingredient gives it away', () => {
    const tagged = recipe('a1', 'Bowl cremoso', 500, 25, { meal_type: 'desayuno', allergens: ['lactosa'] })
    const safe = recipe('a2', 'Tostada con aguacate', 500, 15, { meal_type: 'desayuno', allergens: ['gluten'] })
    const lactose = proposeMenu({ recipes: [tagged, safe], targetKcal: 2000, allergies: 'Intolerancia a la lactosa', slots: [DEFAULT_SLOTS[0]] })
    expect(lactose.meals[0].recipe?.id).toBe('a2')
    const none = proposeMenu({ recipes: [tagged], targetKcal: 2000, allergies: 'celíaco', slots: [DEFAULT_SLOTS[0]] })
    expect(none.meals[0].recipe?.id).toBe('a1')
  })

  it('skips a recipe with something the client does not like, by name or by ingredient', () => {
    const fish = recipe('f1', 'Salmón al horno', 500, 35, { meal_type: 'comida' })
    const withMushrooms = recipe('f2', 'Arroz salteado', 500, 20, { meal_type: 'comida' }, 'Setas')
    const fine = recipe('f3', 'Pollo con arroz', 500, 30, { meal_type: 'comida' })
    const p = proposeMenu({ recipes: [fish, withMushrooms, fine], targetKcal: 1429, dislikes: 'salmón, seta', slots: [DEFAULT_SLOTS[1]] })
    expect(p.meals[0].recipe?.id).toBe('f3')
    expect(proposeMenu({ recipes: [fish], targetKcal: 1429, dislikes: 'salmon', slots: [DEFAULT_SLOTS[1]] }).meals[0].recipe).toBeNull()
    expect(proposeMenu({ recipes: [fish], targetKcal: 1429, slots: [DEFAULT_SLOTS[1]] }).meals[0].recipe?.id).toBe('f1')
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

describe('proposeWeek', () => {
  const many = (type: 'desayuno' | 'comida' | 'merienda' | 'cena', kcal: number, n: number) =>
    Array.from({ length: n }, (_, i) => recipe(`${type.slice(0, 3)}${i}`, `${type} ${i}`, kcal + i * 5, 30, { meal_type: type }))
  const rich = [...many('desayuno', 500, 6), ...many('comida', 700, 6), ...many('merienda', 200, 6), ...many('cena', 600, 6)]
  const idsOf = (w: ReturnType<typeof proposeWeek>, slot: string) => w.days.map(d => d.meals.find(m => m.slot.name === slot)?.recipe?.id)

  it('fills seven days with every slot, and keeps the day total on target', () => {
    const w = proposeWeek({ recipes: rich, targetKcal: 2000, targetProteinG: 140 })
    expect(w.days).toHaveLength(7)
    expect(w.emptySlots).toBe(0)
    expect(w.days.every(d => d.totalKcal === 2000)).toBe(true)
  })

  it('does not repeat a recipe more than twice in the week, nor in the same slot two days in a row', () => {
    const w = proposeWeek({ recipes: rich, targetKcal: 2000, targetProteinG: 140 })
    const counts = new Map<string, number>()
    for (const d of w.days) for (const m of d.meals) if (m.recipe) counts.set(m.recipe.id, (counts.get(m.recipe.id) ?? 0) + 1)
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2)
    for (const slot of ['Desayuno', 'Comida', 'Merienda', 'Cena']) {
      const ids = idsOf(w, slot)
      ids.slice(1).forEach((id, i) => expect(id).not.toBe(ids[i]))
    }
    expect(w.distinctRecipes).toBeGreaterThanOrEqual(14)
  })

  it('never repeats a recipe inside the same day', () => {
    const untyped = Array.from({ length: 5 }, (_, i) => recipe(`u${i}`, `Plato ${i}`, 500, 25))
    const w = proposeWeek({ recipes: untyped, targetKcal: 2000 })
    for (const d of w.days) {
      const ids = d.meals.flatMap(m => (m.recipe ? [m.recipe.id] : []))
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('repeats recipes rather than leaving a slot empty when there are few', () => {
    const w = proposeWeek({ recipes: [recipe('c1', 'Pollo con arroz', 700, 55, { meal_type: 'comida' })], targetKcal: 2000, slots: [DEFAULT_SLOTS[1]] })
    expect(w.emptySlots).toBe(0)
    expect(w.distinctRecipes).toBe(1)
    expect(w.mostRepeated).toEqual({ name: 'Pollo con arroz', count: 7 })
  })

  it('respects allergies and dislikes every day of the week', () => {
    const recipes = [
      recipe('l1', 'Bowl cremoso', 500, 25, { meal_type: 'desayuno', allergens: ['lactosa'] }),
      recipe('p1', 'Salmón al horno', 700, 40, { meal_type: 'comida' }),
      ...many('desayuno', 500, 3), ...many('comida', 700, 3),
    ]
    const w = proposeWeek({ recipes, targetKcal: 2000, allergies: 'intolerancia a la lactosa', dislikes: 'salmón', slots: [DEFAULT_SLOTS[0], DEFAULT_SLOTS[1]] })
    const used = new Set(w.days.flatMap(d => d.meals.map(m => m.recipe?.id)))
    expect(used.has('l1')).toBe(false)
    expect(used.has('p1')).toBe(false)
  })

  it('is stable for the same options and different for another variant', () => {
    const a = proposeWeek({ recipes: rich, targetKcal: 2000 })
    const b = proposeWeek({ recipes: rich, targetKcal: 2000 })
    const c = proposeWeek({ recipes: rich, targetKcal: 2000, variant: 3 })
    const sig = (w: typeof a) => w.days.map(d => d.meals.map(m => m.recipe?.id).join(',')).join('|')
    expect(sig(a)).toBe(sig(b))
    expect(sig(c)).not.toBe(sig(a))
  })

  it('reports empty slots when nothing fits', () => {
    const w = proposeWeek({ recipes: [], targetKcal: 2000 })
    expect(w.emptySlots).toBe(28)
    expect(w.distinctRecipes).toBe(0)
    expect(w.mostRepeated).toBeNull()
  })

  it('supports a shorter span', () => {
    expect(proposeWeek({ recipes: rich, targetKcal: 2000, days: 3 }).days).toHaveLength(3)
  })
})
