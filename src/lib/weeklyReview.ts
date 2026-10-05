// Revisión semanal sugerida: un resumen de los últimos 7 días de un cliente
// frente a los 7 anteriores, con una sugerencia que el nutricionista acepta,
// edita o ignora. Se genera al vuelo con pesajes y check-ins; solo la decisión
// del nutricionista se guarda (tabla client_reviews). Es una ayuda para decidir
// qué mirar, no un criterio clínico: la sugerencia siempre es editable.
import { DailyCheckin, WeightEntry } from '../types'
import { toLocalISODate } from './date'
import { calcAdherence } from './adherence'
import { summarizeSignals } from './checkinSignals'
import { weightDeltaTone, formatWeightDelta, summarizeWeight } from './clientListSummary'
import { computeClientAlerts } from './clientAlerts'

export type ReviewTone = 'good' | 'warn' | 'neutral'
export type ReviewItemKey = 'checkins' | 'weight' | 'adherence' | 'hunger' | 'energy' | 'digestion'
export type ReviewStatus = 'accepted' | 'edited' | 'ignored'

export interface ReviewItem {
  key: ReviewItemKey
  label: string
  value: string
  /** Comparación con la semana anterior u otro matiz; null si no hay con qué comparar. */
  detail: string | null
  tone: ReviewTone
}

export interface WeeklyReview {
  /** Lunes de la semana en curso (YYYY-MM-DD): la clave con la que se guarda la decisión. */
  weekStart: string
  hasData: boolean
  items: ReviewItem[]
  suggestion: string
}

export interface ReviewInput {
  checkins: DailyCheckin[]
  weights: WeightEntry[]
  goal: string | null
  goalWeightKg: number | null
  createdAt: number
}

const DAY_MS = 86400000
const fmt1 = (n: number) => n.toFixed(1).replace('.', ',')
const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits).replace('.', ',')}`

// El tono de peso de la lista de Clientes usa 'bad'; aquí el semáforo es good / warn / neutral.
const weightTone = (goal: string | null, deltaKg: number): ReviewTone => {
  const t = weightDeltaTone(goal, deltaKg)
  return t === 'bad' ? 'warn' : t
}

/** Lunes de la semana de esa fecha, en formato local YYYY-MM-DD. */
export function weekStartISO(d: Date): string {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  return toLocalISODate(date)
}

/** ¿Tiene el cliente actividad reciente como para merecer una revisión esta semana? */
export function isReviewable(client: { lastCheckin?: string }, today = new Date()): boolean {
  if (!client.lastCheckin) return false
  const last = new Date(client.lastCheckin + 'T00:00:00').getTime()
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.round((now - last) / DAY_MS) <= 14
}

/**
 * Clientes con actividad reciente cuya revisión de esta semana aún no está
 * hecha. El orden respeta el que ya traigan (el Centro de control los pasa
 * ordenados por urgencia).
 */
export function pendingReviews<T extends { id: string; lastCheckin?: string }>(
  clients: T[], reviewedClientIds: Set<string>, today = new Date(),
): T[] {
  return clients.filter(c => isReviewable(c, today) && !reviewedClientIds.has(c.id))
}

export function buildWeeklyReview(input: ReviewInput, today = new Date()): WeeklyReview {
  const { checkins, goal } = input
  const weights = [...input.weights].sort((a, b) => a.date.localeCompare(b.date))
  const prevDay = new Date(today); prevDay.setDate(prevDay.getDate() - 7)

  const now = summarizeSignals(checkins, today)
  const before = summarizeSignals(checkins, prevDay)
  const adherenceNow = calcAdherence(checkins, 7, today)
  const adherencePrev = calcAdherence(checkins, 7, prevDay)

  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 13)
  const weightsLast2w = weights.filter(w => w.date >= toLocalISODate(weekAgo))
  const hasData = now.days > 0 || before.days > 0 || weightsLast2w.length > 0

  const items: ReviewItem[] = []

  items.push({
    key: 'checkins', label: 'Check-ins', value: `${now.days}/7`, tone: now.days >= 5 ? 'good' : now.days <= 2 ? 'warn' : 'neutral',
    detail: before.days > 0 ? `${before.days}/7 la semana anterior` : null,
  })

  const w14 = summarizeWeight(weights, today, 13)
  if (w14 && w14.deltaKg != null) {
    items.push({
      key: 'weight', label: 'Peso', value: formatWeightDelta(w14.deltaKg), tone: weightTone(goal, w14.deltaKg),
      detail: `en las últimas 2 semanas · ahora ${fmt1(w14.latestKg)} kg`,
    })
  } else {
    items.push({ key: 'weight', label: 'Peso', value: 'Sin datos', tone: 'neutral', detail: 'menos de 2 pesajes en 2 semanas' })
  }

  if (now.days === 0) {
    items.push({ key: 'adherence', label: 'Adherencia', value: '—', tone: 'neutral', detail: null })
  } else {
    items.push({
      key: 'adherence', label: 'Adherencia', value: `${adherenceNow}%`,
      tone: adherenceNow >= 85 ? 'good' : adherenceNow < 70 ? 'warn' : 'neutral',
      detail: before.days > 0 ? `${signed(adherenceNow - adherencePrev, 0)} pts vs semana anterior` : null,
    })
  }

  const hungerDelta = now.hunger.avg != null && before.hunger.avg != null ? Math.round((now.hunger.avg - before.hunger.avg) * 10) / 10 : null
  items.push({
    key: 'hunger', label: 'Hambre', value: now.hunger.avg == null ? '—' : `${fmt1(now.hunger.avg)}/5`,
    tone: now.hunger.avg == null ? 'neutral' : now.hunger.tone === 'warn' || (hungerDelta != null && hungerDelta >= 1) ? 'warn' : now.hunger.tone,
    detail: hungerDelta != null ? `${signed(hungerDelta)} vs semana anterior` : null,
  })

  const energyDelta = now.energy.avg != null && before.energy.avg != null ? Math.round((now.energy.avg - before.energy.avg) * 10) / 10 : null
  items.push({
    key: 'energy', label: 'Energía', value: now.energy.avg == null ? '—' : `${fmt1(now.energy.avg)}/5`,
    tone: now.energy.avg == null ? 'neutral' : now.energy.tone === 'warn' || (energyDelta != null && energyDelta <= -1) ? 'warn' : now.energy.tone,
    detail: energyDelta != null ? `${signed(energyDelta)} vs semana anterior` : null,
  })

  const dig = now.digestion
  items.push({
    key: 'digestion', label: 'Digestión',
    value: dig.daysWithData === 0 ? '—' : dig.concerningDays === 0 ? 'Sin molestias' : `${dig.concerningDays} día${dig.concerningDays === 1 ? '' : 's'} con molestias`,
    tone: dig.tone, detail: null,
  })

  return { weekStart: weekStartISO(today), hasData, items, suggestion: suggestionFor(input, now, adherenceNow, hungerDelta, today) }
}

function suggestionFor(
  input: ReviewInput, now: ReturnType<typeof summarizeSignals>, adherence: number, hungerDelta: number | null, today: Date,
): string {
  const alerts = computeClientAlerts(input, today)
  const has = (kind: string) => alerts.some(a => a.kind === kind)

  if (has('goal_reached')) return 'Objetivo alcanzado: valorar pasar a una fase de mantenimiento.'
  if (now.days === 0) return 'Sin check-ins esta semana: ponte en contacto antes de valorar cambios en el plan.'

  const parts: string[] = []
  if (adherence < 70) parts.push('Adherencia baja: trabajar la adherencia antes de modificar el plan.')
  if (has('weight_stalled')) {
    parts.push(adherence >= 80
      ? 'Adherencia alta y peso estancado: valorar ajustar las calorías.'
      : 'Peso estancado con adherencia irregular: revisar la adherencia antes de ajustar las calorías.')
  }
  if (now.hunger.tone === 'warn' || (hungerDelta != null && hungerDelta >= 1)) {
    parts.push('Hambre en aumento: valorar mantener las calorías y revisar el reparto de las comidas antes de modificar el plan.')
  }
  if (now.energy.tone === 'warn') parts.push('Energía baja: revisar descanso, hidratación y reparto de hidratos.')
  if (now.digestion.concerningDays >= 2) parts.push('Molestias digestivas repetidas: revisar tolerancias y valorar consultarlo con su médico.')
  if (has('no_weigh_in')) parts.push('Pídele que registre su peso para poder valorar la evolución.')

  return parts.length > 0 ? parts.slice(0, 2).join(' ') : 'Buena semana: mantener el plan.'
}
