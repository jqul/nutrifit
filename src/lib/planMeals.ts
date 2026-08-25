// Resuelve qué comidas de un plan aplican "hoy" para el cliente, componiendo
// las tres capas de flexibilidad que puede tener un plan: cuadrante semanal
// (dayOfWeek), carb cycling (dayType) y opciones intercambiables
// (optionGroup) — compartido entre HoyTab y DietaClienteTab para que ambas
// pantallas vean siempre el mismo día, sin duplicar la lógica de cada una.
import { DietMeal } from '../types'

/** Agrupa comidas por optionGroup — cada grupo es un array de 1+ comidas;
 * sin optionGroup = grupo de 1 (comida fija de siempre, sin cambios).
 * Mantiene el orden de aparición del array original. */
export function groupMealsByOption(meals: DietMeal[]): DietMeal[][] {
  const groups: DietMeal[][] = []
  const byGroupId = new Map<string, DietMeal[]>()
  for (const m of meals) {
    if (m.optionGroup) {
      let g = byGroupId.get(m.optionGroup)
      if (!g) { g = []; byGroupId.set(m.optionGroup, g); groups.push(g) }
      g.push(m)
    } else {
      groups.push([m])
    }
  }
  return groups
}

/** Las comidas que aplican un día concreto (dayOfWeek) y tipo de día
 * (dayType) — sin resolver todavía las opciones intercambiables. */
export function mealsForDay(meals: DietMeal[], dayOfWeek: number, dayType: 'on' | 'off'): DietMeal[] {
  return meals.filter(m => (m.dayOfWeek == null || m.dayOfWeek === dayOfWeek) && (m.dayType == null || m.dayType === dayType))
}

/** La lista final de comidas de hoy: un elemento por hueco — de cada grupo
 * de opciones intercambiables, solo la que el cliente ha elegido (o la
 * primera si aún no ha elegido ninguna). */
export function resolveTodaysMeals(meals: DietMeal[], dayOfWeek: number, dayType: 'on' | 'off', optionChoices: Record<string, string>): DietMeal[] {
  return groupMealsByOption(mealsForDay(meals, dayOfWeek, dayType)).map(g => {
    if (g.length === 1) return g[0]
    const groupId = g[0].optionGroup as string
    return g.find(m => m.id === optionChoices[groupId]) || g[0]
  })
}

// ── Elección del cliente, persistida en localStorage ────────────────────
// Puramente informativo/local (no se guarda en la BD), igual que el
// sistema de intercambios de alimentos — así que se lee de forma síncrona
// en cada render en vez de guardarse en estado, para que HoyTab y
// DietaClienteTab (montadas las dos a la vez, ver ClientView) nunca se
// desincronicen aunque una cambie la elección mientras la otra está montada.

export function loadOptionChoices(planId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`diet-option-choice:${planId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveOptionChoice(planId: string, groupId: string, mealId: string): Record<string, string> {
  const next = { ...loadOptionChoices(planId), [groupId]: mealId }
  try { localStorage.setItem(`diet-option-choice:${planId}`, JSON.stringify(next)) } catch { /* ignore */ }
  return next
}

export function loadDayType(planId: string): 'on' | 'off' {
  try {
    const raw = localStorage.getItem(`diet-day-type:${planId}`)
    return raw === 'off' ? 'off' : 'on'
  } catch { return 'on' }
}

export function saveDayType(planId: string, value: 'on' | 'off'): void {
  try { localStorage.setItem(`diet-day-type:${planId}`, value) } catch { /* ignore */ }
}
