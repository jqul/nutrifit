// GENERADO por scripts/sync-edge-shared.mjs a partir de src/lib/checkinSignals.ts — NO EDITAR A MANO.
// "Señales" de la pestaña Seguimiento (UX-20): resumen de la última semana de
// check-ins en cuatro lecturas — hambre, energía, ánimo y digestión — cada una
// con un tono tipo semáforo, para ver de un vistazo qué merece atención sin
// leer check-in por check-in. Son umbrales orientativos, no un diagnóstico.
import type { DailyCheckin } from './types.ts'
import { toLocalISODate } from './date.ts'

export type SignalTone = 'good' | 'warn' | 'neutral'

export interface Signal { avg: number | null; tone: SignalTone }

export interface CheckinSignals {
  /** Check-ins que caen dentro de la ventana. */
  days: number
  hunger: Signal
  energy: Signal
  mood: Signal
  digestion: { daysWithData: number; concerningDays: number; tone: SignalTone }
}

/** Una digestión preocupante: heces muy duras/líquidas (Bristol ≤2 o ≥6), hinchazón o dolor abdominal moderados o más. */
export function isConcerningCheckin(c: DailyCheckin): boolean {
  return (c.bristolScale != null && (c.bristolScale <= 2 || c.bristolScale >= 6))
    || (c.bloating != null && c.bloating >= 2) || (c.abdominalPain != null && c.abdominalPain >= 2)
}

const round1 = (n: number) => Math.round(n * 10) / 10

function average(values: number[]): number | null {
  return values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null
}

// Energía y ánimo (escala 1-5): alto es bueno, bajo pide atención.
function moodLikeTone(avg: number | null): SignalTone {
  if (avg == null) return 'neutral'
  if (avg >= 3.5) return 'good'
  if (avg < 2.5) return 'warn'
  return 'neutral'
}

// Hambre (escala 1-5): muy alta de forma sostenida es lo que preocupa.
function hungerTone(avg: number | null): SignalTone {
  if (avg == null) return 'neutral'
  if (avg >= 4) return 'warn'
  if (avg >= 2 && avg <= 3.5) return 'good'
  return 'neutral'
}

export function summarizeSignals(checkins: DailyCheckin[], today = new Date(), windowDays = 7): CheckinSignals {
  const start = new Date(today); start.setDate(start.getDate() - (windowDays - 1))
  const startStr = toLocalISODate(start)
  const endStr = toLocalISODate(today)
  const inWindow = checkins.filter(c => c.date >= startStr && c.date <= endStr)

  const hungerAvg = average(inWindow.map(c => c.hunger))
  const energyAvg = average(inWindow.map(c => c.energy))
  const moodAvg = average(inWindow.map(c => c.mood))

  const withDigestion = inWindow.filter(c => c.bristolScale != null || c.bloating != null || c.abdominalPain != null)
  const concerningDays = withDigestion.filter(isConcerningCheckin).length
  const digestionTone: SignalTone = withDigestion.length === 0 ? 'neutral' : concerningDays === 0 ? 'good' : concerningDays === 1 ? 'neutral' : 'warn'

  return {
    days: inWindow.length,
    hunger: { avg: hungerAvg, tone: hungerTone(hungerAvg) },
    energy: { avg: energyAvg, tone: moodLikeTone(energyAvg) },
    mood: { avg: moodAvg, tone: moodLikeTone(moodAvg) },
    digestion: { daysWithData: withDigestion.length, concerningDays, tone: digestionTone },
  }
}
