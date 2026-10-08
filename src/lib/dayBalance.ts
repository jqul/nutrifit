// Balance del día: lo que el cliente lleva comido frente a su objetivo, sumando las comidas del plan que ha marcado como
// hechas y lo que ha escaneado (fuera del plan). Es una estimación: una comida "hecha" cuenta con las cantidades del plan.
import { DietMeal, MealLog } from '../types'
import { ScannedExtra, scannedExtrasOf, sumExtras } from './scannedLogs'

export interface MacroTotals { kcal: number; proteinG: number; carbsG: number; fatG: number }

const r1 = (n: number) => Math.round(n * 10) / 10
const ZERO: MacroTotals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }

/** Kcal y macros de una comida del plan: la suma de sus alimentos (lo que no tiene dato cuenta como 0). */
export function mealMacros(meal: Pick<DietMeal, 'items'>): MacroTotals {
  return {
    kcal: Math.round(meal.items.reduce((s, i) => s + (i.kcal ?? 0), 0)),
    proteinG: r1(meal.items.reduce((s, i) => s + (i.proteinG ?? 0), 0)),
    carbsG: r1(meal.items.reduce((s, i) => s + (i.carbsG ?? 0), 0)),
    fatG: r1(meal.items.reduce((s, i) => s + (i.fatG ?? 0), 0)),
  }
}

export function addMacros(a: MacroTotals, b: MacroTotals): MacroTotals {
  return { kcal: a.kcal + b.kcal, proteinG: r1(a.proteinG + b.proteinG), carbsG: r1(a.carbsG + b.carbsG), fatG: r1(a.fatG + b.fatG) }
}

/** Lo que se guarda al marcar una comida como hecha: la opción elegida y lo que aportaba en ese momento. */
export function plannedOf(meal: Pick<DietMeal, 'items' | 'optionLabel'>): Pick<MealLog, 'optionLabel' | 'planned'> {
  return { optionLabel: meal.optionLabel ?? null, planned: mealMacros(meal) }
}

/** Lo mismo, con los nombres de columna de meal_logs para el insert. */
export function plannedColumns(meal: Pick<DietMeal, 'items' | 'optionLabel'>) {
  const { optionLabel, planned } = plannedOf(meal)
  return {
    option_label: optionLabel,
    planned_kcal: planned!.kcal, planned_protein_g: planned!.proteinG, planned_carbs_g: planned!.carbsG, planned_fat_g: planned!.fatG,
  }
}

/** Día de la semana de una fecha YYYY-MM-DD: 0 = lunes … 6 = domingo (como `dayOfWeek` de las comidas). */
export function dayOfWeekOf(date: string): number { return (new Date(date + 'T00:00:00').getDay() + 6) % 7 }

/**
 * Lo que aportaron las comidas del plan que un día quedaron hechas. Cada comida cuenta una vez. Si el registro lleva lo que
 * aportaba cuando el cliente la marcó (la opción que eligió), se usa eso; en los registros antiguos, que no lo llevan, se
 * estima con la primera comida del plan de ese nombre que aplica a ese día de la semana. Lo que no es una comida del plan
 * (un producto escaneado, una nota) no cuenta.
 */
export function plannedMealsOn(planMeals: DietMeal[], logs: MealLog[], date: string): MacroTotals[] {
  const dow = dayOfWeekOf(date)
  const byName = new Map<string, MealLog>()
  for (const l of logs) if (l.date === date && !byName.has(l.mealName)) byName.set(l.mealName, l)
  const done: MacroTotals[] = []
  for (const [name, log] of byName) {
    if (log.planned) { done.push(log.planned); continue }
    const meal = planMeals.find(m => m.name === name && (m.dayOfWeek == null || m.dayOfWeek === dow))
    if (meal) done.push(mealMacros(meal))
  }
  return done
}

export interface DayBalance {
  date: string
  plan: MacroTotals
  extras: MacroTotals
  total: MacroTotals
  extrasCount: number
  doneMeals: number
  targetKcal: number | null
  /** Total del día respecto al objetivo, en %. null si no hay objetivo. */
  pctOfTarget: number | null
}

/** Balance de un día a partir de las comidas del plan hechas y los extras escaneados. */
export function balanceOfDay(date: string, doneMeals: MacroTotals[], extras: ScannedExtra[], targetKcal: number | null): DayBalance {
  const plan = doneMeals.reduce((s, m) => addMacros(s, m), ZERO)
  const ex = sumExtras(extras)
  const total = addMacros(plan, ex)
  return {
    date, plan, extras: ex, total, extrasCount: extras.length, doneMeals: doneMeals.length, targetKcal,
    pctOfTarget: targetKcal ? Math.round((total.kcal / targetKcal) * 100) : null,
  }
}

/** Balance de cada día con algo apuntado desde `fromDate` (incluido), el más reciente primero. */
export function balanceByDay(planMeals: DietMeal[], targetKcal: number | null, logs: MealLog[], fromDate: string): DayBalance[] {
  const dates = [...new Set(logs.filter(l => l.date >= fromDate).map(l => l.date))].sort((a, b) => b.localeCompare(a))
  return dates.flatMap(date => {
    const dayLogs = logs.filter(l => l.date === date)
    const balance = balanceOfDay(date, plannedMealsOn(planMeals, dayLogs, date), scannedExtrasOf(dayLogs), targetKcal)
    return balance.doneMeals + balance.extrasCount > 0 ? [balance] : []
  })
}

export interface BalanceStatus { tone: 'ok' | 'low' | 'high'; text: string }

/** Una frase sobre cómo va el día: dentro del objetivo (entre el 90 % y el 105 %), le faltan kcal o se ha pasado. */
export function balanceStatus(totalKcal: number, targetKcal: number): BalanceStatus {
  const ratio = totalKcal / targetKcal
  const diff = Math.abs(Math.round(targetKcal - totalKcal))
  if (ratio > 1.05) return { tone: 'high', text: `Te pasas ${diff} kcal del objetivo` }
  if (ratio < 0.9) return { tone: 'low', text: `Te faltan ${diff} kcal para el objetivo` }
  return { tone: 'ok', text: 'Dentro del objetivo' }
}
