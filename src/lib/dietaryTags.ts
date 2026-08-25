// Etiquetas dietoterapéuticas derivadas del nombre/categoría del alimento —
// mismo enfoque por palabras clave que allergens.ts (sin columna nueva en
// la tabla `foods`, así que funciona también con los alimentos propios que
// cada nutricionista da de alta, sin tener que etiquetarlos a mano).
import { Food } from '../types'

export type DietaryTag = 'sin_gluten' | 'sin_lactosa' | 'bajo_fodmap' | 'vegano' | 'alto_proteina'

export const DIETARY_TAG_LABELS: Record<DietaryTag, string> = {
  sin_gluten: 'Sin gluten',
  sin_lactosa: 'Sin lactosa',
  bajo_fodmap: 'Bajo en FODMAP',
  vegano: 'Vegano',
  alto_proteina: 'Alto en proteína',
}

const GLUTEN_KEYWORDS = ['trigo', 'pan', 'pasta', 'harina', 'cebada', 'centeno', 'cuscús', 'cuscus', 'cerveza', 'seitán', 'seitan']
const DAIRY_KEYWORDS = ['leche', 'yogur', 'queso', 'nata', 'mantequilla', 'requesón', 'requeson', 'lácteo', 'lacteo', 'suero']
const MEAT_FISH_SEAFOOD_KEYWORDS = [
  'pollo', 'pavo', 'ternera', 'cerdo', 'jamón', 'jamon', 'cordero', 'conejo', 'buey', 'carne',
  'salmón', 'salmon', 'merluza', 'atún', 'atun', 'bacalao', 'lubina', 'dorada', 'sardina', 'caballa', 'pescado',
  'gamba', 'langostino', 'cigala', 'marisco', 'mejillón', 'mejillon', 'calamar', 'pulpo', 'chorizo', 'panceta', 'beicon', 'bacon',
]
const OTHER_ANIMAL_KEYWORDS = ['huevo', 'clara de huevo', 'miel', 'gelatina']
// Alimentos con FODMAPs altos conocidos (fructanos, lactosa, polioles, exceso de fructosa) —
// lista orientativa para dieta baja en FODMAP (SIBO / colon irritable), no exhaustiva.
const HIGH_FODMAP_KEYWORDS = [
  'cebolla', 'ajo', 'puerro', 'alcachofa', 'coliflor', 'champiñón', 'champinon', 'seta',
  'manzana', 'pera', 'sandía', 'sandia', 'melocotón', 'melocoton', 'mango', 'ciruela', 'cereza',
  'miel', 'trigo', 'centeno', 'cebada', 'pan', 'pasta', 'cuscús', 'cuscus',
  'garbanzo', 'lenteja', 'alubia', 'judía', 'judia', 'soja',
  'leche', 'yogur', 'queso fresco', 'requesón', 'requeson', 'nata',
  'anacardo', 'pistacho',
]

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(k => text.includes(k))
}

/** Etiquetas dietoterapéuticas de un alimento, para las pills de filtro
 * rápido del buscador. Basado en el nombre (y, para "sin gluten"/"sin
 * lactosa", respeta que el propio nombre ya lo indique explícitamente,
 * p. ej. "Leche sin lactosa"). */
export function classifyFoodTags(food: Pick<Food, 'name' | 'category' | 'proteinG'>): DietaryTag[] {
  const name = food.name.toLowerCase()
  const tags: DietaryTag[] = []

  const explicitlyGlutenFree = name.includes('sin gluten')
  if (explicitlyGlutenFree || !hasKeyword(name, GLUTEN_KEYWORDS)) tags.push('sin_gluten')

  const explicitlyLactoseFree = name.includes('sin lactosa') || name.includes('vegetal')
  if (explicitlyLactoseFree || !hasKeyword(name, DAIRY_KEYWORDS)) tags.push('sin_lactosa')

  if (!hasKeyword(name, MEAT_FISH_SEAFOOD_KEYWORDS) && !hasKeyword(name, DAIRY_KEYWORDS) && !hasKeyword(name, OTHER_ANIMAL_KEYWORDS)) {
    tags.push('vegano')
  }

  if (!hasKeyword(name, HIGH_FODMAP_KEYWORDS)) tags.push('bajo_fodmap')

  if (food.proteinG >= 15) tags.push('alto_proteina')

  return tags
}

export function foodMatchesTags(food: Pick<Food, 'name' | 'category' | 'proteinG'>, activeTags: DietaryTag[]): boolean {
  if (activeTags.length === 0) return true
  const foodTags = classifyFoodTags(food)
  return activeTags.every(t => foodTags.includes(t))
}
