// Lo que el cliente apunta fuera del plan (escaneado con el código de barras, o varios alimentos del catálogo a la
// vez en ExtrasQuickLogSheet) queda en el diario (meal_logs) con sus macros escritos en la nota — ver scannedFoodNote
// y el guardado de ExtrasQuickLogSheet. Aquí se vuelven a leer para mostrarlos como "Extras de hoy" y sumarlos.
import { MealLog } from '../types'

export interface ScannedLogInfo { grams: number; kcal: number; proteinG: number; carbsG: number; fatG: number }

const num = (s: string) => parseFloat(s.replace(',', '.'))
// "(producto escaneado" = un código de barras (scannedFoodNote); "(varios alimentos" = ExtrasQuickLogSheet.
const NOTE = /^([\d.,]+) g · (\d+) kcal · P ([\d.,]+) g · C ([\d.,]+) g · G ([\d.,]+) g \(producto escaneado|^(\d+) kcal · P ([\d.,]+) g · C ([\d.,]+) g · G ([\d.,]+) g \(varios alimentos/

/** Cantidad y macros de un registro del diario que viene del escáner o de varios alimentos del catálogo a la vez;
 * null si es otra cosa (una comida normal, una foto…). El segundo caso no lleva gramos totales (son varios
 * ingredientes con pesos distintos), así que su `grams` queda en 0 — nada lo usa para mostrar cantidad, solo las macros. */
export function parseScannedLog(log: Pick<MealLog, 'note'>): ScannedLogInfo | null {
  const m = NOTE.exec(log.note || '')
  if (!m) return null
  // Dos ramas de la alternativa: m[1..5] si es un código de barras (con gramos), m[6..9] si es un registro por
  // texto con IA (sin gramos totales — son varios ingredientes con pesos distintos).
  const [grams, kcal, proteinG, carbsG, fatG] = m[2] !== undefined
    ? [num(m[1]), num(m[2]), num(m[3]), num(m[4]), num(m[5])]
    : [0, num(m[6]), num(m[7]), num(m[8]), num(m[9])]
  if (![grams, kcal, proteinG, carbsG, fatG].every(Number.isFinite)) return null
  return { grams, kcal, proteinG, carbsG, fatG }
}

export interface ScannedExtra { log: MealLog; info: ScannedLogInfo }

export function scannedExtrasOf(logs: MealLog[]): ScannedExtra[] {
  return logs.flatMap(log => { const info = parseScannedLog(log); return info ? [{ log, info }] : [] })
}

export function sumExtras(extras: ScannedExtra[]): { kcal: number; proteinG: number; carbsG: number; fatG: number } {
  const r1 = (n: number) => Math.round(n * 10) / 10
  return {
    kcal: extras.reduce((s, e) => s + e.info.kcal, 0),
    proteinG: r1(extras.reduce((s, e) => s + e.info.proteinG, 0)),
    carbsG: r1(extras.reduce((s, e) => s + e.info.carbsG, 0)),
    fatG: r1(extras.reduce((s, e) => s + e.info.fatG, 0)),
  }
}
