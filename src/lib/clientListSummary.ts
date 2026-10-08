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

/** 68.4 → "68,4" (decimal con coma, siempre un decimal). */
export function formatKg(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** Variación de peso lista para mostrar: "↓ 0,6 kg", "↑ 1,5 kg", "= 0,0 kg" o "sin variación" si no hay dato. */
export function formatWeightDelta(deltaKg: number | null | undefined): string {
  if (deltaKg == null) return 'sin variación'
  return `${deltaKg < 0 ? '↓' : deltaKg > 0 ? '↑' : '='} ${formatKg(Math.abs(deltaKg))} kg`
}

/** Días desde la última actividad (check-in o pesaje, YYYY-MM-DD); null si no hay ninguna. */
export function daysSinceActivity(lastActivity: string | undefined, today = new Date()): number | null {
  if (!lastActivity) return null
  const [y, m, d] = lastActivity.split('-').map(Number)
  if (!y || !m || !d) return null
  const day = (dt: Date) => Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())
  return Math.max(0, Math.round((day(today) - Date.UTC(y, m - 1, d)) / 86400000))
}

/** "Hoy", "Ayer", "Hace 6 días" o "Sin actividad": cuánto hace que el cliente interactuó por última vez. */
export function activityLabel(days: number | null): string {
  if (days == null) return 'Sin actividad'
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

export type ClientSort = 'atencion' | 'nombre' | 'adherencia' | 'actividad'

export const CLIENT_SORT_LABELS: Record<ClientSort, string> = {
  atencion: 'Necesitan atención', nombre: 'Nombre', adherencia: 'Adherencia (menor primero)', actividad: 'Última actividad (más antigua primero)',
}

/** Ordena la lista de clientes: por atención (lo de siempre), nombre, adherencia ascendente o inactividad descendente. */
export function sortClients<T extends {
  healthStatus?: ClientHealthStatus; name: string; surname: string; adherence7d?: number; lastActivity?: string
}>(clients: T[], mode: ClientSort, today = new Date()): T[] {
  const byName = (a: T, b: T) => `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, 'es')
  if (mode === 'nombre') return [...clients].sort(byName)
  if (mode === 'adherencia') return [...clients].sort((a, b) => (a.adherence7d ?? 0) - (b.adherence7d ?? 0) || byName(a, b))
  if (mode === 'actividad') {
    // Sin ninguna actividad cuenta como lo más antiguo.
    const age = (c: T) => daysSinceActivity(c.lastActivity, today) ?? Number.POSITIVE_INFINITY
    return [...clients].sort((a, b) => (age(b) - age(a)) || byName(a, b))
  }
  return sortByAttention(clients)
}
