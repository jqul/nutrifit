// Titular de la pestaña Progreso del cliente (UX-23): el cambio de peso desde
// el primer pesaje, en una cifra grande, y cuánto tiempo lleva en el camino.
import { WeightEntry } from '../types'

export interface ProgressHeadline {
  initialKg: number
  currentKg: number
  changeKg: number
  /** Fecha (YYYY-MM-DD) del primer pesaje. */
  startDate: string
  /** Días completos entre el primer pesaje y hoy. */
  daysSinceStart: number
  /** Solo hay un pesaje: aún no hay cambio que enseñar. */
  singleEntry: boolean
}

const DAY_MS = 86400000
const dayStart = (iso: string) => new Date(iso + 'T00:00:00').getTime()

export function summarizeProgress(weights: WeightEntry[], today = new Date()): ProgressHeadline | null {
  if (weights.length === 0) return null
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0], last = sorted[sorted.length - 1]
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return {
    initialKg: first.weightKg,
    currentKg: last.weightKg,
    changeKg: Math.round((last.weightKg - first.weightKg) * 10) / 10,
    startDate: first.date,
    daysSinceStart: Math.max(0, Math.round((todayMs - dayStart(first.date)) / DAY_MS)),
    singleEntry: sorted.length === 1,
  }
}

/** "−4,2 kg" / "+1,0 kg"; por debajo de 0,05 kg se considera sin cambio. */
export function formatChangeKg(changeKg: number): string {
  const abs = Math.abs(changeKg)
  if (abs < 0.05) return '0 kg'
  return `${changeKg < 0 ? '−' : '+'}${abs.toFixed(1).replace('.', ',')} kg`
}

/** "hoy", "hace 5 días", "hace 3 semanas", "hace 2 meses". */
export function formatTimeSince(days: number): string {
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 14) return `hace ${days} días`
  if (days < 60) return `hace ${Math.round(days / 7)} semanas`
  const months = Math.round(days / 30.4)
  return months === 1 ? 'hace 1 mes' : `hace ${months} meses`
}
