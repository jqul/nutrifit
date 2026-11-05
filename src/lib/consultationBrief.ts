// «Preparar la consulta»: lo que ha cambiado en un cliente desde la última vez que lo viste, en una página, para empezar la
// consulta sabiendo de qué hablar. Todo sale de datos que ya existen (peso, medidas, check-ins, analíticas, fases, cambios del
// plan, notas) con reglas sencillas: no hay IA ni diagnóstico, solo una lista de cosas que merece la pena mirar.
import { DailyCheckin, WeightEntry } from '../types'
import { BloodMarkerRow, DietPlanChangeRow } from './supabase-types'
import { BLOOD_MARKER_MAP, evaluateMarker, MarkerStatus } from './bloodMarkers'
import { ClientAlert } from './clientAlerts'
import { CheckinSignals, summarizeSignals } from './checkinSignals'
import { MetricDefinition, MetricValue, formatMetricDelta, formatMetricValue } from './bodyMetrics'
import { MonthAdherence, adherenceBetween, adherenceTrend, monthlyAdherence } from './adherenceHistory'
import { PlanPhase, addDays, daysBetween, phaseReview, summarizePhases } from './planPhases'
import { formatPlanChange } from './planChanges'

/** Sin una consulta anterior registrada, se mira este tramo. */
export const DEFAULT_WINDOW_DAYS = 28

export interface BriefInput {
  client: { goal: string | null; goalWeightKg: number | null; createdAt: number }
  todayISO: string
  /** Fecha (YYYY-MM-DD) de la última consulta ya hecha, si se conoce. */
  lastConsultationISO: string | null
  weights: Pick<WeightEntry, 'date' | 'weightKg'>[]
  checkins: DailyCheckin[]
  bloodMarkers: BloodMarkerRow[]
  metricDefs: MetricDefinition[]
  metricValues: Pick<MetricValue, 'metricId' | 'date' | 'value'>[]
  planChanges: DietPlanChangeRow[]
  clinicalNotes: { date: string; note: string }[]
  phases: PlanPhase[]
  alerts: ClientAlert[]
}

export interface BriefMeasurement { name: string; unit: string; latest: number; latestDate: string; delta: number | null }
export interface BriefLab { label: string; unit: string; value: number; date: string; status: Exclude<MarkerStatus, 'normal'>; isNew: boolean }

export interface ConsultationBrief {
  /** Desde cuándo se compara (YYYY-MM-DD). */
  since: string
  /** Si `since` es la fecha de la última consulta o el tramo por defecto. */
  fromLastConsultation: boolean
  daysSince: number
  weight: { baselineKg: number; baselineDate: string; latestKg: number; latestDate: string; deltaKg: number; goalKg: number | null; remainingKg: number | null } | null
  measurements: BriefMeasurement[]
  adherence: { last7: number; sincePct: number | null; months: MonthAdherence[]; trend: 'up' | 'down' | 'flat' | null }
  signals: CheckinSignals
  checkinsSince: number
  alerts: ClientAlert[]
  labs: BriefLab[]
  planChanges: { date: string; text: string }[]
  phase: { name: string; position: number; total: number; daysLeft: number } | null
  phaseReviewText: string | null
  notes: { date: string; note: string }[]
  talkingPoints: string[]
}

const fmt1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt1(Math.abs(n))}`

/** El valor de una serie en la fecha de referencia: el último de antes (o del mismo día) y, si no hay, el primero de después. */
function baselineOf<T extends { date: string }>(sorted: T[], since: string): T | null {
  const before = sorted.filter(p => p.date <= since)
  return before.length ? before[before.length - 1] : sorted[0] ?? null
}

export function buildConsultationBrief(input: BriefInput): ConsultationBrief {
  const { todayISO } = input
  const fromLast = input.lastConsultationISO != null && input.lastConsultationISO < todayISO
  const since = fromLast ? input.lastConsultationISO! : addDays(todayISO, -DEFAULT_WINDOW_DAYS)
  const daysSince = daysBetween(since, todayISO)

  // Peso: del último pesaje anterior a `since` (o el primero del tramo) al último.
  const w = [...input.weights].sort((a, b) => a.date.localeCompare(b.date))
  let weight: ConsultationBrief['weight'] = null
  if (w.length >= 2) {
    const base = baselineOf(w, since)!
    const latest = w[w.length - 1]
    if (base.date !== latest.date) {
      weight = {
        baselineKg: base.weightKg, baselineDate: base.date, latestKg: latest.weightKg, latestDate: latest.date,
        deltaKg: Math.round((latest.weightKg - base.weightKg) * 10) / 10,
        goalKg: input.client.goalWeightKg,
        remainingKg: input.client.goalWeightKg != null ? Math.round(Math.abs(latest.weightKg - input.client.goalWeightKg) * 10) / 10 : null,
      }
    }
  }

  // Medidas: lo último de cada métrica y su cambio desde la referencia.
  const measurements: BriefMeasurement[] = []
  for (const def of [...input.metricDefs].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const series = input.metricValues.filter(v => v.metricId === def.id).sort((a, b) => a.date.localeCompare(b.date))
    if (series.length === 0) continue
    const latest = series[series.length - 1]
    const base = baselineOf(series, since)!
    measurements.push({ name: def.name, unit: def.unit, latest: latest.value, latestDate: latest.date, delta: base.date === latest.date ? null : Math.round((latest.value - base.value) * 100) / 100 })
  }

  // Adherencia y señales.
  const startISO = new Date(input.client.createdAt).toISOString().slice(0, 10)
  const months = monthlyAdherence(input.checkins, todayISO, { months: 6, startDate: startISO })
  const last7 = adherenceBetween(input.checkins, addDays(todayISO, -6), todayISO)?.pct ?? 0
  const sinceAdh = adherenceBetween(input.checkins, since > startISO ? since : startISO, todayISO)
  const today = new Date(`${todayISO}T12:00:00`)
  const signals = summarizeSignals(input.checkins, today)
  const checkinsSince = input.checkins.filter(c => c.date >= since && c.date <= todayISO).length

  // Analíticas fuera de rango (la lectura más reciente de cada marcador).
  const latestByKey = new Map<string, BloodMarkerRow>()
  for (const r of input.bloodMarkers) {
    const cur = latestByKey.get(r.marker_key)
    if (!cur || r.date > cur.date) latestByKey.set(r.marker_key, r)
  }
  const labs: BriefLab[] = []
  for (const r of latestByKey.values()) {
    const def = BLOOD_MARKER_MAP[r.marker_key]
    if (!def) continue
    const status = evaluateMarker(def, Number(r.value))
    if (status !== 'normal') labs.push({ label: def.label, unit: def.unit, value: Number(r.value), date: r.date, status, isNew: r.date >= since })
  }
  labs.sort((a, b) => Number(b.isNew) - Number(a.isNew) || a.label.localeCompare(b.label, 'es'))

  // Plan, fase y notas desde la referencia.
  const planChanges = input.planChanges
    .filter(c => c.changed_at.slice(0, 10) >= since)
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at))
    .map(c => ({ date: c.changed_at.slice(0, 10), text: `${c.changes.map(formatPlanChange).join(' · ')}${c.reason ? ` — ${c.reason}` : ''}` }))
  const ps = summarizePhases(input.phases, todayISO)
  const phase = ps.current && ps.position != null && ps.daysLeft != null ? { name: ps.current.name, position: ps.position, total: ps.total, daysLeft: ps.daysLeft } : null
  const phaseReviewText = phaseReview(input.phases, todayISO)?.text ?? null
  const notes = input.clinicalNotes.filter(n => n.date >= since).sort((a, b) => b.date.localeCompare(a.date))

  const brief: ConsultationBrief = {
    since, fromLastConsultation: fromLast, daysSince, weight, measurements,
    adherence: { last7, sincePct: sinceAdh?.pct ?? null, months, trend: adherenceTrend(months) },
    signals, checkinsSince, alerts: input.alerts, labs, planChanges, phase, phaseReviewText, notes, talkingPoints: [],
  }
  brief.talkingPoints = talkingPoints(brief, input.client.goal)
  return brief
}

/** Las cosas que merece la pena mirar, por reglas sencillas y en orden de importancia. */
export function talkingPoints(b: ConsultationBrief, goal: string | null): string[] {
  const points: string[] = []

  if (b.checkinsSince === 0 && b.daysSince >= 3) points.push(`No ha hecho ningún check-in en estos ${b.daysSince} días: pregúntale cómo lo ha llevado.`)
  else if (b.signals.days === 0 && b.checkinsSince > 0) points.push('Sin check-ins esta última semana.')

  if (b.weight && b.daysSince >= 14) {
    const perWeek = b.weight.deltaKg / (daysBetween(b.weight.baselineDate, b.weight.latestDate) / 7 || 1)
    if (goal === 'perder_peso') {
      if (b.weight.deltaKg >= 0) points.push(`Quiere perder peso y no ha bajado (${signed(b.weight.deltaKg)} kg): revisa adherencia, medidas y si el plan sigue siendo adecuado.`)
      else if (Math.abs(perWeek) > 1) points.push(`Está perdiendo rápido (${fmt1(Math.abs(perWeek))} kg a la semana): valora si es sostenible.`)
    } else if (goal === 'ganar_masa' && b.weight.deltaKg <= 0) {
      points.push(`Busca ganar masa y no ha subido (${signed(b.weight.deltaKg)} kg): valora subir kcal.`)
    }
  }

  const pct = b.adherence.sincePct
  if (pct != null && b.daysSince >= 7 && pct < 70) points.push(`Adherencia baja en este tramo (${pct} %).`)
  if (b.adherence.trend === 'down') points.push('La adherencia ha bajado respecto al mes anterior.')

  for (const a of b.alerts.filter(a => a.priority === 'week')) points.push(`Aviso: ${a.label}.`)

  const newLabs = b.labs.filter(l => l.isNew)
  if (newLabs.length > 0) points.push(`Analítica nueva con valores fuera de rango: ${newLabs.map(l => `${l.label} (${l.status})`).join(', ')}.`)

  if (b.phaseReviewText) points.push(b.phaseReviewText)
  if (b.planChanges.length > 0) points.push(`Has cambiado el plan ${b.planChanges.length === 1 ? 'una vez' : `${b.planChanges.length} veces`} desde entonces: comenta cómo le ha ido.`)

  const shrinking = b.measurements.filter(m => m.delta != null && m.delta < 0 && (m.unit === 'cm' || m.unit === '%'))
  if (shrinking.length > 0 && b.weight && Math.abs(b.weight.deltaKg) < 0.5) {
    points.push(`El peso está estable pero ${shrinking.map(m => `${m.name.toLowerCase()} ${formatMetricDelta(m.delta!, m.unit)}`).join(' y ')}: buena señal para contárselo.`)
  }

  return points.slice(0, 8)
}

/** Línea corta de una medida: «Cintura 79,5 cm (−2,5 cm)». */
export function describeMeasurement(m: BriefMeasurement): string {
  return `${m.name} ${formatMetricValue(m.latest, m.unit)}${m.delta != null ? ` (${formatMetricDelta(m.delta, m.unit)})` : ''}`
}
