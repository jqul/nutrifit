// «Pista de analítica» en un aviso: cuando un cliente tiene energía baja, el peso parado o hambre alta, mira si hay una analítica
// reciente de los marcadores que a veces tienen que ver (hierro, vitamina D, TSH, glucosa) y lo dice con prudencia. Es una pista
// para que el nutricionista decida si merece pedir o revisar una analítica, nunca un diagnóstico.
import { AlertKind } from './clientAlerts'
import { BloodMarkerRow } from './supabase-types'
import { BLOOD_MARKER_MAP, evaluateMarker } from './bloodMarkers'
import { daysBetween } from './planPhases'

/** Qué marcadores se miran para cada aviso (solo los que NutriFit lleva). */
const RELATED_MARKERS: Partial<Record<AlertKind, string[]>> = {
  low_energy: ['hierro', 'vitamina_d', 'tsh'],
  weight_stalled: ['tsh', 'glucosa'],
  high_hunger: ['glucosa'],
}

const SITUATION: Partial<Record<AlertKind, string>> = {
  low_energy: 'la energía baja',
  weight_stalled: 'el peso parado',
  high_hunger: 'el hambre alta',
}

/** Una analítica con más de un año ya no cuenta como reciente. */
export const LAB_STALE_DAYS = 365

export type LabHintTone = 'related' | 'missing' | 'ok'

export interface LabHint {
  kind: AlertKind
  /** related = hay algo fuera de rango relacionado · missing = falta analítica reciente · ok = todo en rango. */
  tone: LabHintTone
  text: string
}

/** «Hierro» → «hierro», «Vitamina D» → «vitamina D», «TSH» se queda como está. */
const lower = (s: string) => {
  const name = s.replace(/\s*\(.*\)\s*$/, '')
  return name === name.toUpperCase() ? name : name.charAt(0).toLowerCase() + name.slice(1)
}

function ago(days: number): string {
  if (days < 45) return `hace ${days} ${days === 1 ? 'día' : 'días'}`
  const months = Math.round(days / 30)
  return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`
}

/**
 * Las pistas de analítica de los avisos activos de un cliente (a lo sumo una por aviso). Mira la lectura MÁS RECIENTE de cada
 * marcador relacionado, si es de hace menos de un año.
 */
export function labHintsForAlerts(alerts: { kind: AlertKind }[], markers: BloodMarkerRow[], todayISO: string): LabHint[] {
  const latest = new Map<string, BloodMarkerRow>()
  for (const r of markers) {
    const cur = latest.get(r.marker_key)
    if (!cur || r.date > cur.date) latest.set(r.marker_key, r)
  }
  const hints: LabHint[] = []
  const seen = new Set<AlertKind>()
  for (const { kind } of alerts) {
    const keys = RELATED_MARKERS[kind]
    if (!keys || seen.has(kind)) continue
    seen.add(kind)

    const out: string[] = []
    const inRange: string[] = []
    const missing: string[] = []
    for (const key of keys) {
      const def = BLOOD_MARKER_MAP[key]
      const reading = latest.get(key)
      if (!def) continue
      const age = reading ? daysBetween(reading.date, todayISO) : null
      if (!reading || age == null || age > LAB_STALE_DAYS) { missing.push(lower(def.label)); continue }
      const status = evaluateMarker(def, Number(reading.value))
      if (status === 'normal') inRange.push(lower(def.label))
      else out.push(`${lower(def.label)} ${status} (${ago(age)})`)
    }

    const when = SITUATION[kind]!
    const list = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
    if (out.length > 0) {
      const gap = missing.length > 0 ? ` Falta una analítica reciente de ${list(missing)}.` : ''
      hints.push({ kind, tone: 'related', text: `Con ${when}: ${list(out)}. Puede estar relacionado.${gap}` })
    } else if (missing.length > 0) {
      hints.push({ kind, tone: 'missing', text: `Con ${when} no hay analítica reciente de ${list(missing)}: puede merecer la pena pedirla.` })
    } else if (inRange.length > 0) {
      hints.push({ kind, tone: 'ok', text: `Con ${when}: ${list(inRange)} en rango en su última analítica, así que quizá no vaya por ahí.` })
    }
  }
  return hints
}
