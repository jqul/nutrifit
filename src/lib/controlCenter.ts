// Centro de control: la pantalla de inicio del nutricionista. Todo se calcula a
// partir de lo que ya existe (semáforo de salud, alertas por cliente, citas de
// hoy, precios), sin tablas nuevas.
import { Appointment } from '../types'
import { ClientHealthReason } from './clientHealth'
import { ClientAlert, AlertKind } from './clientAlerts'

/** Pestañas de la ficha del cliente: a cuál lleva cada aviso. */
export type ClientPanelTab = 'perfil' | 'dieta' | 'seguimiento' | 'analiticas' | 'mensajes' | 'notas'

/** 'today' = actuar hoy · 'week' = revisar esta semana · 'ok' = todo correcto. */
export type Priority = 'today' | 'week' | 'ok'

/** Un motivo concreto por el que un cliente aparece en "Requieren atención". */
export interface Issue { priority: 'today' | 'week'; label: string; tab: ClientPanelTab }

interface PrioritizableClient { healthReason?: ClientHealthReason; healthLabel?: string; alerts?: ClientAlert[] }

/**
 * Del semáforo de salud: sin check-in reciente es lo único que compromete la
 * relación si no se actúa a tiempo, así que pide acción hoy (y lo natural es
 * escribirle). Una analítica en alerta, actividad sin revisar o un plan por
 * renovar caben en la revisión semanal.
 */
const HEALTH_ISSUE: Partial<Record<ClientHealthReason, { priority: Issue['priority']; tab: ClientPanelTab }>> = {
  inactive: { priority: 'today', tab: 'mensajes' },
  biomarker: { priority: 'week', tab: 'analiticas' },
  unreviewed: { priority: 'week', tab: 'seguimiento' },
  billing: { priority: 'week', tab: 'perfil' },
}

// Las alertas de peso, hambre, energía y adherencia se miran en Seguimiento.
const ALERT_TAB: Record<AlertKind, ClientPanelTab> = {
  weight_stalled: 'seguimiento', high_hunger: 'seguimiento', low_energy: 'seguimiento',
  low_adherence: 'seguimiento', no_weigh_in: 'seguimiento', goal_reached: 'seguimiento',
}

/** Todos los motivos de atención de un cliente, el más urgente primero. */
export function issuesOf(client: PrioritizableClient): Issue[] {
  const issues: Issue[] = []
  const health = client.healthReason ? HEALTH_ISSUE[client.healthReason] : undefined
  if (health) issues.push({ priority: health.priority, label: client.healthLabel || '', tab: health.tab })
  for (const a of client.alerts || []) {
    if (a.priority === 'week') issues.push({ priority: 'week', label: a.label, tab: ALERT_TAB[a.kind] })
  }
  return issues.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'today' ? -1 : 1))
}

export function priorityOf(client: PrioritizableClient): Priority {
  return issuesOf(client)[0]?.priority ?? 'ok'
}

export interface PrioritySummary { today: number; week: number; ok: number; total: number }

export function summarizePriorities(clients: PrioritizableClient[]): PrioritySummary {
  const s: PrioritySummary = { today: 0, week: 0, ok: 0, total: clients.length }
  for (const c of clients) s[priorityOf(c)]++
  return s
}

export interface AttentionItem<T> { client: T; priority: Exclude<Priority, 'ok'>; issues: Issue[] }

/** Quién necesita algo: primero los de "hoy", luego "esta semana", cada grupo por nombre. */
export function attentionList<T extends PrioritizableClient & { name: string; surname: string }>(clients: T[]): AttentionItem<T>[] {
  const items: AttentionItem<T>[] = []
  for (const client of clients) {
    const issues = issuesOf(client)
    if (issues.length > 0) items.push({ client, priority: issues[0].priority, issues })
  }
  const rank = { today: 0, week: 1 } as const
  return items.sort((a, b) =>
    (rank[a.priority] - rank[b.priority])
    || `${a.client.name} ${a.client.surname}`.localeCompare(`${b.client.name} ${b.client.surname}`, 'es'))
}

/** Clientes que han alcanzado su peso objetivo: la buena noticia del día. */
export function goalReachedClients<T extends { alerts?: ClientAlert[] }>(clients: T[]): T[] {
  return clients.filter(c => (c.alerts || []).some(a => a.kind === 'goal_reached'))
}

/** "Buenos días, Ana" según la hora; usa solo el primer nombre. */
export function greeting(now: Date, displayName: string): string {
  const h = now.getHours()
  const salute = h >= 6 && h < 13 ? 'Buenos días' : h >= 13 && h < 21 ? 'Buenas tardes' : 'Buenas noches'
  const first = displayName.trim().split(/\s+/)[0]
  return first ? `${salute}, ${first}` : salute
}

/** Las citas del día que siguen en pie (sin canceladas), por hora. */
export function sortTodayAppointments(appointments: Appointment[]): Appointment[] {
  return appointments.filter(a => a.status !== 'cancelada').sort((a, b) => a.startAt.localeCompare(b.startAt))
}

/** Ingresos mensuales estimados: suma de los precios asignados, y cuántos clientes no tienen precio. */
export function monthlyRevenue(clients: { monthlyPrice: number | null }[]): { total: number; withoutPrice: number } {
  let total = 0, withoutPrice = 0
  for (const c of clients) {
    if (c.monthlyPrice == null) withoutPrice++
    else total += c.monthlyPrice
  }
  return { total, withoutPrice }
}

/**
 * Qué mirar o hacer primero con un cliente que pide atención: no solo "aquí hay un problema" sino por dónde empezar.
 * Reglas sencillas y explicables sobre lo que ya se sabe del cliente (el semáforo y sus avisos), nada de adivinar.
 * Devuelve null si no hay nada que sugerir.
 */
export function recommendedAction(client: PrioritizableClient & { adherence7d?: number }): string | null {
  const kinds = new Set((client.alerts || []).filter(a => a.kind !== 'goal_reached').map(a => a.kind))
  const reason = client.healthReason
  if (reason === 'inactive') {
    return kinds.size > 0
      ? 'Escríbele antes de tocar el plan: sin datos recientes no se puede saber si funciona.'
      : 'Escríbele para retomar el contacto.'
  }
  if (kinds.has('low_adherence')) return 'Averigua qué le cuesta del plan antes de modificarlo.'
  if (kinds.has('weight_stalled')) {
    return (client.adherence7d ?? 0) >= 80
      ? 'Sigue bien el plan y el peso no se mueve: valora ajustarlo.'
      : 'Mira primero la adherencia: el peso parado puede deberse a no seguir el plan.'
  }
  if (reason === 'biomarker') return 'Revisa la analítica y valora si cambia algo del plan.'
  if (kinds.has('high_hunger') || kinds.has('low_energy')) return 'Revisa hambre y energía de la semana: el plan puede estar demasiado ajustado.'
  if (kinds.has('no_weigh_in')) return 'Pídele que se pese esta semana para poder valorar su evolución.'
  if (reason === 'unreviewed') return 'Revisa su check-in o encuesta y márcalo como revisado.'
  if (reason === 'billing') return 'Genera la factura de este mes en su ficha.'
  return null
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** La frase de "tu día": lo que hay hoy en un vistazo. Lo que está a cero no se menciona. */
export function dayHeadline(d: { appointments: number; actToday: number; pendingReviews: number; goalsReached: number }): string {
  const parts = [
    d.appointments > 0 && plural(d.appointments, 'cita', 'citas'),
    d.actToday > 0 && plural(d.actToday, 'cliente para actuar hoy', 'clientes para actuar hoy'),
    d.pendingReviews > 0 && plural(d.pendingReviews, 'revisión semanal pendiente', 'revisiones semanales pendientes'),
    d.goalsReached > 0 && plural(d.goalsReached, 'objetivo alcanzado', 'objetivos alcanzados'),
  ].filter((p): p is string => !!p)
  if (parts.length === 0) return 'Hoy no tienes nada urgente.'
  if (parts.length === 1) return `Hoy: ${parts[0]}.`
  return `Hoy: ${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}.`
}

export interface OkBreakdown { total: number; recentCheckin: number; goodAdherence: number; onStreak: number }

/** De los clientes sin incidencias, por qué están bien: da tranquilidad saber que "todo correcto" no es "sin datos". */
export function okBreakdown(
  clients: (PrioritizableClient & { lastCheckin?: string; adherence7d?: number; streak?: number })[],
  today: Date,
): OkBreakdown {
  const ok = clients.filter(c => priorityOf(c) === 'ok')
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const recent = (iso?: string) => {
    if (!iso) return false
    const [y, m, dd] = iso.split('-').map(Number)
    return (day(today) - Date.UTC(y, m - 1, dd)) / 86400000 <= 7
  }
  return {
    total: ok.length,
    recentCheckin: ok.filter(c => recent(c.lastCheckin)).length,
    goodAdherence: ok.filter(c => (c.adherence7d ?? 0) >= 80).length,
    onStreak: ok.filter(c => (c.streak ?? 0) >= 3).length,
  }
}
