// Datos para encontrar una receta entre muchas: tipo de comida y etiquetas libres.

export type MealType = 'desayuno' | 'comida' | 'merienda' | 'cena' | 'snack'

export const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'comida', label: 'Comida' },
  { id: 'merienda', label: 'Merienda' },
  { id: 'cena', label: 'Cena' },
  { id: 'snack', label: 'Snack' },
]

export function mealTypeLabel(t: string | null | undefined): string {
  return MEAL_TYPES.find(m => m.id === t)?.label ?? ''
}

const MAX_TAGS = 8
const MAX_TAG_LENGTH = 30

/** «Rápida, sin horno, Batch cooking» → ['rápida', 'sin horno', 'batch cooking'] (sin repetidos ni vacíos). */
export function parseTags(text: string): string[] {
  const tags: string[] = []
  for (const raw of text.split(/[,;\n]/)) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH)
    if (tag && !tags.includes(tag)) tags.push(tag)
    if (tags.length >= MAX_TAGS) break
  }
  return tags
}

interface Searchable { name: string; meal_type?: string | null; tags?: string[] | null }

export interface RecipeFilter { query?: string; mealType?: MealType | null; tag?: string | null }

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function filterRecipes<T extends Searchable>(recipes: T[], filter: RecipeFilter): T[] {
  const q = fold(filter.query ?? '').trim()
  return recipes.filter(r => {
    if (filter.mealType && r.meal_type !== filter.mealType) return false
    if (filter.tag && !(r.tags ?? []).includes(filter.tag)) return false
    if (!q) return true
    return fold(r.name).includes(q) || (r.tags ?? []).some(t => fold(t).includes(q))
  })
}

/** Todas las etiquetas usadas, de la más a la menos frecuente (a igualdad, por orden alfabético). */
export function allTags(recipes: { tags?: string[] | null }[]): string[] {
  const counts = new Map<string, number>()
  for (const r of recipes) for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t)
}
