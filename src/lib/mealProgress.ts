// Estado "comida completada" compartido entre Hoy y Dieta (UX-22) y reparto de
// energía del objetivo diario. Hoy es quien marca las comidas; Dieta solo las
// muestra, así que Hoy publica aquí los registros de hoy y Dieta se suscribe.
import { MealLog } from '../types'

export interface MealLogsSnapshot { clientId: string | null; logs: MealLog[] }

let snapshot: MealLogsSnapshot = { clientId: null, logs: [] }
const listeners = new Set<() => void>()

export function publishMealLogs(clientId: string, logs: MealLog[]) {
  snapshot = { clientId, logs }
  listeners.forEach(l => l())
}

export function subscribeMealLogs(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getMealLogsSnapshot = () => snapshot

/** Registros de hoy de ese cliente (vacío si Hoy aún no ha publicado los suyos). */
export function mealLogsOf(snap: MealLogsSnapshot, clientId: string): MealLog[] {
  return snap.clientId === clientId ? snap.logs : []
}

/** Una comida cuenta como hecha si hay un registro de hoy con su nombre (misma regla que Hoy). */
export function isMealDone(mealName: string, logs: MealLog[]): boolean {
  return logs.some(l => l.mealName === mealName)
}

export function countMealsDone(mealNames: string[], logs: MealLog[]): number {
  return mealNames.filter(n => isMealDone(n, logs)).length
}

export interface MacroSplit { proteinPct: number; carbsPct: number; fatPct: number }

/** Porcentaje de la energía del objetivo que aporta cada macro (4/4/9 kcal por gramo), sumando 100. */
export function macroEnergySplit(proteinG: number, carbsG: number, fatG: number): MacroSplit | null {
  const p = proteinG * 4, c = carbsG * 4, f = fatG * 9
  const total = p + c + f
  if (!(total > 0)) return null
  const proteinPct = Math.round((p / total) * 100)
  const carbsPct = Math.round((c / total) * 100)
  return { proteinPct, carbsPct, fatPct: 100 - proteinPct - carbsPct }
}
