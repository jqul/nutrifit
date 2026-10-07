// Los productos que el cliente escanea y apunta quedan en el diario (meal_logs) con sus macros escritos en la nota
// (ver scannedFoodNote). Aquí se vuelven a leer para mostrarlos como "Extras de hoy" y sumarlos.
import { MealLog } from '../types'

export interface ScannedLogInfo { grams: number; kcal: number; proteinG: number; carbsG: number; fatG: number }

const num = (s: string) => parseFloat(s.replace(',', '.'))
const NOTE = /^([\d.,]+) g · (\d+) kcal · P ([\d.,]+) g · C ([\d.,]+) g · G ([\d.,]+) g \(producto escaneado/

/** Cantidad y macros de un registro del diario que viene del escáner; null si es otra cosa (una comida normal, una foto…). */
export function parseScannedLog(log: Pick<MealLog, 'note'>): ScannedLogInfo | null {
  const m = NOTE.exec(log.note || '')
  if (!m) return null
  const [grams, kcal, proteinG, carbsG, fatG] = [num(m[1]), num(m[2]), num(m[3]), num(m[4]), num(m[5])]
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

export interface ExtraDay { date: string; kcal: number; count: number }

/** Lo escaneado (fuera del plan) por día desde `fromDate` (YYYY-MM-DD, incluido), el día más reciente primero. */
export function extrasByDay(logs: MealLog[], fromDate: string): ExtraDay[] {
  const days = new Map<string, ExtraDay>()
  for (const { log, info } of scannedExtrasOf(logs)) {
    if (log.date < fromDate) continue
    const day = days.get(log.date) ?? { date: log.date, kcal: 0, count: 0 }
    day.kcal += info.kcal; day.count += 1
    days.set(log.date, day)
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
}
