// Datos del informe de progreso para un periodo (últimos 30/90 días o todo el
// historial): peso de inicio a fin, adherencia frente al periodo anterior,
// señales (hambre, energía, ánimo, digestión) y, solo para el nutricionista, los
// cambios del plan y sus valoraciones semanales. Es lo que luego pinta el PDF
// (printProgressReport); aquí no hay HTML, solo cuentas.
import { DailyCheckin, WeightEntry } from '../types'
import { DietPlanChangeRow } from './supabase-types'
import { toLocalISODate } from './date'
import { calcAdherence } from './adherence'
import { summarizeSignals } from './checkinSignals'
import { weekStartISO } from './weeklyReview'

export type ReportPeriod = '30d' | '90d' | 'all'

export const PERIOD_LABEL: Record<ReportPeriod, string> = { '30d': 'Últimos 30 días', '90d': 'Últimos 90 días', all: 'Todo el historial' }

export interface ReportRange {
  /** Primer día incluido (YYYY-MM-DD). */
  start: string
  /** Último día incluido: hoy. */
  end: string
  days: number
}

export interface ReportReviewInput { week_start: string; status: 'accepted' | 'edited' | 'ignored'; note: string }

export interface ReportInput {
  weights: WeightEntry[]
  checkins: DailyCheckin[]
  planChanges?: DietPlanChangeRow[]
  reviews?: ReportReviewInput[]
}

export interface AverageChange { avg: number | null; prevAvg: number | null }

export interface ReportSummary {
  range: ReportRange
  weight: { startKg: number; endKg: number; changeKg: number; entries: WeightEntry[] } | null
  adherence: { pct: number; prevPct: number | null }
  checkins: { done: number; days: number }
  signals: { hunger: AverageChange; energy: AverageChange; mood: AverageChange; concerningDigestionDays: number; digestionDaysWithData: number } | null
  planChanges: DietPlanChangeRow[]
  /** Valoraciones que el nutricionista escribió con sus palabras (editadas); las aceptadas tal cual son la sugerencia del sistema, no se incluyen. */
  reviewNotes: { weekStart: string; note: string }[]
}

const DAY_MS = 86400000
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const dayDiff = (fromISO: string, to: Date) =>
  Math.round((new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime() - new Date(fromISO + 'T00:00:00').getTime()) / DAY_MS)

export function resolveRange(period: ReportPeriod, today: Date, earliestISO: string | null): ReportRange {
  const end = toLocalISODate(today)
  if (period === 'all') {
    const days = earliestISO ? Math.max(7, dayDiff(earliestISO, today) + 1) : 30
    return { start: toLocalISODate(addDays(today, -(days - 1))), end, days }
  }
  const days = period === '30d' ? 30 : 90
  return { start: toLocalISODate(addDays(today, -(days - 1))), end, days }
}

export function buildReportSummary(input: ReportInput, period: ReportPeriod, today = new Date()): ReportSummary {
  const dates = [...input.weights.map(w => w.date), ...input.checkins.map(c => c.date)].sort()
  const range = resolveRange(period, today, dates[0] ?? null)
  const inRange = (d: string) => d >= range.start && d <= range.end

  const entries = input.weights.filter(w => inRange(w.date)).sort((a, b) => a.date.localeCompare(b.date))
  const weight = entries.length >= 2
    ? {
        startKg: entries[0].weightKg, endKg: entries[entries.length - 1].weightKg,
        changeKg: Math.round((entries[entries.length - 1].weightKg - entries[0].weightKg) * 10) / 10, entries,
      }
    : null

  const periodCheckins = input.checkins.filter(c => inRange(c.date))
  const prevEnd = addDays(today, -range.days)
  const prevStart = toLocalISODate(addDays(prevEnd, -(range.days - 1)))
  const prevHasData = input.checkins.some(c => c.date >= prevStart && c.date <= toLocalISODate(prevEnd))
  const adherence = {
    pct: calcAdherence(input.checkins, range.days, today),
    prevPct: prevHasData ? calcAdherence(input.checkins, range.days, prevEnd) : null,
  }

  const now = summarizeSignals(input.checkins, today, range.days)
  const before = summarizeSignals(input.checkins, prevEnd, range.days)
  const signals = periodCheckins.length === 0 ? null : {
    hunger: { avg: now.hunger.avg, prevAvg: before.days > 0 ? before.hunger.avg : null },
    energy: { avg: now.energy.avg, prevAvg: before.days > 0 ? before.energy.avg : null },
    mood: { avg: now.mood.avg, prevAvg: before.days > 0 ? before.mood.avg : null },
    concerningDigestionDays: now.digestion.concerningDays,
    digestionDaysWithData: now.digestion.daysWithData,
  }

  const planChanges = (input.planChanges ?? [])
    .filter(c => inRange(toLocalISODate(new Date(c.changed_at))))
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at))

  const firstWeek = weekStartISO(new Date(range.start + 'T00:00:00'))
  const reviewNotes = (input.reviews ?? [])
    .filter(r => r.status === 'edited' && r.note.trim() && r.week_start >= firstWeek && r.week_start <= range.end)
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map(r => ({ weekStart: r.week_start, note: r.note.trim() }))

  return { range, weight, adherence, checkins: { done: periodCheckins.length, days: range.days }, signals, planChanges, reviewNotes }
}
