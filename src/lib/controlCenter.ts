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
