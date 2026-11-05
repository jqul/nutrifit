// «Proponer menú desde mis recetas»: reparte las kcal del día en comidas y elige, para cada una, una receta propia que
// encaje, escalada a las kcal que le tocan. Sin IA: solo aritmética sobre las recetas que el nutricionista ya tiene.
// Es una propuesta: el nutricionista la ve, pide otra o la aplica, y después la ajusta como cualquier plan.
import { RecipeRow } from './supabase-types'
import { EditableItem, scaleRecipeToKcal, sumItemMacros } from '../components/trainer/client-panel/plan-dieta/planModel'
import { allergenTagConflicts, detectAllergenConflict } from './allergens'
import { MealType } from './recipeMeta'

export interface MenuSlot { name: string; time: string; share: number; type: MealType }

/** Un día típico: el reparto de kcal entre comidas que suele usarse. */
export const DEFAULT_SLOTS: MenuSlot[] = [
  { name: 'Desayuno', time: '08:00', share: 0.25, type: 'desayuno' },
  { name: 'Comida', time: '14:00', share: 0.35, type: 'comida' },
  { name: 'Merienda', time: '17:30', share: 0.10, type: 'merienda' },
  { name: 'Cena', time: '21:00', share: 0.30, type: 'cena' },
]

/** Una receta cabe en un hueco si hay que multiplicarla por un factor razonable (ni una ración ridícula ni un atracón). */
export const MIN_FACTOR = 0.5
export const MAX_FACTOR = 2

export interface ProposedMeal {
  slot: MenuSlot
  kcalTarget: number
  recipe: RecipeRow | null
  /** Ingredientes ya escalados a kcalTarget (vacío si no hay receta). */
  items: EditableItem[]
  factor: number
  proteinG: number
}

export interface MenuProposal {
  meals: ProposedMeal[]
  totalKcal: number
  totalProteinG: number
}

/** ¿Una receta de este tipo vale para este hueco? Las que no tienen tipo valen para cualquiera; el snack vale como merienda. */
function typeFits(recipeType: string | null | undefined, slot: MealType): boolean {
  if (!recipeType) return true
  if (recipeType === slot) return true
  return slot === 'merienda' && recipeType === 'snack'
}

/** Número estable entre 0 y 1 a partir de un texto (FNV-1a): da variedad a las propuestas sin que cambien al repintar. */
function hash01(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}

function recipeItems(r: RecipeRow): EditableItem[] {
  return (r.items as EditableItem[] | null) || []
}

export function proposeMenu(opts: {
  recipes: RecipeRow[]
  targetKcal: number
  targetProteinG?: number
  allergies?: string
  slots?: MenuSlot[]
  /** 0 = la mejor propuesta; 1, 2, 3… = alternativas distintas. */
  variant?: number
}): MenuProposal {
  const { recipes, targetKcal, targetProteinG = 0, allergies = '', slots = DEFAULT_SLOTS, variant = 0 } = opts
  const proteinDensity = targetKcal > 0 && targetProteinG > 0 ? targetProteinG / targetKcal : 0
  const used = new Set<string>()

  const meals: ProposedMeal[] = slots.map(slot => {
    const kcalTarget = Math.round(targetKcal * slot.share)
    const scored: { recipe: RecipeRow; factor: number; score: number }[] = []
    for (const recipe of recipes) {
      if (used.has(recipe.id) || !typeFits(recipe.meal_type, slot.type)) continue
      const items = recipeItems(recipe)
      const totals = sumItemMacros(items)
      if (!(totals.kcal > 0) || !(kcalTarget > 0)) continue
      if (allergenTagConflicts(allergies, recipe.allergens).length > 0) continue
      if ([recipe.name, ...items.map(i => i.foodName)].some(n => detectAllergenConflict(allergies, n))) continue
      const factor = kcalTarget / totals.kcal
      if (factor < MIN_FACTOR || factor > MAX_FACTOR) continue
      // Mejor la que tiene la proteína que pide el plan, y la que menos hay que escalar; el resto es variedad.
      const density = totals.proteinG / totals.kcal
      const proteinGap = proteinDensity > 0 ? Math.abs(density - proteinDensity) / proteinDensity : 0
      const scaleGap = Math.abs(Math.log(factor))
      const typeBonus = recipe.meal_type === slot.type ? 0 : 0.15
      const jitter = variant > 0 ? hash01(`${variant}:${slot.name}:${recipe.id}`) * 0.6 : 0
      scored.push({ recipe, factor, score: proteinGap + scaleGap * 0.5 + typeBonus + jitter })
    }
    scored.sort((a, b) => a.score - b.score)
    const best = scored[0]
    if (!best) return { slot, kcalTarget, recipe: null, items: [], factor: 0, proteinG: 0 }
    used.add(best.recipe.id)
    const items = scaleRecipeToKcal(recipeItems(best.recipe), kcalTarget).map(i => ({ ...i, recipeId: best.recipe.id }))
    return { slot, kcalTarget, recipe: best.recipe, items, factor: best.factor, proteinG: sumItemMacros(items).proteinG }
  })

  return {
    meals,
    totalKcal: meals.reduce((s, m) => s + (m.recipe ? m.kcalTarget : 0), 0),
    totalProteinG: meals.reduce((s, m) => s + m.proteinG, 0),
  }
}
