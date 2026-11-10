// Pasos del día: el cliente los apunta a mano en su check-in (una app web no puede leerlos del móvil ni del reloj).
// Son un dato informativo para el nutricionista: media de 7 y 30 días y cómo va respecto a la semana anterior.
// No hay objetivo de pasos ni cuenta para la adherencia: un día sin apuntar es un día sin dato, no un día malo.

export const MAX_STEPS = 100000

/**
 * Lo que escribe el cliente → un número de pasos, o null si está vacío o no es válido. Admite los separadores de miles que
 * copiaría de su app de Salud («8.432», «8,432», «8 432») y rechaza decimales, negativos y cifras absurdas (> 100.000).
 */
export function parseSteps(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  let digits: string | null = null
  if (/^\d+$/.test(t)) digits = t
  else if (/^\d{1,3}([.,\s ]\d{3})+$/.test(t)) digits = t.replace(/[.,\s ]/g, '')
  if (digits == null) return null
  const n = Number(digits)
  return n >= 0 && n <= MAX_STEPS ? n : null
}

/** 8432 → «8.432» (con punto de miles también en 4 cifras, que es como lo escribe la gente). */
export function formatSteps(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

interface Day { date: string; steps?: number | null }

const DAY_MS = 86400000
const dayNumber = (iso: string) => Math.round(new Date(iso + 'T00:00:00Z').getTime() / DAY_MS)

export interface StepsAverage { average: number; days: number }

/** Media de los días CON dato en los últimos `windowDays` (contando hoy), y con cuántos días se ha calculado; null si ninguno. */
function averageBetween(checkins: Day[], fromDay: number, toDay: number): StepsAverage | null {
  const values = checkins
    .filter(c => c.steps != null && dayNumber(c.date) >= fromDay && dayNumber(c.date) <= toDay)
    .map(c => c.steps as number)
  if (values.length === 0) return null
  return { average: values.reduce((a, b) => a + b, 0) / values.length, days: values.length }
}

export interface StepsSummary {
  last7: StepsAverage | null
  last30: StepsAverage | null
  /** Media de la semana anterior a la de hoy (los 7 días de antes de los últimos 7). */
  previous7: StepsAverage | null
  /** Cambio de la media de los últimos 7 días frente a los 7 anteriores, solo si ambas tienen al menos 3 días con dato. */
  changeVsPrevious: number | null
}

const MIN_DAYS_TO_COMPARE = 3

export function stepsSummary(checkins: Day[], todayISO: string): StepsSummary {
  const today = dayNumber(todayISO)
  const last7 = averageBetween(checkins, today - 6, today)
  const previous7 = averageBetween(checkins, today - 13, today - 7)
  const enough = last7 && previous7 && last7.days >= MIN_DAYS_TO_COMPARE && previous7.days >= MIN_DAYS_TO_COMPARE
  return {
    last7, previous7, last30: averageBetween(checkins, today - 29, today),
    changeVsPrevious: enough ? last7!.average - previous7!.average : null,
  }
}

/** Los últimos 14 días, del más antiguo a hoy, con los pasos de cada uno (null si ese día no se apuntaron). */
export function lastDaysSeries(checkins: Day[], todayISO: string, days = 14): { date: string; steps: number | null }[] {
  const byDate = new Map(checkins.map(c => [c.date, c.steps ?? null]))
  const today = dayNumber(todayISO)
  return Array.from({ length: days }, (_, i) => {
    const date = new Date((today - (days - 1 - i)) * DAY_MS).toISOString().slice(0, 10)
    return { date, steps: byDate.get(date) ?? null }
  })
}

/** ¿Hay algún día con pasos apuntados? Para no enseñar una tarjeta vacía. */
export const hasSteps = (checkins: Day[]): boolean => checkins.some(c => c.steps != null)
