// Datos derivados para la lista de Clientes (UX-10): peso actual con su
// variación, el tono de esa variación según el objetivo del cliente, y el
// orden de la lista por quién necesita atención primero.
import { toLocalISODate } from './date'
import { ClientHealthStatus } from './clientHealth'

export interface WeightSummary {
  latestKg: number
  /** Cambio respecto al primer pesaje de la ventana; null si hay menos de 2 pesajes en ella. */
  deltaKg: number | null
}

/** Último peso y su variación en las últimas `windowDays` jornadas (4 semanas por defecto). */
export function summarizeWeight(
  entries: { date: string; weightKg: number }[],
  today = new Date(),
  windowDays = 28,
): WeightSummary | null {
  if (!entries.length) return null
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const start = new Date(today); start.setDate(start.getDate() - windowDays)
  const startStr = toLocalISODate(start)
  const inWindow = sorted.filter(e => e.date >= startStr)
  if (inWindow.length < 2) return { latestKg: latest.weightKg, deltaKg: null }
  return { latestKg: latest.weightKg, deltaKg: Math.round((latest.weightKg - inWindow[0].weightKg) * 10) / 10 }
}

export type WeightTone = 'good' | 'bad' | 'neutral'

/** ¿La variación va en la dirección que el cliente busca? Solo se juzga si el objetivo es perder o ganar peso. */
export function weightDeltaTone(goal: string | null, deltaKg: number | null): WeightTone {
  if (deltaKg == null || deltaKg === 0) return 'neutral'
  if (goal === 'perder_peso') return deltaKg < 0 ? 'good' : 'bad'
  if (goal === 'ganar_masa') return deltaKg > 0 ? 'good' : 'bad'
  return 'neutral'
}

// De más a menos urgente: quien necesita atención va arriba.
const HEALTH_ORDER: Record<ClientHealthStatus, number> = { attention: 0, billing: 1, active: 2, streak: 3 }

export function sortByAttention<T extends { healthStatus?: ClientHealthStatus; name: string; surname: string }>(clients: T[]): T[] {
  return [...clients].sort((a, b) =>
    (HEALTH_ORDER[a.healthStatus || 'active'] - HEALTH_ORDER[b.healthStatus || 'active'])
    || `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, 'es'))
}
