// Línea de Vida Clínica (HealthTimeline): unifica en un único eje
// cronológico todos los eventos de salud del cliente — analíticas, pesajes,
// fotos de progreso, notas clínicas del profesional, comidas del diario e
// hitos de racha — para que tanto el nutricionista (Seguimiento) como el
// propio cliente (Progreso) tengan una narrativa de un vistazo en vez de
// tener que cruzar varias secciones sueltas.
//
// Este módulo solo construye la lista de eventos y los agrupa por mes; el
// renderizado vive en components/shared/HealthTimeline.tsx.

import { WeightEntry, ProgressPhotoSession, MealLog, DailyCheckin, ClinicalNote } from '../types'
import { BloodMarkerRow } from './supabase-types'
import { BLOOD_MARKER_MAP, evaluateMarker, BloodMarkerDef, MarkerStatus } from './bloodMarkers'

export type TimelineEventType = 'analitica' | 'peso' | 'foto' | 'nota' | 'comida' | 'hito'

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
export interface ComidaEvent extends BaseEvent {
  type: 'comida'
  mealName: string
  note: string
  photoUrl: string | null
}
export interface HitoEvent extends BaseEvent {
  type: 'hito'
  label: string
  icon: string
}

export type TimelineEvent = AnaliticaEvent | PesoEvent | FotoEvent | NotaEvent | ComidaEvent | HitoEvent

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
        label: `Racha activa de ${runLength} días consecutivos`, icon: '🔥',
      })
    }
    prevDate = d
  }
  return milestones
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
  for (const m of mealLogs) events.push({ id: `comida-${m.id}`, type: 'comida', date: m.date, mealName: m.mealName, note: m.note, photoUrl: m.photoUrl })
  events.push(...streakMilestones(checkins))

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
      return { key, label: `${MONTH_LABELS[parseInt(m, 10) - 1]} de ${y}`, events: evs }
    })
}
