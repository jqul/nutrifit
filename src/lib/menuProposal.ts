// «Proponer menú desde mis recetas»: reparte las kcal del día en comidas y elige, para cada una, una receta propia que
// encaje, escalada a las kcal que le tocan. Sin IA: solo aritmética sobre las recetas que el nutricionista ya tiene.
// Es una propuesta: el nutricionista la ve, pide otra o la aplica, y después la ajusta como cualquier plan.
import { RecipeRow } from './supabase-types'
import { EditableItem, scaleRecipeToKcal, sumItemMacros } from '../components/trainer/client-panel/plan-dieta/planModel'
import { allergenTagConflicts, detectAllergenConflict } from './allergens'
import { dislikeMatch, parseDislikes } from './foodDislikes'
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

export interface MenuOptions {
  recipes: RecipeRow[]
  targetKcal: number
  targetProteinG?: number
  allergies?: string
  /** Lo que no le gusta al cliente (texto libre): se salta la receta que lo lleve, por el nombre o por un ingrediente. */
  dislikes?: string
  slots?: MenuSlot[]
  /** 0 = la mejor propuesta; 1, 2, 3… = alternativas distintas. */
  variant?: number
}

interface DayRules {
  /** Suma a la puntuación de una receta en un hueco (más = peor). */
  penalty?: (recipeId: string, slot: MenuSlot) => number
  /** Recetas que no se pueden usar en ese hueco. */
  blocked?: (recipeId: string, slot: MenuSlot) => boolean
  /** Recetas ya usadas ese día (no se repiten en el mismo día). */
  used?: Set<string>
  /** Distingue las alternativas de cada día de la semana. */
  dayKey?: string
}

/** Arma UN día: una receta por hueco, escalada a sus kcal, sin repetir receta dentro del día. */
function buildDay(opts: MenuOptions, rules: DayRules = {}): MenuProposal {
  const { recipes, targetKcal, targetProteinG = 0, allergies = '', dislikes = '', slots = DEFAULT_SLOTS, variant = 0 } = opts
  const dislikeTerms = parseDislikes(dislikes)
  const proteinDensity = targetKcal > 0 && targetProteinG > 0 ? targetProteinG / targetKcal : 0
  const used = rules.used ?? new Set<string>()

  const meals: ProposedMeal[] = slots.map(slot => {
    const kcalTarget = Math.round(targetKcal * slot.share)
    const scored: { recipe: RecipeRow; factor: number; score: number }[] = []
    for (const recipe of recipes) {
      if (used.has(recipe.id) || !typeFits(recipe.meal_type, slot.type) || rules.blocked?.(recipe.id, slot)) continue
      const items = recipeItems(recipe)
      const totals = sumItemMacros(items)
      if (!(totals.kcal > 0) || !(kcalTarget > 0)) continue
      if (allergenTagConflicts(allergies, recipe.allergens).length > 0) continue
      if ([recipe.name, ...items.map(i => i.foodName)].some(n => detectAllergenConflict(allergies, n))) continue
      if (dislikeTerms.length > 0 && [recipe.name, ...items.map(i => i.foodName)].some(n => dislikeMatch(dislikeTerms, n))) continue
      const factor = kcalTarget / totals.kcal
      if (factor < MIN_FACTOR || factor > MAX_FACTOR) continue
      // Mejor la que tiene la proteína que pide el plan, y la que menos hay que escalar; el resto es variedad.
      const density = totals.proteinG / totals.kcal
      const proteinGap = proteinDensity > 0 ? Math.abs(density - proteinDensity) / proteinDensity : 0
      const scaleGap = Math.abs(Math.log(factor))
      const typeBonus = recipe.meal_type === slot.type ? 0 : 0.15
      const jitter = variant > 0 || rules.dayKey ? hash01(rules.dayKey ? `${variant}:${rules.dayKey}:${slot.name}:${recipe.id}` : `${variant}:${slot.name}:${recipe.id}`) * (variant > 0 ? 0.6 : 0.15) : 0
      scored.push({ recipe, factor, score: proteinGap + scaleGap * 0.5 + typeBonus + jitter + (rules.penalty?.(recipe.id, slot) ?? 0) })
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

export function proposeMenu(opts: MenuOptions): MenuProposal {
  return buildDay(opts)
}

/** Cuántas veces como máximo puede aparecer una receta en la misma semana (si hay recetas de sobra). */
export const WEEK_MAX_USES = 2

export interface WeekProposal {
  /** De lunes (0) a domingo (6), o los días que se hayan pedido. */
  days: MenuProposal[]
  distinctRecipes: number
  /** La receta que más se repite en la semana (null si ninguna se repite). */
  mostRepeated: { name: string; count: number } | null
  /** Huecos de la semana sin receta que encaje. */
  emptySlots: number
}

/**
 * Una semana entera con variedad: cada día se arma como en proposeMenu, pero una receta no pasa de `maxUses` veces en la semana,
 * no se repite en el mismo hueco dos días seguidos y las ya usadas pierden puntos frente a las nuevas. Si faltan recetas,
 * repite las que haga falta antes que dejar un hueco vacío.
 */
export function proposeWeek(opts: MenuOptions & { days?: number; maxUses?: number }): WeekProposal {
  const { days = 7, maxUses = WEEK_MAX_USES, ...base } = opts
  const usage = new Map<string, number>()
  const lastInSlot = new Map<string, string>()
  const penalty = (id: string, slot: MenuSlot) => (usage.get(id) ?? 0) * 0.8 + (lastInSlot.get(slot.name) === id ? 2 : 0)
  const result: MenuProposal[] = []

  for (let d = 0; d < days; d++) {
    const dayKey = String(d)
    const strict = buildDay(base, { dayKey, penalty, blocked: id => (usage.get(id) ?? 0) >= maxUses })
    let day = strict
    const empty = strict.meals.filter(m => !m.recipe).map(m => m.slot)
    if (empty.length > 0) {
      // Sin recetas nuevas que quepan: se permite repetir, sin repetir dentro del mismo día.
      const filled = new Set(strict.meals.flatMap(m => (m.recipe ? [m.recipe.id] : [])))
      const fallback = buildDay({ ...base, slots: empty }, { dayKey, penalty, used: filled })
      const bySlot = new Map(fallback.meals.map(m => [m.slot.name, m]))
      const meals = strict.meals.map(m => m.recipe ? m : bySlot.get(m.slot.name) ?? m)
      day = { meals, totalKcal: meals.reduce((s, m) => s + (m.recipe ? m.kcalTarget : 0), 0), totalProteinG: meals.reduce((s, m) => s + m.proteinG, 0) }
    }
    for (const m of day.meals) {
      if (!m.recipe) continue
      usage.set(m.recipe.id, (usage.get(m.recipe.id) ?? 0) + 1)
      lastInSlot.set(m.slot.name, m.recipe.id)
    }
    result.push(day)
  }

  const byId = new Map<string, { name: string; count: number }>()
  for (const day of result) for (const m of day.meals) if (m.recipe) byId.set(m.recipe.id, { name: m.recipe.name, count: (usage.get(m.recipe.id) ?? 0) })
  const repeated = [...byId.values()].sort((a, b) => b.count - a.count)[0]
  return {
    days: result,
    distinctRecipes: byId.size,
    mostRepeated: repeated && repeated.count > 1 ? repeated : null,
    emptySlots: result.reduce((s, d) => s + d.meals.filter(m => !m.recipe).length, 0),
  }
}
