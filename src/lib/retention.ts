// Retención y métricas del negocio. La retención se ESTIMA por actividad: un
// cliente está activo si ha hecho un check-in o se ha pesado en los últimos 30
// días. Es una señal útil para actuar a tiempo, no una cifra contable. Las bajas
// reales (clientes dados de baja, con fecha y motivo) están en clientBaja.ts y no
// entran aquí: un cliente de baja no es un cliente "en riesgo".
import { ClientAlert } from './clientAlerts'
import { goalLabel } from './constants'

export const ACTIVE_WINDOW_DAYS = 30
export const HIGH_RISK_INACTIVE_DAYS = 10
export const MEDIUM_RISK_INACTIVE_DAYS = 4
export const LOW_ADHERENCE_PCT = 50
export const ADHERENCE_DROP_PTS = 25
/** Un cliente con menos días desde el alta aún no ha tenido tiempo de engancharse. */
export const NEW_CLIENT_GRACE_DAYS = 7

const DAY_MS = 86400000

/** Lo que estas métricas necesitan saber de un cliente (ClientWithStats lo cumple). */
export interface RetentionClient {
  id: string
  name: string
  surname: string
  createdAt: number
  monthlyPrice: number | null
  goal: string | null
  goalWeightKg: number | null
  /** Último check-in o pesaje (YYYY-MM-DD). */
  lastActivity?: string
  adherence7d?: number
  /** Adherencia de la semana anterior a la últimas 7 días. */
  adherencePrev7d?: number
  weightStartKg?: number
  weightKg?: number
  alerts?: ClientAlert[]
}

const dayDiff = (fromISO: string, today: Date) =>
  Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(fromISO + 'T00:00:00').getTime()) / DAY_MS)

export const ageDays = (c: { createdAt: number }, today: Date) => Math.floor((today.getTime() - c.createdAt) / DAY_MS)

/** Días sin actividad; null si nunca ha tenido ninguna. */
export function daysInactive(c: { lastActivity?: string }, today: Date): number | null {
  return c.lastActivity ? Math.max(0, dayDiff(c.lastActivity, today)) : null
}

export function isActive(c: { lastActivity?: string }, today: Date): boolean {
  const d = daysInactive(c, today)
  return d != null && d <= ACTIVE_WINDOW_DAYS
}

export type RiskLevel = 'high' | 'medium' | 'low'

export interface ChurnRisk { level: RiskLevel; reasons: string[]; daysInactive: number | null }

/**
 * Riesgo de que un cliente abandone, a partir de su actividad reciente:
 * alto = ≥10 días sin actividad (o ninguna desde el alta); medio = 4-9 días, o
 * adherencia baja, o una caída fuerte frente a la semana anterior.
 */
export function churnRisk(c: RetentionClient, today = new Date()): ChurnRisk {
  const inactive = daysInactive(c, today)
  if (ageDays(c, today) < NEW_CLIENT_GRACE_DAYS) return { level: 'low', reasons: ['Cliente nuevo'], daysInactive: inactive }

  if (inactive == null) return { level: 'high', reasons: ['Sin actividad desde el alta'], daysInactive: null }
  if (inactive >= HIGH_RISK_INACTIVE_DAYS) return { level: 'high', reasons: [`Sin actividad hace ${inactive} días`], daysInactive: inactive }

  const reasons: string[] = []
  if (inactive >= MEDIUM_RISK_INACTIVE_DAYS) reasons.push(`Sin actividad hace ${inactive} días`)
  const adherence = c.adherence7d
  const lowAdherence = adherence != null && adherence < LOW_ADHERENCE_PCT && inactive < MEDIUM_RISK_INACTIVE_DAYS
  const drop = adherence != null && c.adherencePrev7d != null ? c.adherencePrev7d - adherence : 0
  if (lowAdherence && drop >= ADHERENCE_DROP_PTS) reasons.push(`Adherencia ${adherence}% (−${drop} pts frente a la semana anterior)`)
  else if (lowAdherence) reasons.push(`Adherencia ${adherence}%`)
  else if (drop >= ADHERENCE_DROP_PTS) reasons.push(`Adherencia −${drop} pts frente a la semana anterior`)
  if (reasons.length > 0) return { level: 'medium', reasons, daysInactive: inactive }
  return { level: 'low', reasons: [inactive === 0 ? 'Activo hoy' : `Activo hace ${inactive} d`], daysInactive: inactive }
}

const RISK_RANK: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 }

/** Clientes con su riesgo, de más a menos preocupante (a igualdad, por nombre). */
export function rankByRisk<T extends RetentionClient>(clients: T[], today = new Date()): { client: T; risk: ChurnRisk }[] {
  return clients
    .map(client => ({ client, risk: churnRisk(client, today) }))
    .sort((a, b) =>
      RISK_RANK[a.risk.level] - RISK_RANK[b.risk.level]
      || (b.risk.daysInactive ?? 1e6) - (a.risk.daysInactive ?? 1e6)
      || `${a.client.name} ${a.client.surname}`.localeCompare(`${b.client.name} ${b.client.surname}`, 'es'))
}

export interface RetentionMetrics {
  total: number
  /** Con actividad en los últimos 30 días. */
  active: number
  /** Dados de alta este mes natural. */
  newThisMonth: number
  /** Con ≥30 días de antigüedad y sin actividad en los últimos 30: probablemente ya no están. */
  likelyLost: number
  /** % de los clientes con ≥30 días de antigüedad que siguen activos; null si aún no hay ninguno. */
  retentionPct: number | null
  highRisk: number
  mediumRisk: number
  revenue: {
    /** Suma de los precios mensuales asignados a clientes activos. */
    activeMonthly: number
    /** Precio medio por cliente activo con precio asignado; null si no hay ninguno. */
    avgPerActiveClient: number | null
    /** Precios de los clientes en riesgo alto o medio: lo que se pierde si se van. */
    atRiskMonthly: number
  }
}

export function retentionMetrics(clients: RetentionClient[], today = new Date()): RetentionMetrics {
  const sameMonth = (ms: number) => { const d = new Date(ms); return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() }
  const established = clients.filter(c => ageDays(c, today) >= ACTIVE_WINDOW_DAYS)
  const retained = established.filter(c => isActive(c, today))
  const active = clients.filter(c => isActive(c, today))

  let highRisk = 0, mediumRisk = 0, atRiskMonthly = 0
  for (const c of clients) {
    const { level } = churnRisk(c, today)
    if (level === 'high') highRisk++
    if (level === 'medium') mediumRisk++
    if (level !== 'low') atRiskMonthly += c.monthlyPrice ?? 0
  }

  const activePriced = active.filter(c => c.monthlyPrice != null)
  const activeMonthly = activePriced.reduce((sum, c) => sum + (c.monthlyPrice ?? 0), 0)

  return {
    total: clients.length,
    active: active.length,
    newThisMonth: clients.filter(c => sameMonth(c.createdAt)).length,
    likelyLost: established.length - retained.length,
    retentionPct: established.length > 0 ? Math.round((retained.length / established.length) * 100) : null,
    highRisk, mediumRisk,
    revenue: {
      activeMonthly,
      avgPerActiveClient: activePriced.length > 0 ? Math.round(activeMonthly / activePriced.length) : null,
      atRiskMonthly,
    },
  }
}

export type CohortKey = 'goal' | 'joinMonth'

export interface CohortRow {
  key: string
  label: string
  clients: number
  /** Cambio medio de peso desde el primer pesaje, en %, entre quienes tienen ≥2 pesajes; null si ninguno. */
  weightChangePct: number | null
  /** Adherencia media de los últimos 7 días. */
  adherencePct: number
  /** % de clientes con actividad en los últimos 7 días. */
  activeWeekPct: number
  /** % que ha alcanzado su peso objetivo, entre quienes tienen uno fijado; null si ninguno lo tiene. */
  goalReachedPct: number | null
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

function cohortKeyOf(c: RetentionClient, by: CohortKey): { key: string; label: string } {
  if (by === 'goal') return { key: c.goal || '_none', label: c.goal ? goalLabel(c.goal) : 'Sin objetivo' }
  const d = new Date(c.createdAt)
  return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }
}

/** Agrupa a los clientes por objetivo o por mes de alta y resume cómo les va a cada grupo. */
export function cohorts(clients: RetentionClient[], by: CohortKey, today = new Date()): CohortRow[] {
  const groups = new Map<string, { label: string; list: RetentionClient[] }>()
  for (const c of clients) {
    const { key, label } = cohortKeyOf(c, by)
    const g = groups.get(key) ?? { label, list: [] }
    g.list.push(c)
    groups.set(key, g)
  }

  const rows: CohortRow[] = [...groups.entries()].map(([key, { label, list }]) => {
    const withWeights = list.filter(c => c.weightStartKg != null && c.weightKg != null && c.weightStartKg > 0)
    const changes = withWeights.map(c => ((c.weightKg! - c.weightStartKg!) / c.weightStartKg!) * 100)
    const withGoal = list.filter(c => c.goalWeightKg != null)
    const reached = withGoal.filter(c => (c.alerts || []).some(a => a.kind === 'goal_reached'))
    return {
      key, label, clients: list.length,
      weightChangePct: changes.length > 0 ? Math.round(avg(changes) * 10) / 10 : null,
      adherencePct: Math.round(avg(list.map(c => c.adherence7d ?? 0))),
      activeWeekPct: Math.round((list.filter(c => { const d = daysInactive(c, today); return d != null && d <= 7 }).length / list.length) * 100),
      goalReachedPct: withGoal.length > 0 ? Math.round((reached.length / withGoal.length) * 100) : null,
    }
  })

  // Por objetivo: el más numeroso primero; por mes de alta: el más reciente primero.
  return by === 'joinMonth'
    ? rows.sort((a, b) => b.key.localeCompare(a.key))
    : rows.sort((a, b) => b.clients - a.clients || a.label.localeCompare(b.label, 'es'))
}
