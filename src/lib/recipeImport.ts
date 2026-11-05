// Importar recetas de golpe desde una hoja de cálculo (.csv/.xlsx) o pegando una tabla. Una FILA POR INGREDIENTE: la receta se
// agrupa por su nombre, así que el nombre puede repetirse en cada fila o escribirse solo en la primera (celdas combinadas).
// Los datos de la receta (tipo, etiquetas, tiempo, raciones, pasos…) se leen de la primera fila que los traiga.
// Las kcal y macros de cada ingrediente, si no vienen en el archivo, se calculan con el alimento del catálogo (por 100 g).
import { Food } from '../types'
import { detectColumns, stripAccents } from './spreadsheet'
import { computeMacros } from './foodConversion'
import { DIET_TYPES, MEAL_TYPES, MealType, parsePrepMinutes, parseTags } from './recipeMeta'
import { ALLERGEN_IDS, ALLERGEN_LABELS } from './allergens'
import { EditableRecipeItem } from '../components/shared/RecipeEditorPanel'

export const MAX_IMPORT_RECIPES = 500
export const MAX_INGREDIENTS = 60
const MAX_NAME = 120
const MAX_STEPS = 6000

export type RecipeField =
  'recipe' | 'mealType' | 'tags' | 'prepMinutes' | 'servings' | 'diet' | 'allergens' | 'steps' | 'food' | 'quantity' | 'unit' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG'

export const RECIPE_HEADER_ALIASES: Record<RecipeField, string[]> = {
  recipe: ['receta', 'nombre', 'nombre receta', 'nombre de la receta', 'plato', 'recipe', 'name'],
  mealType: ['tipo', 'tipo de comida', 'comida', 'momento', 'categoria', 'meal type', 'type'],
  tags: ['etiquetas', 'etiqueta', 'tags'],
  prepMinutes: ['tiempo', 'minutos', 'tiempo (min)', 'tiempo de preparacion', 'preparacion (min)', 'prep', 'prep time'],
  servings: ['raciones', 'porciones', 'comensales', 'servings'],
  diet: ['dieta', 'tipo de dieta', 'diet'],
  allergens: ['alergenos', 'contiene', 'allergens'],
  steps: ['pasos', 'preparacion', 'elaboracion', 'instrucciones', 'steps', 'instructions'],
  food: ['alimento', 'ingrediente', 'food', 'ingredient'],
  quantity: ['cantidad', 'cant', 'cant.', 'quantity', 'qty'],
  unit: ['unidad', 'unit'],
  kcal: ['kcal', 'calorias', 'calories'],
  proteinG: ['proteina', 'proteinas', 'protein', 'proteina (g)', 'proteinas (g)', 'protein (g)'],
  carbsG: ['carbohidratos', 'carbos', 'carbs', 'carbohydrates', 'carbohidratos (g)', 'carbs (g)'],
  fatG: ['grasas', 'grasa', 'fat', 'fats', 'grasas (g)', 'fat (g)'],
}

export interface RecipeDraft {
  name: string
  mealType: MealType | null
  tags: string[]
  prepMinutes: number | null
  servings: number | null
  steps: string | null
  dietTypes: string[]
  allergens: string[]
  items: EditableRecipeItem[]
  /** Ingredientes que se quedan sin kcal ni macros (no están en el catálogo y el archivo no los traía). */
  withoutMacros: string[]
}

export interface RecipeImportProblem { /** Fila del archivo (la 1 es la de cabeceras). */ row: number; message: string }

export interface RecipeImportResult {
  recipes: RecipeDraft[]
  /** Recetas que ya tenías con ese nombre: no se duplican. */
  skippedExisting: string[]
  problems: RecipeImportProblem[]
  /** Alimentos que no están en el catálogo (para avisar de que se importan sin valores). */
  unmatchedFoods: string[]
  /** Recetas que sobran por pasar del máximo permitido. */
  overLimit: number
  /** null si la tabla es válida; si no, qué falta. */
  fatal: string | null
}

const fold = (s: string) => stripAccents(s.trim().toLowerCase()).replace(/\s+/g, ' ')
const num = (s: string): number | null => {
  const clean = s.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(clean)) return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}
const numText = (s: string): string => { const n = num(s); return n == null ? '' : String(n) }

const MEAL_ALIASES: Record<string, MealType> = {
  desayuno: 'desayuno', almuerzo: 'comida', comida: 'comida', merienda: 'merienda', cena: 'cena',
  snack: 'snack', tentempie: 'snack', aperitivo: 'snack', picoteo: 'snack',
}
export function parseMealType(text: string): MealType | null {
  return MEAL_ALIASES[fold(text)] ?? (MEAL_TYPES.find(m => m.id === fold(text))?.id ?? null)
}

function parseList<T extends string>(text: string, valid: readonly T[], labelOf: (v: T) => string): { found: T[]; unknown: string[] } {
  const found: T[] = [], unknown: string[] = []
  for (const part of text.split(/[,;/\n]/).map(p => p.trim()).filter(Boolean)) {
    const hit = valid.find(v => fold(v) === fold(part) || fold(labelOf(v)) === fold(part))
    if (hit) { if (!found.includes(hit)) found.push(hit) } else unknown.push(part)
  }
  return { found, unknown }
}

/** ¿Tiene la tabla las dos columnas imprescindibles (Receta y Alimento)? */
export function hasRecipeColumns(rows: string[][]): boolean {
  if (rows.length === 0) return false
  const cols = detectColumns(rows[0], RECIPE_HEADER_ALIASES)
  return cols.recipe != null && cols.food != null
}

/**
 * Convierte la tabla en recetas listas para guardar. No lanza: lo que no se entiende se devuelve en `problems` y el resto se
 * importa igualmente.
 */
export function parseRecipeTable(rows: string[][], foods: Food[], existingNames: string[]): RecipeImportResult {
  const empty: RecipeImportResult = { recipes: [], skippedExisting: [], problems: [], unmatchedFoods: [], overLimit: 0, fatal: null }
  if (rows.length < 2) return { ...empty, fatal: 'No hay ninguna fila con datos debajo de las cabeceras.' }
  const cols = detectColumns(rows[0], RECIPE_HEADER_ALIASES)
  if (cols.recipe == null || cols.food == null) return { ...empty, fatal: 'No encuentro las columnas «Receta» y «Alimento» en la primera fila. Revisa las cabeceras o usa la plantilla.' }
  const get = (r: string[], f: RecipeField) => cols[f] != null ? (r[cols[f]!] ?? '').trim() : ''

  const foodByName = new Map<string, Food>()
  for (const f of foods) if (!foodByName.has(fold(f.name))) foodByName.set(fold(f.name), f)
  const existing = new Set(existingNames.map(fold))

  const problems: RecipeImportProblem[] = []
  const unmatched = new Set<string>()
  const order: string[] = []
  const byKey = new Map<string, RecipeDraft & { _row: number }>()
  let current: (RecipeDraft & { _row: number }) | null = null

  rows.slice(1).forEach((r, i) => {
    const rowNumber = i + 2
    if (!r.some(c => (c ?? '').trim() !== '')) return
    const name = get(r, 'recipe').replace(/\s+/g, ' ').slice(0, MAX_NAME + 1)
    if (name.length > MAX_NAME) { problems.push({ row: rowNumber, message: `El nombre de la receta es demasiado largo (máximo ${MAX_NAME} letras).` }); return }

    let draft = current
    if (name) {
      const key = fold(name)
      draft = byKey.get(key) ?? null
      if (!draft) {
        draft = { name, mealType: null, tags: [], prepMinutes: null, servings: null, steps: null, dietTypes: [], allergens: [], items: [], withoutMacros: [], _row: rowNumber }
        byKey.set(key, draft); order.push(key)
      }
      current = draft
    } else if (!draft) {
      problems.push({ row: rowNumber, message: 'Esta fila no tiene nombre de receta y no hay una receta anterior a la que sumarla.' }); return
    }

    // Datos de la receta: se toman de la primera fila que los traiga.
    const mealRaw = get(r, 'mealType')
    if (mealRaw && !draft.mealType) {
      const mt = parseMealType(mealRaw)
      if (mt) draft.mealType = mt
      else problems.push({ row: rowNumber, message: `«${mealRaw}» no es un tipo de comida conocido (desayuno, comida, merienda, cena o snack): la receta se importa sin tipo.` })
    }
    const tagsRaw = get(r, 'tags'); if (tagsRaw && draft.tags.length === 0) draft.tags = parseTags(tagsRaw)
    const prepRaw = get(r, 'prepMinutes')
    if (prepRaw && draft.prepMinutes == null) {
      const p = parsePrepMinutes(prepRaw)
      if (p != null) draft.prepMinutes = p; else problems.push({ row: rowNumber, message: `«${prepRaw}» no es un tiempo válido (minutos, de 1 a 1440): se ignora.` })
    }
    const servRaw = get(r, 'servings')
    if (servRaw && draft.servings == null) {
      const s = num(servRaw)
      if (s != null && Number.isInteger(s) && s >= 1 && s <= 50) draft.servings = s
      else problems.push({ row: rowNumber, message: `«${servRaw}» no es un número de raciones válido (1 a 50): se ignora.` })
    }
    const dietRaw = get(r, 'diet')
    if (dietRaw && draft.dietTypes.length === 0) {
      const { found, unknown } = parseList(dietRaw, DIET_TYPES, v => v)
      draft.dietTypes = found
      if (unknown.length) problems.push({ row: rowNumber, message: `Tipo de dieta desconocido: ${unknown.join(', ')} (valen: ${DIET_TYPES.join(', ')}).` })
    }
    const allergRaw = get(r, 'allergens')
    if (allergRaw && draft.allergens.length === 0) {
      const { found, unknown } = parseList(allergRaw, ALLERGEN_IDS as readonly string[], v => ALLERGEN_LABELS[v] ?? v)
      draft.allergens = found
      if (unknown.length) problems.push({ row: rowNumber, message: `Alérgeno desconocido: ${unknown.join(', ')} (valen: ${Object.values(ALLERGEN_LABELS).join(', ').toLowerCase()}).` })
    }
    const stepsRaw = get(r, 'steps'); if (stepsRaw && !draft.steps) draft.steps = stepsRaw.slice(0, MAX_STEPS)

    // Ingrediente de la fila.
    const foodName = get(r, 'food')
    if (!foodName) return
    if (draft.items.length >= MAX_INGREDIENTS) { problems.push({ row: rowNumber, message: `«${draft.name}» pasa de ${MAX_INGREDIENTS} ingredientes: se ignora este.` }); return }
    const qtyRaw = get(r, 'quantity')
    const quantity = qtyRaw ? num(qtyRaw) : null
    if (qtyRaw && (quantity == null || quantity <= 0)) { problems.push({ row: rowNumber, message: `«${qtyRaw}» no es una cantidad válida para «${foodName}»: se ignora el ingrediente.` }); return }
    const unit = get(r, 'unit') || 'g'

    let kcal = numText(get(r, 'kcal')), proteinG = numText(get(r, 'proteinG')), carbsG = numText(get(r, 'carbsG')), fatG = numText(get(r, 'fatG'))
    let fiberG = '', sugarG = '', sodiumMg = '', saturatedFatG = '', calciumMg = '', ironMg = '', zincMg = ''
    if (!kcal && !proteinG && !carbsG && !fatG) {
      const match = foodByName.get(fold(foodName))
      const computed = match && quantity ? computeMacros(match, quantity, unit) : null
      if (computed) {
        kcal = String(computed.kcal); proteinG = String(computed.proteinG); carbsG = String(computed.carbsG); fatG = String(computed.fatG)
        const opt = (v: number | null) => v == null ? '' : String(Math.round(v * 10) / 10)
        fiberG = opt(computed.fiberG); sugarG = opt(computed.sugarG); sodiumMg = opt(computed.sodiumMg); saturatedFatG = opt(computed.saturatedFatG)
        calciumMg = opt(computed.calciumMg); ironMg = opt(computed.ironMg); zincMg = opt(computed.zincMg)
      } else {
        draft.withoutMacros.push(foodName)
        if (!match) unmatched.add(foodName)
      }
    }
    draft.items.push({
      id: crypto.randomUUID(), foodName, quantity: quantity != null ? String(quantity) : '1', unit,
      kcal, proteinG, carbsG, fatG, fiberG, sugarG, sodiumMg, saturatedFatG, calciumMg, ironMg, zincMg,
    })
  })

  const recipes: RecipeDraft[] = []
  const skippedExisting: string[] = []
  let overLimit = 0
  for (const key of order) {
    const d = byKey.get(key)!
    const { _row, ...draft } = d
    if (draft.items.length === 0) { problems.push({ row: _row, message: `«${draft.name}» no tiene ningún ingrediente: no se importa.` }); continue }
    if (existing.has(key)) { skippedExisting.push(draft.name); continue }
    if (recipes.length >= MAX_IMPORT_RECIPES) { overLimit++; continue }
    recipes.push(draft)
  }
  return { recipes, skippedExisting, problems, unmatchedFoods: [...unmatched], overLimit, fatal: null }
}

/** La fila de la tabla `recipes` de una receta importada. */
export function recipeDraftToRow(d: RecipeDraft, nutricionistaId: string) {
  return {
    nutricionista_id: nutricionistaId, name: d.name, items: d.items, steps: d.steps, photo_url: null,
    meal_type: d.mealType, tags: d.tags, prep_minutes: d.prepMinutes, servings: d.servings,
    diet_types: d.dietTypes, allergens: d.allergens, in_recipe_book: false, book_tags: [] as string[],
  }
}

export const RECIPE_TEMPLATE =
  'Receta;Tipo;Etiquetas;Tiempo (min);Raciones;Dieta;Alérgenos;Pasos;Alimento;Cantidad;Unidad;Kcal;Proteína;Carbohidratos;Grasas\n' +
  'Bowl de avena con plátano;desayuno;rápida, sin horno;5;1;vegetariana;gluten, lactosa;1. Mezcla la avena con el yogur. 2. Añade el plátano y las almendras.;Avena;50;g;;;;\n' +
  ';;;;;;;;Plátano;100;g;;;;\n' +
  ';;;;;;;;Yogur natural;150;g;;;;\n' +
  'Pollo con arroz y brócoli;comida;batch cooking;30;2;;;1. Cuece el arroz. 2. Dora el pollo. 3. Añade el brócoli.;Pechuga de pollo;150;g;248;46,5;0;5,4\n' +
  ';;;;;;;;Arroz integral (cocido);150;g;167;3,9;34,5;1,4\n'
