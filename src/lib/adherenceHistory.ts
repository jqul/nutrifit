// Adherencia mes a mes. calcAdherence (adherence.ts) solo mira los últimos 7 o 30 días; para preparar una consulta hace falta
// ver cómo ha ido en los últimos meses. Mismo criterio que allí: un día cuenta si hay check-in y no dice «no seguí el plan».
import { daysBetween } from './planPhases'

export interface AdherenceDay { date: string; followedPlan: string }

export interface MonthAdherence {
  /** YYYY-MM. */
  month: string
  /** «sep 2026». */
  label: string
  pct: number
  /** Días del mes que cuentan (desde que el cliente empezó hasta hoy). */
  daysCounted: number
  /** Días con check-in dentro de esos días. */
  checkinDays: number
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const iso = (y: number, m0: number, d: number) => `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/**
 * La adherencia de cada uno de los últimos `months` meses (el actual, hasta hoy), de más antiguo a más reciente. Un mes solo
 * cuenta desde `startDate` (el día que el cliente empezó: si no, sus meses anteriores saldrían a 0 %); sin `startDate` se usa
 * su primer check-in. Los meses sin ningún día que contar se omiten.
 */
export function monthlyAdherence(checkins: AdherenceDay[], todayISO: string, opts: { months?: number; startDate?: string | null } = {}): MonthAdherence[] {
  const months = opts.months ?? 6
  const dates = checkins.map(c => c.date).sort()
  const start = opts.startDate ?? dates[0] ?? null
  if (!start) return []
  const [ty, tm] = todayISO.split('-').map(Number)
  const out: MonthAdherence[] = []
  for (let i = months - 1; i >= 0; i--) {
    const y = ty + Math.floor((tm - 1 - i) / 12)
    const m0 = (((tm - 1 - i) % 12) + 12) % 12
    const monthStart = iso(y, m0, 1)
    const lastDay = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()
    const monthEnd = iso(y, m0, lastDay)
    const from = monthStart > start ? monthStart : start
    const to = monthEnd < todayISO ? monthEnd : todayISO
    if (from > to) continue
    const daysCounted = daysBetween(from, to) + 1
    const inWindow = checkins.filter(c => c.date >= from && c.date <= to)
    const byDate = new Map(inWindow.map(c => [c.date, c]))
    const adherent = [...byDate.values()].filter(c => c.followedPlan !== 'no').length
    out.push({
      month: `${y}-${String(m0 + 1).padStart(2, '0')}`, label: `${MONTHS[m0]} ${y}`,
      pct: Math.round((adherent / daysCounted) * 100), daysCounted, checkinDays: byDate.size,
    })
  }
  return out
}

/** Adherencia en un tramo de fechas (ambas incluidas): el mismo criterio que arriba, para «desde la última consulta». */
export function adherenceBetween(checkins: AdherenceDay[], fromISO: string, toISO: string): { pct: number; daysCounted: number } | null {
  if (fromISO > toISO) return null
  const daysCounted = daysBetween(fromISO, toISO) + 1
  const byDate = new Map(checkins.filter(c => c.date >= fromISO && c.date <= toISO).map(c => [c.date, c]))
  const adherent = [...byDate.values()].filter(c => c.followedPlan !== 'no').length
  return { pct: Math.round((adherent / daysCounted) * 100), daysCounted }
}

export type AdherenceTrend = 'up' | 'down' | 'flat'

/** Sube o baja si los dos últimos meses se separan 10 puntos o más; si no, estable. null con menos de dos meses. */
export function adherenceTrend(months: Pick<MonthAdherence, 'pct'>[]): AdherenceTrend | null {
  if (months.length < 2) return null
  const diff = months[months.length - 1].pct - months[months.length - 2].pct
  return diff >= 10 ? 'up' : diff <= -10 ? 'down' : 'flat'
}

