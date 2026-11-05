import { describe, it, expect } from 'vitest'
import { hasRecipeColumns, parseMealType, parseRecipeTable, recipeDraftToRow, RECIPE_TEMPLATE, MAX_INGREDIENTS } from './recipeImport'
import { parseCSV } from './spreadsheet'
import { Food } from '../types'

const food = (name: string, kcal: number, proteinG: number, carbsG: number, fatG: number): Food =>
  ({ id: name, name, category: 'x', kcal, proteinG, carbsG, fatG })
const foods = [food('Avena', 390, 17, 66, 7), food('Plátano', 89, 1.1, 23, 0.3), food('Yogur natural', 61, 3.5, 4.7, 3.3)]

const H = ['Receta', 'Tipo', 'Etiquetas', 'Tiempo (min)', 'Raciones', 'Dieta', 'Alérgenos', 'Pasos', 'Alimento', 'Cantidad', 'Unidad', 'Kcal', 'Proteína', 'Carbohidratos', 'Grasas']
const row = (o: Partial<Record<string, string>>) => H.map(h => o[h] ?? '')

describe('parseRecipeTable — columns', () => {
  it('needs the Receta and Alimento columns, and says so when they are missing', () => {
    expect(hasRecipeColumns([['Receta', 'Alimento'], ['a', 'b']])).toBe(true)
    expect(hasRecipeColumns([['Nombre', 'Cantidad']])).toBe(false)
    const r = parseRecipeTable([['Nombre', 'Cantidad'], ['x', '1']], foods, [])
    expect(r.fatal).toContain('«Receta» y «Alimento»')
    expect(parseRecipeTable([['Receta', 'Alimento']], foods, []).fatal).toContain('ninguna fila')
  })
  it('accepts the aliases in any order, with or without accents', () => {
    const r = parseRecipeTable([['Ingrediente', 'Plato', 'Cantidad'], ['Avena', 'Gachas', '50']], foods, [])
    expect(r.fatal).toBeNull()
    expect(r.recipes[0].name).toBe('Gachas')
  })
})

describe('parseRecipeTable — grouping and fields', () => {
  const rows = [
    H,
    row({ Receta: 'Bowl de avena', Tipo: 'Desayuno', Etiquetas: 'Rápida, sin horno', 'Tiempo (min)': '5', Raciones: '1', Dieta: 'vegetariana', 'Alérgenos': 'gluten, lactosa', Pasos: '1. Mezcla.', Alimento: 'Avena', Cantidad: '50', Unidad: 'g' }),
    row({ Alimento: 'Plátano', Cantidad: '100', Unidad: 'g' }),
    row({ Receta: 'Bowl de avena', Alimento: 'Yogur natural', Cantidad: '150' }),
  ]
  const r = parseRecipeTable(rows, foods, [])

  it('groups rows by recipe name, also when the name is only in the first row or repeated', () => {
    expect(r.recipes).toHaveLength(1)
    expect(r.recipes[0].items.map(i => i.foodName)).toEqual(['Avena', 'Plátano', 'Yogur natural'])
  })
  it('reads the recipe fields from the first row that has them', () => {
    expect(r.recipes[0]).toMatchObject({ mealType: 'desayuno', tags: ['rápida', 'sin horno'], prepMinutes: 5, servings: 1, steps: '1. Mezcla.', dietTypes: ['vegetariana'], allergens: ['gluten', 'lactosa'] })
  })
  it('computes the macros of each ingredient from the catalogue (per 100 g, scaled), and defaults the unit to grams', () => {
    expect(r.recipes[0].items[0]).toMatchObject({ kcal: '195', proteinG: '8.5', carbsG: '33', fatG: '3.5', unit: 'g' })
    expect(r.recipes[0].items[2]).toMatchObject({ quantity: '150', unit: 'g', kcal: '92' })
    expect(r.recipes[0].withoutMacros).toEqual([])
  })
  it('uses the macros that come in the file as they are', () => {
    const own = parseRecipeTable([H, row({ Receta: 'Pollo', Alimento: 'Pechuga', Cantidad: '150', Kcal: '248', 'Proteína': '46,5', Carbohidratos: '0', Grasas: '5,4' })], foods, [])
    expect(own.recipes[0].items[0]).toMatchObject({ kcal: '248', proteinG: '46.5', carbsG: '0', fatG: '5.4' })
    expect(own.unmatchedFoods).toEqual([])
  })
  it('imports an unknown food without macros and says so', () => {
    const u = parseRecipeTable([H, row({ Receta: 'Rara', Alimento: 'Quinoa', Cantidad: '80' })], foods, [])
    expect(u.recipes[0].withoutMacros).toEqual(['Quinoa'])
    expect(u.unmatchedFoods).toEqual(['Quinoa'])
    expect(u.recipes[0].items[0].kcal).toBe('')
  })
  it('joins the same recipe when its rows are not together', () => {
    const j = parseRecipeTable([H, row({ Receta: 'A', Alimento: 'Avena', Cantidad: '10' }), row({ Receta: 'B', Alimento: 'Plátano', Cantidad: '10' }), row({ Receta: 'a ', Alimento: 'Yogur natural', Cantidad: '10' })], foods, [])
    expect(j.recipes.map(x => [x.name, x.items.length])).toEqual([['A', 2], ['B', 1]])
  })
})

describe('parseRecipeTable — what it refuses or reports', () => {
  it('does not duplicate a recipe you already have (any case or accent)', () => {
    const r = parseRecipeTable([H, row({ Receta: 'Bowl de AVENA', Alimento: 'Avena', Cantidad: '50' }), row({ Receta: 'Nueva', Alimento: 'Avena', Cantidad: '50' })], foods, ['bowl de avena'])
    expect(r.recipes.map(x => x.name)).toEqual(['Nueva'])
    expect(r.skippedExisting).toEqual(['Bowl de AVENA'])
  })
  it('reports a row with no recipe name and nothing before it', () => {
    const r = parseRecipeTable([H, row({ Alimento: 'Avena', Cantidad: '50' })], foods, [])
    expect(r.recipes).toEqual([])
    expect(r.problems[0]).toMatchObject({ row: 2 })
  })
  it('skips an ingredient with a bad quantity but keeps the recipe, and says which row', () => {
    const r = parseRecipeTable([H, row({ Receta: 'X', Alimento: 'Avena', Cantidad: 'un poco' }), row({ Alimento: 'Plátano', Cantidad: '100' })], foods, [])
    expect(r.recipes[0].items.map(i => i.foodName)).toEqual(['Plátano'])
    expect(r.problems.some(p => p.row === 2 && p.message.includes('cantidad'))).toBe(true)
  })
  it('does not import a recipe with no ingredient', () => {
    const r = parseRecipeTable([H, row({ Receta: 'Vacía' })], foods, [])
    expect(r.recipes).toEqual([])
    expect(r.problems[0].message).toContain('ningún ingrediente')
  })
  it('imports with a warning when type, time, servings, diet or allergen are not understood', () => {
    const r = parseRecipeTable([H, row({ Receta: 'X', Tipo: 'brunch', 'Tiempo (min)': 'rápido', Raciones: '0', Dieta: 'keto', 'Alérgenos': 'polen', Alimento: 'Avena', Cantidad: '50' })], foods, [])
    expect(r.recipes[0]).toMatchObject({ mealType: null, prepMinutes: null, servings: null, dietTypes: [], allergens: [] })
    expect(r.problems).toHaveLength(5)
  })
  it('caps the number of ingredients per recipe', () => {
    const many = Array.from({ length: MAX_INGREDIENTS + 3 }, (_, i) => row({ Receta: i === 0 ? 'Larga' : '', Alimento: 'Avena', Cantidad: '1' }))
    const r = parseRecipeTable([H, ...many], foods, [])
    expect(r.recipes[0].items).toHaveLength(MAX_INGREDIENTS)
    expect(r.problems).toHaveLength(3)
  })
  it('skips blank rows', () => {
    expect(parseRecipeTable([H, row({}), row({ Receta: 'X', Alimento: 'Avena', Cantidad: '5' }), row({})], foods, []).recipes).toHaveLength(1)
  })
})

describe('parseMealType', () => {
  it('understands the usual words', () => {
    expect(parseMealType('Almuerzo')).toBe('comida')
    expect(parseMealType('Tentempié')).toBe('snack')
    expect(parseMealType(' CENA ')).toBe('cena')
    expect(parseMealType('brunch')).toBeNull()
  })
})

describe('recipeDraftToRow and the template', () => {
  it('maps a draft to the recipes table, private by default', () => {
    const r = parseRecipeTable([H, row({ Receta: 'X', Tipo: 'cena', Alimento: 'Avena', Cantidad: '5' })], foods, [])
    const db = recipeDraftToRow(r.recipes[0], 'nutri-1')
    expect(db).toMatchObject({ nutricionista_id: 'nutri-1', name: 'X', meal_type: 'cena', in_recipe_book: false, book_tags: [], photo_url: null })
    expect(db.items).toHaveLength(1)
  })
  it('the downloadable template is read back without problems', () => {
    const r = parseRecipeTable(parseCSV(RECIPE_TEMPLATE), foods, [])
    expect(r.fatal).toBeNull()
    expect(r.recipes.map(x => x.name)).toEqual(['Bowl de avena con plátano', 'Pollo con arroz y brócoli'])
    expect(r.recipes[0]).toMatchObject({ mealType: 'desayuno', prepMinutes: 5, allergens: ['gluten', 'lactosa'] })
    expect(r.problems).toEqual([])
  })
})
