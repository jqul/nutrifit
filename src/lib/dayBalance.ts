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

/** Día de la semana de una fecha YYYY-MM-DD: 0 = lunes … 6 = domingo (como `dayOfWeek` de las comidas). */
export function dayOfWeekOf(date: string): number { return (new Date(date + 'T00:00:00').getDay() + 6) % 7 }

/**
 * Las comidas del plan que un día quedaron hechas, para quien no sabe qué opción eligió el cliente (el nutricionista):
 * por cada nombre de comida con registro ese día se toma la primera del plan que aplica a ese día de la semana.
 */
export function mealsDoneOn(planMeals: DietMeal[], logs: MealLog[], date: string): DietMeal[] {
  const dow = dayOfWeekOf(date)
  const names = new Set(logs.filter(l => l.date === date).map(l => l.mealName))
  const done: DietMeal[] = []
  for (const name of names) {
    const meal = planMeals.find(m => m.name === name && (m.dayOfWeek == null || m.dayOfWeek === dow))
    if (meal) done.push(meal)
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
export function balanceOfDay(date: string, doneMeals: DietMeal[], extras: ScannedExtra[], targetKcal: number | null): DayBalance {
  const plan = doneMeals.reduce((s, m) => addMacros(s, mealMacros(m)), ZERO)
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
    const balance = balanceOfDay(date, mealsDoneOn(planMeals, dayLogs, date), scannedExtrasOf(dayLogs), targetKcal)
    return balance.doneMeals + balance.extrasCount > 0 ? [balance] : []
  })
}
