// Bajas de clientes: motivos y métricas REALES de abandono. Dar de baja a un
// cliente no borra nada (ver la migración 0052): queda registrado cuándo y por
// qué, y se puede reactivar. Antes la retención solo se podía estimar por
// actividad (retention.ts); ahora hay además cuántos clientes se han ido de verdad.
import { ClientData } from '../types'

export type BajaReason = 'precio' | 'resultados' | 'falta_tiempo' | 'objetivo_logrado' | 'otro'

export const BAJA_REASONS: { id: BajaReason; label: string; hint: string }[] = [
  { id: 'objetivo_logrado', label: 'Objetivo conseguido', hint: 'Ha llegado donde quería: una baja buena.' },
  { id: 'precio', label: 'Precio', hint: 'No puede o no quiere pagar la cuota.' },
  { id: 'resultados', label: 'No veía resultados', hint: 'Se fue por falta de resultados.' },
  { id: 'falta_tiempo', label: 'Falta de tiempo o motivación', hint: 'Lo dejó por la vida diaria.' },
  { id: 'otro', label: 'Otro motivo', hint: 'Cualquier otra razón (puedes anotarla).' },
]

// Un Map y no un objeto: con un objeto, 'toString' o 'constructor' pasarían por motivos válidos.
const LABEL = new Map<string, string>(BAJA_REASONS.map(r => [r.id, r.label]))

export const isBajaReason = (v: unknown): v is BajaReason => typeof v === 'string' && LABEL.has(v)

/** Texto del motivo; 'Sin motivo' si no se indicó o es uno desconocido. */
export const bajaReasonLabel = (reason: string | null | undefined): string => (reason && LABEL.get(reason)) || 'Sin motivo'

export const isDeBaja = (c: Pick<ClientData, 'bajaAt'>): boolean => c.bajaAt != null

/** Ventana por defecto de las métricas: los últimos 90 días. */
export const CHURN_WINDOW_DAYS = 90

const DAY_MS = 86400000

export interface ReasonCount { reason: BajaReason | 'none'; label: string; count: number }

export interface ChurnMetrics {
  windowDays: number
  /** Bajas dentro de la ventana. */
  bajas: number
  /** Bajas del mes natural en curso. */
  bajasThisMonth: number
  /** De los clientes que has tenido en la ventana (activos hoy + dados de baja en ella), el % que se fue; null si no hay ninguno. */
  churnPct: number | null
  /** Suma de las cuotas mensuales de los que se fueron en la ventana (solo los que tenían precio). */
  lostMonthly: number
  /** Días medios que duró un cliente que se fue en la ventana; null si no hubo bajas. */
  avgTenureDays: number | null
  /** Motivos de las bajas de la ventana, de más a menos frecuente. */
  byReason: ReasonCount[]
}

type BajaClient = Pick<ClientData, 'createdAt' | 'monthlyPrice' | 'bajaAt' | 'bajaReason'>

/**
 * Métricas de abandono. `bajas` son los clientes dados de baja y `activeCount`
 * cuántos clientes activos hay hoy (el denominador del porcentaje).
 */
export function churnMetrics(bajas: BajaClient[], activeCount: number, today = new Date(), windowDays = CHURN_WINDOW_DAYS): ChurnMetrics {
  const now = today.getTime()
  const since = now - windowDays * DAY_MS
  const inWindow = bajas.filter(c => c.bajaAt != null && c.bajaAt >= since && c.bajaAt <= now)
  const sameMonth = (ms: number) => { const d = new Date(ms); return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() }

  const counts = new Map<string, number>()
  for (const c of inWindow) {
    const key = isBajaReason(c.bajaReason) ? c.bajaReason : 'none'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const byReason: ReasonCount[] = [...counts.entries()]
    .map(([reason, count]) => ({ reason: reason as ReasonCount['reason'], label: reason === 'none' ? 'Sin motivo' : bajaReasonLabel(reason), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))

  const base = activeCount + inWindow.length
  const tenures = inWindow.map(c => Math.max(0, Math.round((c.bajaAt! - c.createdAt) / DAY_MS)))
  return {
    windowDays,
    bajas: inWindow.length,
    bajasThisMonth: bajas.filter(c => c.bajaAt != null && c.bajaAt <= now && sameMonth(c.bajaAt)).length,
    churnPct: base > 0 ? Math.round((inWindow.length / base) * 100) : null,
    lostMonthly: inWindow.reduce((sum, c) => sum + (c.monthlyPrice ?? 0), 0),
    avgTenureDays: tenures.length > 0 ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length) : null,
    byReason,
  }
}

/** "3 meses", "5 semanas", "12 días": cuánto estuvo el cliente. */
export function formatTenure(days: number): string {
  if (days >= 60) return `${Math.round(days / 30)} meses`
  if (days >= 14) return `${Math.round(days / 7)} semanas`
  return `${days} ${days === 1 ? 'día' : 'días'}`
}
