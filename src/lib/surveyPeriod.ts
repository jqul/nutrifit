import { SurveyFrequency } from '../types'

/** Semana ISO 8601 (lunes a domingo), ej. "2026-W33". */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Identificador del periodo actual (o de la fecha dada) para una frecuencia de encuesta. */
export function periodKeyFor(frequency: SurveyFrequency, d: Date = new Date()): string {
  return frequency === 'weekly' ? isoWeekKey(d) : monthKey(d)
}

/** Etiqueta legible de un period_key ya calculado, para mostrar en el historial. */
export function periodLabel(frequency: SurveyFrequency, periodKey: string): string {
  if (frequency === 'monthly') {
    const [y, m] = periodKey.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  }
  const [y, w] = periodKey.split('-W').map(Number)
  // Lunes de esa semana ISO: 4 de enero siempre cae en la semana 1.
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (w - 1) * 7)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `${fmt(monday)} – ${fmt(sunday)}`
}
