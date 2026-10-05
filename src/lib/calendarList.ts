// Vista lista del calendario (UX-26): las citas de la semana agrupadas por día,
// solo los días que tienen alguna, en orden cronológico.
import { Appointment } from '../types'
import { toLocalISODate } from './date'

export interface DayGroup { day: string; appointments: Appointment[] }

export function groupAppointmentsByDay(appointments: Appointment[]): DayGroup[] {
  const sorted = [...appointments].sort((a, b) => a.startAt.localeCompare(b.startAt))
  const groups: DayGroup[] = []
  for (const a of sorted) {
    const day = toLocalISODate(new Date(a.startAt))
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.appointments.push(a)
    else groups.push({ day, appointments: [a] })
  }
  return groups
}

/** "Hoy", "Mañana" o "lunes 5 oct" para el encabezado de un día (YYYY-MM-DD). */
export function dayHeading(day: string, today = new Date()): string {
  const todayStr = toLocalISODate(today)
  if (day === todayStr) return 'Hoy'
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  if (day === toLocalISODate(tomorrow)) return 'Mañana'
  return new Date(day + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
}
