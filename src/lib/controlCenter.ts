// Centro de control: la pantalla de inicio del nutricionista. Todo se calcula a
// partir de lo que ya existe (semáforo de salud, citas de hoy, precios), sin
// tablas nuevas.
import { Appointment } from '../types'
import { ClientHealthReason } from './clientHealth'

/** 'today' = actuar hoy · 'week' = revisar esta semana · 'ok' = todo correcto. */
export type Priority = 'today' | 'week' | 'ok'

interface PrioritizableClient { healthReason?: ClientHealthReason }

/**
 * Sin check-in reciente es lo único que compromete la relación si no se
 * actúa a tiempo, así que es lo que pide acción hoy. Una analítica en alerta,
 * actividad sin revisar o un plan por renovar caben en la revisión semanal.
 */
export function priorityOf(client: PrioritizableClient): Priority {
  switch (client.healthReason) {
    case 'inactive': return 'today'
    case 'biomarker':
    case 'unreviewed':
    case 'billing': return 'week'
    default: return 'ok'
  }
}

export interface PrioritySummary { today: number; week: number; ok: number; total: number }

export function summarizePriorities(clients: PrioritizableClient[]): PrioritySummary {
  const s: PrioritySummary = { today: 0, week: 0, ok: 0, total: clients.length }
  for (const c of clients) s[priorityOf(c)]++
  return s
}

export interface AttentionItem<T> { client: T; priority: Exclude<Priority, 'ok'> }

/** Quién necesita algo: primero los de "hoy", luego "esta semana", cada grupo por nombre. */
export function attentionList<T extends PrioritizableClient & { name: string; surname: string; healthLabel?: string }>(clients: T[]): AttentionItem<T>[] {
  const items: AttentionItem<T>[] = []
  for (const client of clients) {
    const priority = priorityOf(client)
    if (priority !== 'ok') items.push({ client, priority })
  }
  const rank = { today: 0, week: 1 } as const
  return items.sort((a, b) =>
    (rank[a.priority] - rank[b.priority])
    || `${a.client.name} ${a.client.surname}`.localeCompare(`${b.client.name} ${b.client.surname}`, 'es'))
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
