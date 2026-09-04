// Línea de Vida Clínica (HealthTimeline): unifica en un único eje
// cronológico todos los eventos de salud del cliente — analíticas, pesajes,
// fotos de progreso, notas clínicas del profesional e hitos de racha/diario
// de comidas — para que tanto el nutricionista (Seguimiento) como el propio
// cliente (Progreso) tengan una narrativa de un vistazo en vez de tener que
// cruzar varias secciones sueltas.
//
// Este módulo solo construye la lista de eventos y los agrupa por mes; el
// renderizado vive en components/shared/HealthTimeline.tsx.

import { WeightEntry, ProgressPhotoSession, MealLog, DailyCheckin, ClinicalNote } from '../types'
import { BloodMarkerRow } from './supabase-types'
import { BLOOD_MARKER_MAP, evaluateMarker, BloodMarkerDef, MarkerStatus } from './bloodMarkers'

export type TimelineEventType = 'analitica' | 'peso' | 'foto' | 'nota' | 'hito'

interface BaseEvent { id: string; date: string }

export interface AnaliticaEvent extends BaseEvent {
  type: 'analitica'
  markers: { def: BloodMarkerDef; value: number; status: MarkerStatus }[]
}
export interface PesoEvent extends BaseEvent {
  type: 'peso'
  weightKg: number
  deltaKg: number | null
}
export interface FotoEvent extends BaseEvent {
  type: 'foto'
  session: ProgressPhotoSession
}
export interface NotaEvent extends BaseEvent {
  type: 'nota'
  note: string
}
export interface HitoEvent extends BaseEvent {
  type: 'hito'
  label: string
  icon: string
}

export type TimelineEvent = AnaliticaEvent | PesoEvent | FotoEvent | NotaEvent | HitoEvent

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Hitos de racha: cada vez que una tanda de check-ins consecutivos alcanza
 * un múltiplo de 7 días se marca un hito en el día en que se alcanzó — no
 * en todos los días de la tanda, para no saturar el feed con repeticiones. */
function streakMilestones(checkins: DailyCheckin[]): HitoEvent[] {
  const dates = [...new Set(checkins.map(c => c.date))].sort()
  const milestones: HitoEvent[] = []
  let runLength = 0
  let prevDate: Date | null = null
  for (const dateStr of dates) {
    const d = new Date(dateStr + 'T00:00:00')
    if (prevDate) {
      const expected = new Date(prevDate)
      expected.setDate(expected.getDate() + 1)
      runLength = toDateOnly(expected) === dateStr ? runLength + 1 : 1
    } else {
      runLength = 1
    }
    if (runLength % 7 === 0) {
      milestones.push({
        id: `hito-racha-${dateStr}`, type: 'hito', date: dateStr,
        label: `${runLength} días seguidos de seguimiento`, icon: '🔥',
      })
    }
    prevDate = d
  }
  return milestones
}

/** Hitos del diario de comidas: un evento por día con comidas registradas
 * resumiendo qué platos se apuntaron ese día — no uno por plato, para que
 * un usuario muy activo no llene el feed de entradas casi idénticas. */
function mealMilestones(mealLogs: MealLog[]): HitoEvent[] {
  const byDate = new Map<string, MealLog[]>()
  for (const m of mealLogs) {
    const list = byDate.get(m.date) || []
    list.push(m)
    byDate.set(m.date, list)
  }
  return [...byDate.entries()].map(([date, logs]) => ({
    id: `hito-comidas-${date}`, type: 'hito' as const, date,
    label: `${logs.length} comida${logs.length > 1 ? 's' : ''} registrada${logs.length > 1 ? 's' : ''}: ${logs.map(l => l.mealName).join(', ')}`,
    icon: '🍽️',
  }))
}

export function buildHealthTimeline({ weights, bloodMarkers, photos, clinicalNotes, mealLogs, checkins }: {
  weights: WeightEntry[]
  bloodMarkers: BloodMarkerRow[]
  photos: ProgressPhotoSession[]
  clinicalNotes: ClinicalNote[]
  mealLogs: MealLog[]
  checkins: DailyCheckin[]
}): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Analíticas: agrupadas por fecha de extracción (una tarjeta por visita al laboratorio).
  const markersByDate = new Map<string, BloodMarkerRow[]>()
  for (const m of bloodMarkers) {
    const list = markersByDate.get(m.date) || []
    list.push(m)
    markersByDate.set(m.date, list)
  }
  for (const [date, rows] of markersByDate) {
    const markers = rows
      .filter(r => BLOOD_MARKER_MAP[r.marker_key])
      .map(r => {
        const def = BLOOD_MARKER_MAP[r.marker_key]
        return { def, value: r.value, status: evaluateMarker(def, r.value) }
      })
    if (markers.length > 0) events.push({ id: `analitica-${date}`, type: 'analitica', date, markers })
  }

  // Peso: ordenado ascendente para poder calcular el delta vs. la lectura anterior.
  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  sortedWeights.forEach((w, i) => {
    const prev = i > 0 ? sortedWeights[i - 1].weightKg : null
    events.push({
      id: `peso-${w.id}`, type: 'peso', date: w.date, weightKg: w.weightKg,
      deltaKg: prev != null ? Math.round((w.weightKg - prev) * 100) / 100 : null,
    })
  })

  for (const s of photos) events.push({ id: `foto-${s.id}`, type: 'foto', date: s.date, session: s })
  for (const n of clinicalNotes) events.push({ id: `nota-${n.id}`, type: 'nota', date: n.date, note: n.note })
  events.push(...streakMilestones(checkins), ...mealMilestones(mealLogs))

  return events.sort((a, b) => b.date.localeCompare(a.date))
}

const MONTH_LABELS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export interface TimelineMonthGroup { key: string; label: string; events: TimelineEvent[] }

/** Agrupa por mes (más reciente primero) para el eje vertical del feed. */
export function groupTimelineByMonth(events: TimelineEvent[]): TimelineMonthGroup[] {
  const groups = new Map<string, TimelineEvent[]>()
  for (const e of events) {
    const [y, m] = e.date.split('-')
    const key = `${y}-${m}`
    const list = groups.get(key) || []
    list.push(e)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, evs]) => {
      const [y, m] = key.split('-')
      return { key, label: `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`, events: evs }
    })
}
