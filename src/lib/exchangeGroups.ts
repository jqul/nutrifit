// Grupos de intercambio: alimentos que cumplen el mismo papel en una dieta y se
// pueden cambiar entre sí por raciones equivalentes (pollo ↔ pavo ↔ pescado,
// arroz ↔ pasta ↔ patata, manzana ↔ pera…). Cada grupo se mide por UN nutriente
// clave, y una "ración" es una cantidad fija de él: así "150 g de pollo = 1,5
// raciones de proteína animal = 180 g de merluza" sin comparar peras con manzanas.
//
// Los tamaños de ración son una convención práctica de la app (un filete, un
// vaso, una pieza de fruta, una cucharada de aceite), no una tabla oficial: están
// aquí juntos para poder ajustarlos en un solo sitio.
import { Food } from '../types'
import { MacroKey, gramsForAbsoluteMacro, rankSubstitutesByMacros } from './foodConversion'
import { detectAllergenConflict } from './allergens'

export type ExchangeGroupId =
  | 'proteina_animal' | 'proteina_vegetal' | 'legumbres' | 'cereales' | 'fruta' | 'verdura' | 'lacteos' | 'bebidas_vegetales' | 'grasas'

export type Ration = { basis: 'macro'; key: MacroKey; amount: number } | { basis: 'grams'; grams: number }

export interface ExchangeGroup {
  id: ExchangeGroupId
  label: string
  /** Qué es una ración, para explicarlo al usuario. */
  rationText: string
  ration: Ration
}

export const EXCHANGE_GROUPS: Record<ExchangeGroupId, ExchangeGroup> = {
  proteina_animal: { id: 'proteina_animal', label: 'Carnes, pescados y huevos', rationText: '20 g de proteína (un filete mediano)', ration: { basis: 'macro', key: 'proteinG', amount: 20 } },
  proteina_vegetal: { id: 'proteina_vegetal', label: 'Proteína vegetal', rationText: '20 g de proteína', ration: { basis: 'macro', key: 'proteinG', amount: 20 } },
  legumbres: { id: 'legumbres', label: 'Legumbres', rationText: '25 g de carbohidratos (un plato pequeño cocido)', ration: { basis: 'macro', key: 'carbsG', amount: 25 } },
  cereales: { id: 'cereales', label: 'Cereales, pan y tubérculos', rationText: '30 g de carbohidratos', ration: { basis: 'macro', key: 'carbsG', amount: 30 } },
  fruta: { id: 'fruta', label: 'Fruta', rationText: '15 g de carbohidratos (una pieza mediana)', ration: { basis: 'macro', key: 'carbsG', amount: 15 } },
  verdura: { id: 'verdura', label: 'Verduras y hortalizas', rationText: '150 g', ration: { basis: 'grams', grams: 150 } },
  lacteos: { id: 'lacteos', label: 'Lácteos', rationText: '8 g de proteína (un vaso de leche o un yogur)', ration: { basis: 'macro', key: 'proteinG', amount: 8 } },
  bebidas_vegetales: { id: 'bebidas_vegetales', label: 'Bebidas vegetales', rationText: '200 ml (un vaso)', ration: { basis: 'grams', grams: 200 } },
  grasas: { id: 'grasas', label: 'Grasas y frutos secos', rationText: '10 g de grasa (una cucharada de aceite)', ration: { basis: 'macro', key: 'fatG', amount: 10 } },
}

/** Equivalencias razonables: más de esto en un solo plato ya no es una sustitución creíble. */
export const MAX_SUBSTITUTE_GRAMS = 800

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * A qué grupo pertenece un alimento, a partir de su categoría y su nombre.
 * null = no tiene grupo (suplementos, cacao, miel…): ahí se sustituye por macros.
 */
export function groupOfFood(food: Pick<Food, 'name' | 'category'>): ExchangeGroupId | null {
  const name = norm(food.name)
  switch (food.category) {
    case 'Proteína':
      return /tofu|tempeh|seitan|edamame|soja|vegetal/.test(name) ? 'proteina_vegetal' : 'proteina_animal'
    case 'Legumbre':
      return /soja texturizada/.test(name) ? 'proteina_vegetal' : 'legumbres'
    case 'Carbohidrato': return 'cereales'
    case 'Fruta': return 'fruta'
    case 'Verdura': return 'verdura'
    case 'Lácteo':
      if (/^nata|mantequilla/.test(name)) return 'grasas'
      return /^(leche|bebida) de |^bebida /.test(name) ? 'bebidas_vegetales' : 'lacteos'
    case 'Grasa': case 'Fruto seco': return 'grasas'
    default: return null
  }
}

export const roundRation = (n: number) => Math.round(n * 10) / 10

export interface SubstituteItem {
  foodName: string
  /** Cantidad del plato en gramos (o ml); null si la unidad no es convertible (p. ej. "unidad"). */
  grams: number | null
  kcal: number; proteinG: number; carbsG: number; fatG: number
}

export interface SubstituteSuggestion { food: Food; grams: number }

export interface SubstitutionResult {
  /** Grupo del alimento original; null si no se conoce o no tiene grupo (entonces solo hay modo "todos"). */
  group: ExchangeGroup | null
  /** true si la lista está limitada al grupo del alimento original. */
  grouped: boolean
  /** Con qué se igualan los gramos: el nutriente clave del grupo en modo grupo, o el elegido. */
  matchBy: MacroKey
  /** Raciones que tiene el plato original (solo en modo grupo). */
  rations: number | null
  suggestions: SubstituteSuggestion[]
  /** Candidatos que se han quitado por coincidir con las alergias del cliente. */
  hiddenByAllergy: number
}

/** Cuánto se aleja de un plato un alimento servido en `grams`: macros pasados a kcal (4/4/9) + un castigo por cambiar el tamaño de la porción. */
function distanceAt(f: Food, grams: number, original: { kcal: number; proteinG: number; carbsG: number; fatG: number }, originalGrams: number | null): number {
  const k = grams / 100
  const macros = Math.abs(f.kcal * k - original.kcal) + 4 * Math.abs(f.proteinG * k - original.proteinG)
    + 4 * Math.abs(f.carbsG * k - original.carbsG) + 9 * Math.abs(f.fatG * k - original.fatG)
  // Una sustitución creíble se parece también en tamaño: 150 g de pollo → 155 g de pavo, no → 270 g de merluza.
  return macros + (originalGrams != null ? 0.5 * Math.abs(grams - originalGrams) : 0)
}

const sameName = (a: string, b: string) => norm(a) === norm(b)

/**
 * Sustitutos para un plato. En modo 'group' (el predeterminado) solo salen los
 * del mismo grupo de intercambio, igualando raciones; en 'all' sale cualquier
 * alimento, igualando el macro elegido. Los alimentos que chocan con las alergias
 * del cliente nunca se sugieren.
 */
export function suggestSubstitutes(input: {
  item: SubstituteItem
  foods: Food[]
  scope: 'group' | 'all'
  matchBy: MacroKey
  allergies?: string
  limit?: number
  /** Filtro extra sobre los CANDIDATOS (p. ej. etiquetas dietéticas); el alimento original se busca siempre en `foods`. */
  candidateFilter?: (food: Food) => boolean
}): SubstitutionResult {
  const { item, foods, scope, allergies = '', limit = 6, candidateFilter } = input
  const original = foods.find(f => sameName(f.name, item.foodName))
  const groupId = original ? groupOfFood(original) : null
  const group = groupId ? EXCHANGE_GROUPS[groupId] : null
  const useGroup = scope === 'group' && group != null

  let candidates = foods.filter(f => !sameName(f.name, item.foodName) && (!candidateFilter || candidateFilter(f)))
  if (useGroup) candidates = candidates.filter(f => groupOfFood(f) === group.id)

  const safe = candidates.filter(f => !detectAllergenConflict(allergies, f.name))
  const hiddenByAllergy = candidates.length - safe.length

  const originalMacros = { kcal: item.kcal, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG }

  if (useGroup && group.ration.basis === 'grams') {
    // Grupos medidos por peso: se cambia la misma cantidad del plato (o una ración si no se sabe cuánto es).
    const grams = Math.round((item.grams ?? group.ration.grams) * 10) / 10
    const ranked = [...safe].sort((a, b) => distanceAt(a, grams, originalMacros, grams) - distanceAt(b, grams, originalMacros, grams))
    return {
      group, grouped: true, matchBy: 'kcal', rations: roundRation(grams / group.ration.grams), hiddenByAllergy,
      suggestions: ranked.slice(0, limit).map(food => ({ food, grams })),
    }
  }

  const matchBy: MacroKey = useGroup && group.ration.basis === 'macro' ? group.ration.key : input.matchBy
  const rations = useGroup && group.ration.basis === 'macro' ? roundRation(originalMacros[group.ration.key] / group.ration.amount) : null
  if (useGroup) {
    const keyAmount = originalMacros[matchBy]
    const ranked = safe
      .map(food => ({ food, grams: gramsForAbsoluteMacro(food, keyAmount, matchBy) }))
      .filter((r): r is { food: Food; grams: number } => r.grams != null && r.grams <= MAX_SUBSTITUTE_GRAMS)
      .sort((a, b) => distanceAt(a.food, a.grams, originalMacros, item.grams) - distanceAt(b.food, b.grams, originalMacros, item.grams))
    return {
      group, grouped: true, matchBy, rations, hiddenByAllergy,
      suggestions: ranked.slice(0, limit).map(({ food, grams }) => ({ food, grams: Math.round(grams * 10) / 10 })),
    }
  }

  const ranked = rankSubstitutesByMacros(originalMacros, item.foodName, safe, matchBy).filter(r => r.grams <= MAX_SUBSTITUTE_GRAMS)
  return {
    group, grouped: useGroup, matchBy, rations, hiddenByAllergy,
    suggestions: ranked.slice(0, limit).map(({ food, grams }) => ({ food, grams: Math.round(grams * 10) / 10 })),
  }
}

/**
 * Gramos de `food` que equivalen al plato original según cómo se haya calculado la
 * sustitución (por raciones, por peso o por el macro elegido). Sirve para el
 * buscador libre, que puede devolver alimentos que no están entre las sugerencias.
 */
export function substituteGrams(food: Food, item: SubstituteItem, result: SubstitutionResult): number | null {
  if (result.grouped && result.group?.ration.basis === 'grams') return Math.round((item.grams ?? result.group.ration.grams) * 10) / 10
  const g = gramsForAbsoluteMacro(food, item[result.matchBy], result.matchBy)
  return g == null ? null : Math.round(g * 10) / 10
}
