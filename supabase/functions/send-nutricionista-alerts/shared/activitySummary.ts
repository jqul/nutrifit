// GENERADO por scripts/sync-edge-shared.mjs a partir de src/lib/activitySummary.ts — NO EDITAR A MANO.
// Resumen de actividad por cliente (función SQL clients_activity_summary): su
// último check-in y su primer y último pesaje. Sirve para no tener que traer TODO
// el historial de cada cliente solo para saber cuándo fue lo último o qué peso
// tenía al empezar: se piden solo los últimos días y estos tres datos aparte.
// Sin dependencias de la app salvo tipos: lo copian las funciones programadas.
import type { WeightEntry } from './types.ts'

export interface ActivitySummary {
  client_id: string
  last_checkin: string | null
  last_weigh_in: string | null
  first_weigh_in: string | null
  first_weight_kg: number | string | null
  last_weight_kg: number | string | null
}

/** Ventana de historial que se pide además del resumen. */
export const HISTORY_WINDOW_DAYS = 120

const num = (v: number | string | null): number | null => (v == null ? null : Number(v))

/**
 * Los pesajes recientes (ventana) más el primero y el último de la historia, si
 * quedan fuera de ella. Los cálculos que dependen del primer peso (objetivo
 * alcanzado, cambio total) o del último (cuánto hace que no se pesa) ven así la
 * verdad aunque el cliente lleve meses sin pesarse o empezara hace un año.
 */
export function weightsWithBounds(clientId: string, windowWeights: WeightEntry[], summary?: ActivitySummary | null): WeightEntry[] {
  const out = [...windowWeights]
  const has = (date: string) => out.some(w => w.date === date)
  const add = (date: string | null, kg: number | string | null, tag: string) => {
    const weightKg = num(kg)
    if (date && weightKg != null && !has(date)) out.push({ id: `${clientId}-${tag}`, clientId, date, weightKg, note: '' })
  }
  if (summary) {
    add(summary.first_weigh_in, summary.first_weight_kg, 'first')
    add(summary.last_weigh_in, summary.last_weight_kg, 'last')
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** El más reciente de dos fechas YYYY-MM-DD (cualquiera puede faltar). */
export function latestDate(a?: string | null, b?: string | null): string | undefined {
  return [a, b].filter((d): d is string => !!d).sort().pop()
}
