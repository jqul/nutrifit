// GENERADO por scripts/sync-edge-shared.mjs a partir de src/lib/clientAlerts.ts — NO EDITAR A MANO.
// Alertas por cliente del Centro de control: lo que el semáforo de salud no ve.
// Todas se calculan al vuelo con datos que ya existen (pesajes y check-ins), sin
// tablas nuevas. Son avisos orientativos para decidir a quién mirar, no un
// diagnóstico.
import type { DailyCheckin, WeightEntry } from './types.ts'
import { toLocalISODate } from './date.ts'
import { calcAdherence } from './adherence.ts'
import { summarizeSignals } from './checkinSignals.ts'
import { computeWeightProgress } from './weightProgress.ts'

export type AlertKind = 'weight_stalled' | 'high_hunger' | 'low_energy' | 'low_adherence' | 'no_weigh_in' | 'goal_reached'
/** 'week' = revisar esta semana · 'info' = buena noticia, no pide acción. */
export type AlertPriority = 'week' | 'info'

export interface ClientAlert { kind: AlertKind; priority: AlertPriority; label: string }

export interface AlertInput {
  checkins: DailyCheckin[]
  weights: WeightEntry[]
  goal: string | null
  goalWeightKg: number | null
  createdAt: number
}

export const STALL_WINDOW_DAYS = 21
export const STALL_RANGE_KG = 0.5
export const LOW_ADHERENCE_PCT = 70
export const NO_WEIGH_IN_DAYS = 14

const DAY_MS = 86400000
const fmt1 = (n: number) => n.toFixed(1).replace('.', ',')
const daysBetween = (fromISO: string, to: Date) =>
  Math.round((new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime() - new Date(fromISO + 'T00:00:00').getTime()) / DAY_MS)

export function computeClientAlerts(input: AlertInput, today = new Date()): ClientAlert[] {
  const { checkins, goal, goalWeightKg, createdAt } = input
  const weights = [...input.weights].sort((a, b) => a.date.localeCompare(b.date))
  const ageDays = Math.floor((today.getTime() - createdAt) / DAY_MS)
  const alerts: ClientAlert[] = []

  // ¿Ha alcanzado su peso objetivo? Solo cuenta si había un camino real que recorrer (≥1 kg).
  const goalReached = (() => {
    if (goalWeightKg == null || weights.length < 2) return false
    const initial = weights[0].weightKg, current = weights[weights.length - 1].weightKg
    if (Math.abs(initial - goalWeightKg) < 1) return false
    return computeWeightProgress(initial, current, goalWeightKg).goalReached
  })()

  // Peso estancado: objetivo de perder/ganar y ≥3 pesajes en 3 semanas (abarcando ≥2) sin moverse más de 0,5 kg.
  if ((goal === 'perder_peso' || goal === 'ganar_masa') && !goalReached) {
    const start = new Date(today); start.setDate(start.getDate() - STALL_WINDOW_DAYS)
    const recent = weights.filter(w => w.date >= toLocalISODate(start))
    if (recent.length >= 3 && daysBetween(recent[0].date, today) >= 14) {
      const kgs = recent.map(w => w.weightKg)
      if (Math.max(...kgs) - Math.min(...kgs) <= STALL_RANGE_KG) {
        alerts.push({ kind: 'weight_stalled', priority: 'week', label: 'Peso estancado 3 semanas' })
      }
    }
  }

  const signals = summarizeSignals(checkins, today)
  if (signals.days >= 3 && signals.hunger.tone === 'warn' && signals.hunger.avg != null) {
    alerts.push({ kind: 'high_hunger', priority: 'week', label: `Hambre alta (${fmt1(signals.hunger.avg)}/5)` })
  }
  if (signals.days >= 3 && signals.energy.tone === 'warn' && signals.energy.avg != null) {
    alerts.push({ kind: 'low_energy', priority: 'week', label: `Energía baja (${fmt1(signals.energy.avg)}/5)` })
  }

  // Adherencia baja: solo si hay actividad esta semana (sin ninguna, ya avisa "sin check-in").
  const adherence = calcAdherence(checkins, 7, today)
  if (ageDays >= 7 && signals.days >= 1 && adherence < LOW_ADHERENCE_PCT) {
    alerts.push({ kind: 'low_adherence', priority: 'week', label: `Adherencia ${adherence}% esta semana` })
  }

  // Sin pesar: no se avisa a un cliente recién dado de alta.
  if (ageDays > NO_WEIGH_IN_DAYS) {
    const last = weights[weights.length - 1]
    const since = last ? daysBetween(last.date, today) : null
    if (since == null) alerts.push({ kind: 'no_weigh_in', priority: 'week', label: 'Sin pesajes registrados' })
    else if (since > NO_WEIGH_IN_DAYS) alerts.push({ kind: 'no_weigh_in', priority: 'week', label: `Sin registrar peso hace ${since}d` })
  }

  if (goalReached) alerts.push({ kind: 'goal_reached', priority: 'info', label: 'Objetivo alcanzado' })

  return alerts
}
