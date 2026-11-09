// GENERADO por scripts/sync-edge-shared.mjs a partir de src/lib/planPhases.ts — NO EDITAR A MANO.
// Fases del plan: la línea de tiempo de un cliente («Definición», «Mantenimiento»…). Todo lo que hay aquí es aritmética
// de fechas sobre textos YYYY-MM-DD, sin zonas horarias: una fase dura «del día X al día Y, ambos incluidos».

export interface PlanPhase {
  id: string
  clientId: string
  name: string
  /** Texto para el cliente («en esta fase…»). */
  description: string
  /** YYYY-MM-DD, incluido. */
  startDate: string
  /** YYYY-MM-DD, incluido. */
  endDate: string
  /** Plantilla de plan que le corresponde. */
  templateId: string | null
  /** Si la plantilla se aplica sola al plan del cliente el día que empieza la fase (0068). */
  autoApply?: boolean
  /** Cuándo se aplicó (ISO), si ya se hizo. */
  appliedAt?: string | null
  /** Por qué no se pudo aplicar, si falló. */
  applyError?: string | null
}

const DAY_MS = 86400000
const ISO = /^\d{4}-\d{2}-\d{2}$/

/** ¿Es una fecha YYYY-MM-DD real (no 2026-02-31)? */
export function isISODate(text: string): boolean {
  if (!ISO.test(text)) return false
  const d = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text
}

const toMs = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime()

/** Días de `fromISO` a `toISO` (positivo si `toISO` es posterior). */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((toMs(toISO) - toMs(fromISO)) / DAY_MS)
}

export function addDays(iso: string, days: number): string {
  return new Date(toMs(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

export type PhaseStatus = 'upcoming' | 'active' | 'ended'

export function phaseStatus(phase: Pick<PlanPhase, 'startDate' | 'endDate'>, todayISO: string): PhaseStatus {
  if (todayISO < phase.startDate) return 'upcoming'
  if (todayISO > phase.endDate) return 'ended'
  return 'active'
}

export const sortPhases = <T extends Pick<PlanPhase, 'startDate' | 'endDate'>>(phases: T[]): T[] =>
  [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate))

/** Los problemas de una fase antes de guardarla (vacío = válida). `others` son las demás fases del cliente. */
export function validatePhase(
  draft: { name: string; startDate: string; endDate: string },
  others: Pick<PlanPhase, 'name' | 'startDate' | 'endDate'>[],
): string[] {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push('Ponle un nombre a la fase.')
  if (draft.name.trim().length > 80) errors.push('El nombre es demasiado largo (máximo 80 letras).')
  const startOk = isISODate(draft.startDate), endOk = isISODate(draft.endDate)
  if (!startOk) errors.push('La fecha de inicio no es válida.')
  if (!endOk) errors.push('La fecha de fin no es válida.')
  if (startOk && endOk) {
    if (draft.endDate < draft.startDate) errors.push('La fase no puede acabar antes de empezar.')
    else {
      const clash = others.find(o => draft.startDate <= o.endDate && o.startDate <= draft.endDate)
      if (clash) errors.push(`Se solapa con la fase «${clash.name}».`)
    }
  }
  return errors
}

export interface PhaseSummary {
  /** La fase de hoy, si la hay. */
  current: PlanPhase | null
  /** Posición de la fase actual entre todas (1…total). */
  position: number | null
  total: number
  /** Días que le quedan a la fase actual contando hoy (1 = es el último día). */
  daysLeft: number | null
  /** La siguiente fase por empezar (si la hay). */
  next: PlanPhase | null
  /** Días hasta que empiece la siguiente. */
  daysToNext: number | null
}

export function summarizePhases(phases: PlanPhase[], todayISO: string): PhaseSummary {
  const sorted = sortPhases(phases)
  const idx = sorted.findIndex(p => phaseStatus(p, todayISO) === 'active')
  const current = idx >= 0 ? sorted[idx] : null
  const next = sorted.find(p => phaseStatus(p, todayISO) === 'upcoming') ?? null
  return {
    current, position: current ? idx + 1 : null, total: sorted.length,
    daysLeft: current ? daysBetween(todayISO, current.endDate) + 1 : null,
    next, daysToNext: next ? daysBetween(todayISO, next.startDate) : null,
  }
}

export interface PhaseReview {
  kind: 'ending' | 'ended'
  phase: PlanPhase
  /** Frase para el nutricionista. */
  text: string
}

/** Cuántos días antes del final se avisa de que una fase termina. */
export const REVIEW_WINDOW_DAYS = 3
/** Cuántos días después del final se sigue avisando si no hay otra fase. */
export const ENDED_GRACE_DAYS = 14

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * ¿Hay que mirar el plan de este cliente por sus fases? Sí cuando la fase de hoy termina en pocos días, o cuando la
 * última fase terminó hace poco y no hay otra detrás. No hay aviso si todo sigue su curso.
 */
export function phaseReview(phases: PlanPhase[], todayISO: string): PhaseReview | null {
  if (phases.length === 0) return null
  const s = summarizePhases(phases, todayISO)
  if (s.current && s.daysLeft != null && s.daysLeft <= REVIEW_WINDOW_DAYS) {
    const when = s.daysLeft === 1 ? 'termina hoy' : `termina en ${plural(s.daysLeft, 'día', 'días')}`
    const after = s.next ? ` La siguiente es «${s.next.name}».` : ' No hay otra fase después.'
    return { kind: 'ending', phase: s.current, text: `La fase «${s.current.name}» ${when}.${after}` }
  }
  if (!s.current && !s.next) {
    const sortedAll = sortPhases(phases)
    const last = sortedAll[sortedAll.length - 1]
    const ago = daysBetween(last.endDate, todayISO)
    if (ago >= 1 && ago <= ENDED_GRACE_DAYS) {
      return { kind: 'ended', phase: last, text: `La fase «${last.name}» terminó hace ${plural(ago, 'día', 'días')} y no hay otra después.` }
    }
  }
  return null
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** «4 nov» (sin año). */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

/** «4 nov – 1 dic». */
export function formatRange(phase: Pick<PlanPhase, 'startDate' | 'endDate'>): string {
  return `${shortDate(phase.startDate)} – ${shortDate(phase.endDate)}`
}

/** Los valores por defecto de una fase nueva: empieza el día siguiente a la última (o hoy) y dura 4 semanas. */
export function nextPhaseDefaults(phases: Pick<PlanPhase, 'endDate'>[], todayISO: string): { startDate: string; endDate: string } {
  const ends = phases.map(p => p.endDate).sort()
  const lastEnd = ends[ends.length - 1]
  const startDate = lastEnd && lastEnd >= todayISO ? addDays(lastEnd, 1) : todayISO
  return { startDate, endDate: addDays(startDate, 27) }
}

const MADRID = 'Europe/Madrid'
/** El día (YYYY-MM-DD) en Madrid de un instante ISO. */
export function madridDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MADRID }).format(new Date(iso))
}

/**
 * Las frases que entran en el aviso diario por push (una vez, sin guardar estado: solo en los días exactos):
 *  · una fase que termina dentro de 3 días,
 *  · la última fase, que terminó ayer sin otra detrás,
 *  · un plan que se cambió hoy solo por una fase,
 *  · una plantilla que no se pudo aplicar (los 3 primeros días de la fase).
 */
export function phaseDigestNotes(entries: { clientName: string; phases: PlanPhase[] }[], todayISO: string): string[] {
  const notes: string[] = []
  for (const { clientName, phases } of entries) {
    if (phases.length === 0) continue
    const s = summarizePhases(phases, todayISO)
    if (s.current && s.daysLeft === REVIEW_WINDOW_DAYS) {
      notes.push(`${clientName}: «${s.current.name}» termina en ${REVIEW_WINDOW_DAYS} días${s.next ? `, sigue «${s.next.name}»` : ', no hay otra fase'}`)
    }
    if (!s.current && !s.next) {
      const sorted = sortPhases(phases)
      const last = sorted[sorted.length - 1]
      if (daysBetween(last.endDate, todayISO) === 1) notes.push(`${clientName}: «${last.name}» terminó ayer y no hay otra fase`)
    }
    for (const p of phases) {
      if (p.appliedAt && madridDay(p.appliedAt) === todayISO) notes.push(`${clientName}: plan cambiado a «${p.name}» (automático)`)
      else if (p.autoApply && !p.appliedAt && p.applyError && phaseStatus(p, todayISO) === 'active' && daysBetween(p.startDate, todayISO) <= 2) {
        notes.push(`${clientName}: no se pudo aplicar la plantilla de «${p.name}»`)
      }
    }
  }
  return notes
}

/** Plantillas de fase: rellenan el nombre, lo que se explica al cliente y la duración. El nutricionista las edita después. */
export interface PhasePreset { id: string; name: string; description: string; weeks: number }

export const PHASE_PRESETS: PhasePreset[] = [
  { id: 'definicion', name: 'Definición', weeks: 8,
    description: 'Déficit moderado y mucha proteína: aquí se baja grasa sin perder músculo.' },
  { id: 'mantenimiento', name: 'Mantenimiento', weeks: 4,
    description: 'Comemos para mantener el peso estable: mismas pautas, sin déficit ni superávit.' },
  { id: 'pausa', name: 'Pausa de dieta', weeks: 2,
    description: 'Una o dos semanas comiendo cerca de tu mantenimiento para descansar de la dieta y volver con más energía. Sigue apuntando todo como siempre.' },
  { id: 'volumen', name: 'Volumen', weeks: 8,
    description: 'Superávit controlado y mucha proteína para ganar masa muscular con poca grasa.' },
]

/** Lo que cambia al elegir una plantilla estando ya puesto el inicio: nombre, descripción y el último día (incluido). */
export function applyPhasePreset(preset: PhasePreset, startDate: string): { name: string; description: string; endDate: string } {
  return { name: preset.name, description: preset.description, endDate: addDays(startDate, preset.weeks * 7 - 1) }
}
