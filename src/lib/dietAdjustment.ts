// Reajuste sugerido del plan: compara el ritmo de peso real del cliente con el
// que pide su objetivo y, si se desvía, propone una nueva cifra de kcal (y de
// carbohidratos) para el plan. Es una ayuda para decidir, no un criterio clínico:
// el nutricionista la ve, la puede editar y solo se aplica si él lo decide.
//
// Reglas deliberadamente conservadoras — es mejor no proponer nada que proponer
// un cambio con datos pobres:
//  · No se valora hasta pasadas 2 semanas desde el último cambio del plan.
//  · Hacen falta al menos 3 pesajes que abarquen 10 días, y el último de la última semana.
//  · Si el cliente no sigue el plan (adherencia baja), el problema no es la cifra de
//    kcal: se avisa de eso en vez de recortar más.
//  · El cambio se amortigua (la mitad de lo que "dice" la aritmética), se acota a
//    ±250 kcal y se redondea a 25.
//  · No se PROPONE automáticamente bajar de 1.200 kcal ni dejar menos de 50 g de carbohidratos. Esos dos números son UMBRALES DE
//    REVISIÓN internos (provisionales y configurables), no mínimos de seguridad: si el plan ya está por debajo o en ellos, el reajuste
//    no baja más por su cuenta y lo dice así; el profesional puede decidir otra cosa con su criterio.
//  · No se proponen reajustes automáticos para menores de 18 años ni con embarazo o lactancia declarados (el motor común de
//    planSafety.ts lo decide; ver docs/calculadora-metabolica.md).
//  · La proteína y la grasa no se tocan: la diferencia va a los carbohidratos.
import { DailyCheckin, WeightEntry } from '../types'
import { PlanTargets } from './planChanges'
import { bmrMifflinStJeor } from './metabolicCalculator'
import { weightLossLikely } from './planGuard'
import {
  ADULT_AGE, DEFAULT_REVIEW_THRESHOLDS, PlanEvaluation, PlanSignal, ReproductiveCheck, ReproductiveStatus, ReviewThresholds, SexValue, evaluatePlanSafety, isReproductiveActive, reproductiveUnverifiedSignal, visibleSignals,
} from './planSafety'
import { calcAdherence } from './adherence'
import { toLocalISODate } from './date'

export type AdjustmentKind = 'no_plan' | 'wait' | 'on_track' | 'goal_reached' | 'adjust'

export interface AdjustmentPlan {
  kcal_target: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  advice: string
  /** Última vez que se guardó el plan (ms). */
  updatedAt: number
}

/** Datos de la persona que el motor de evaluación necesita (todo opcional: sin ellos el reajuste funciona como antes). */
export interface AdjustmentProfile {
  sex: SexValue | null
  ageYears: number | null
  birthDate?: string | null
  heightCm?: number | null
  reproductiveStatus?: ReproductiveStatus | null
  /** Estado de la lectura del cuestionario: si no está `ready` no se proponen reajustes automáticos (no se supone «no hay embarazo»). */
  reproductiveCheck?: ReproductiveCheck
}

/**
 * Evaluación del motor común sobre unas kcal e hidratos concretos (el plan actual, la propuesta o la cifra que edite el profesional),
 * con lo que se sepa de la persona. `kg` es el último peso conocido (para el IMC y la TMB), o null.
 */
export function evaluateAdjustmentTarget(
  profile: AdjustmentProfile | undefined, goal: string | null, kcal: number, carbs: number, kg: number | null,
  thresholds?: Partial<ReviewThresholds>, today = new Date(),
): PlanEvaluation {
  const age = profile?.ageYears ?? null
  const bmr = profile && profile.sex && typeof age === 'number' && age >= ADULT_AGE && profile.heightCm && kg
    ? bmrMifflinStJeor(profile.sex, kg, profile.heightCm, age) : null
  return evaluatePlanSafety({
    sex: profile?.sex ?? null, ageYears: age, birthDate: profile?.birthDate ?? null, weightKg: kg, heightCm: profile?.heightCm ?? null,
    losingWeight: goal === 'perder_peso', weightLossLikely: weightLossLikely(goal, kcal, bmr),
    reproductiveStatus: profile?.reproductiveStatus ?? null, reproductiveCheck: profile?.reproductiveCheck,
  }, { kcal, carbsG: carbs, bmr }, { strict: false, thresholds, today })
}

export interface AdjustmentInput {
  weights: WeightEntry[]
  checkins: DailyCheckin[]
  goal: string | null
  goalWeightKg: number | null
  plan: AdjustmentPlan | null
  profile?: AdjustmentProfile
  thresholds?: Partial<ReviewThresholds>
}

export interface DietAdjustment {
  kind: AdjustmentKind
  headline: string
  /** Los datos en los que se basa, uno por línea. */
  reasons: string[]
  /** Los objetivos propuestos (solo si kind === 'adjust'). */
  proposal: PlanTargets | null
  /** Cambio de kcal diarias propuesto (negativo = bajar). 0 si no hay propuesta. */
  deltaKcal: number
  /** Motivo corto para el historial del plan (≤ 200 caracteres). */
  historyReason: string
  /** Señales del motor común sobre el plan actual (o sobre la propuesta). Vacío si no hay nada que señalar. */
  signals: PlanSignal[]
}

export const MIN_DAYS_SINCE_CHANGE = 14
export const MIN_WEIGH_INS = 3
export const MIN_SPAN_DAYS = 10
export const MAX_LAST_WEIGH_IN_AGE_DAYS = 7
export const LOW_ADHERENCE_PCT = 70
/** Umbrales de REVISIÓN (no mínimos de seguridad); los valores por defecto viven en planSafety.ts. */
export const MIN_KCAL = DEFAULT_REVIEW_THRESHOLDS.minKcalReview
export const MIN_CARBS_G = DEFAULT_REVIEW_THRESHOLDS.minCarbsG
export const MAX_STEP_KCAL = 250
export const KCAL_PER_KG = 7700
const WINDOW_DAYS = 28
const DAY_MS = 86400000

/** Ritmo deseado y banda aceptable, como % del peso corporal por semana (negativo = perder). */
interface Pace { target: number; min: number; max: number; label: string }

function paceFor(goal: string | null): Pace | null {
  switch (goal) {
    case 'perder_peso': return { target: -0.6, min: -1.0, max: -0.3, label: 'perder entre el 0,3 % y el 1 % del peso por semana' }
    case 'ganar_masa': return { target: 0.3, min: 0.1, max: 0.5, label: 'ganar entre el 0,1 % y el 0,5 % del peso por semana' }
    case 'mantenimiento': case 'salud': case 'rendimiento':
      return { target: 0, min: -0.25, max: 0.25, label: 'mantener el peso (±0,25 % por semana)' }
    default: return null
  }
}

/** Hasta cuánto del peso de mantenimiento se considera «en el sitio»: dentro de esta banda se mantiene; fuera, se vuelve poco a poco. */
export const MAINTENANCE_BAND_KG = 0.7
const MAINTENANCE_RECOVERY_PCT = 0.15

/**
 * Mantenimiento dinámico: si el objetivo es mantener y hay un peso de mantenimiento, estar a más de 0,7 kg de él pide volver
 * poco a poco (≈0,15 % del peso por semana) en lugar de «mantener» lo que ya se ha desviado. Dentro de la banda, o sin peso de
 * mantenimiento, sigue valiendo el ritmo estable. Devuelve el ritmo a usar para ese caso, o null si no cambia.
 */
function maintenanceRecoveryPace(goal: string | null, currentKg: number, goalWeightKg: number | null): Pace | null {
  if (goalWeightKg == null || (goal !== 'mantenimiento' && goal !== 'salud' && goal !== 'rendimiento')) return null
  const diff = goalWeightKg - currentKg
  if (Math.abs(diff) <= MAINTENANCE_BAND_KG) return null
  return diff > 0
    ? { target: MAINTENANCE_RECOVERY_PCT, min: 0.05, max: 0.3, label: `volver poco a poco a su peso de mantenimiento (${fmt1(goalWeightKg)} kg): subir ≈0,15 % del peso por semana` }
    : { target: -MAINTENANCE_RECOVERY_PCT, min: -0.3, max: -0.05, label: `volver poco a poco a su peso de mantenimiento (${fmt1(goalWeightKg)} kg): bajar ≈0,15 % del peso por semana` }
}

const fmt1 = (n: number) => n.toFixed(1).replace('.', ',')
const fmt2 = (n: number) => n.toFixed(2).replace('.', ',')
const signed = (n: number, f: (v: number) => string = fmt1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${f(Math.abs(n))}`
const fmtInt = (n: number) => Math.round(n).toLocaleString('es-ES')
const dayNumber = (iso: string) => Math.round(new Date(iso + 'T00:00:00').getTime() / DAY_MS)
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const round25 = (n: number) => Math.round(n / 25) * 25

/** Pendiente por mínimos cuadrados, en kg por día. */
function slopeKgPerDay(points: { day: number; kg: number }[]): number {
  const n = points.length
  const mx = points.reduce((s, p) => s + p.day, 0) / n
  const my = points.reduce((s, p) => s + p.kg, 0) / n
  const num = points.reduce((s, p) => s + (p.day - mx) * (p.kg - my), 0)
  const den = points.reduce((s, p) => s + (p.day - mx) ** 2, 0)
  return den === 0 ? 0 : num / den
}

/** Qué está pasando con el peso, según el objetivo y el sentido del ajuste. */
function deviationText(goal: string | null, delta: number): string {
  if (goal === 'perder_peso') return delta < 0 ? 'no baja al ritmo previsto' : 'baja más rápido de lo previsto'
  if (goal === 'ganar_masa') return delta < 0 ? 'sube más rápido de lo previsto' : 'no sube al ritmo previsto'
  return delta < 0 ? 'está subiendo de peso' : 'está bajando de peso'
}

const none = (kind: AdjustmentKind, headline: string, reasons: string[] = [], signals: PlanSignal[] = []): DietAdjustment =>
  ({ kind, headline, reasons, proposal: null, deltaKcal: 0, historyReason: '', signals })

export function suggestDietAdjustment(input: AdjustmentInput, today = new Date()): DietAdjustment {
  const { plan, goal, goalWeightKg } = input
  if (!plan || !plan.kcal_target) return none('no_plan', 'Define primero los objetivos del plan para poder reajustarlos.')

  const th: ReviewThresholds = { ...DEFAULT_REVIEW_THRESHOLDS, ...input.thresholds }
  const profile = input.profile
  const age = profile?.ageYears ?? null
  // Señales del motor común sobre unas kcal/hidratos concretos (el plan actual o la propuesta), con lo que se sepa de la persona.
  const signalsFor = (kcal: number, carbs: number, kg: number | null): PlanSignal[] =>
    visibleSignals(evaluateAdjustmentTarget(profile, goal, kcal, carbs, kg, input.thresholds, today))
  const baseSignals = signalsFor(plan.kcal_target, plan.carbs_g, null)

  // Mientras la información necesaria no se pueda comprobar (cargando o error de lectura), no se propone nada: un fallo de la consulta
  // NO se interpreta como «no hay embarazo ni lactancia». Se dice claramente.
  if (profile?.reproductiveCheck === 'loading') {
    return none('wait', 'Comprobando el cuestionario de salud antes de valorar el reajuste…', [], [reproductiveUnverifiedSignal('loading')])
  }
  if (profile?.reproductiveCheck === 'error') {
    return none('wait', 'No se ha podido comprobar si hay embarazo o lactancia (ha fallado la lectura del cuestionario de salud): no se proponen reajustes automáticos hasta poder comprobarlo. Recarga la ficha o confírmalo con el cliente.',
      [], [reproductiveUnverifiedSignal('error', 'bloqueo')])
  }
  // Población para la que el reajuste automático no es válido: se dice y no se propone nada.
  if (typeof age === 'number' && age >= 0 && age < ADULT_AGE) {
    return none('wait', `No se proponen reajustes automáticos para menores de ${ADULT_AGE} años: el ritmo de peso esperado y las ecuaciones de esta herramienta son para adultos. Requiere valoración profesional.`, [], baseSignals)
  }
  if (isReproductiveActive(profile?.reproductiveStatus)) {
    const que = profile?.reproductiveStatus === 'embarazo' ? 'el embarazo' : 'la lactancia'
    return none('wait', `No se proponen reajustes automáticos durante ${que}: el peso y las necesidades cambian y esta herramienta no los modela. Requiere valoración profesional.`, [], baseSignals)
  }

  let pace = paceFor(goal)
  if (!pace) return none('wait', 'Indica el objetivo del cliente (perder peso, ganar masa, mantenimiento…) para valorar su ritmo.', [], baseSignals)

  const todayDay = dayNumber(toLocalISODate(startOfDay(today)))
  const changeDate = toLocalISODate(new Date(plan.updatedAt))
  const daysSinceChange = todayDay - dayNumber(changeDate)
  if (daysSinceChange < MIN_DAYS_SINCE_CHANGE) {
    return none('wait', `El plan se cambió hace ${daysSinceChange} ${daysSinceChange === 1 ? 'día' : 'días'}: espera al menos ${MIN_DAYS_SINCE_CHANGE} para ver su efecto.`, [], baseSignals)
  }

  // Solo pesajes posteriores al último cambio del plan, y como mucho de las últimas 4 semanas.
  const since = Math.max(dayNumber(changeDate), todayDay - WINDOW_DAYS)
  const points = [...input.weights]
    .filter(w => dayNumber(w.date) >= since && dayNumber(w.date) <= todayDay)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(w => ({ day: dayNumber(w.date), kg: w.weightKg }))
  const span = points.length ? points[points.length - 1].day - points[0].day : 0
  if (points.length < MIN_WEIGH_INS || span < MIN_SPAN_DAYS) {
    return none('wait', `Faltan pesajes para valorar el ritmo: hacen falta al menos ${MIN_WEIGH_INS} que abarquen ${MIN_SPAN_DAYS} días desde el último cambio del plan (hay ${points.length}).`, [], baseSignals)
  }
  const lastAge = todayDay - points[points.length - 1].day
  if (lastAge > MAX_LAST_WEIGH_IN_AGE_DAYS) {
    return none('wait', `El último pesaje es de hace ${lastAge} días: pídele que se pese antes de reajustar.`, [], baseSignals)
  }

  const currentKg = points[points.length - 1].kg
  const planSignals = signalsFor(plan.kcal_target, plan.carbs_g, currentKg)
  pace = maintenanceRecoveryPace(goal, currentKg, goalWeightKg) ?? pace
  const meanKg = points.reduce((s, p) => s + p.kg, 0) / points.length
  const kgPerWeek = slopeKgPerDay(points) * 7
  const pctPerWeek = (kgPerWeek / meanKg) * 100

  const windowDays = Math.min(WINDOW_DAYS, daysSinceChange)
  const adherence = calcAdherence(input.checkins, windowDays, today)
  const reasons = [
    `Peso: ${signed(kgPerWeek, fmt2)} kg por semana (${signed(pctPerWeek, fmt2)} %) según ${points.length} pesajes en ${span} días.`,
    `Objetivo: ${pace.label}.`,
    `Adherencia en ese periodo: ${adherence} %.`,
  ]

  // ¿Meta de peso alcanzada? Entonces toca pensar en mantenimiento, no en seguir empujando.
  if (goalWeightKg != null && (goal === 'perder_peso' || goal === 'ganar_masa')) {
    const reached = goal === 'perder_peso' ? currentKg <= goalWeightKg + 0.5 : currentKg >= goalWeightKg - 0.5
    if (reached) {
      return none('goal_reached', `Ha llegado a su peso objetivo (${fmt1(goalWeightKg)} kg): valora pasar el plan a mantenimiento.`, reasons, planSignals)
    }
  }

  if (adherence < LOW_ADHERENCE_PCT) {
    return none('wait', `Sigue el plan solo el ${adherence} % de los días: antes de tocar las kcal conviene ver qué le dificulta cumplirlo.`, reasons, planSignals)
  }

  if (pctPerWeek >= pace.min && pctPerWeek <= pace.max) {
    return none('on_track', 'Va al ritmo que pide su objetivo: no hace falta reajustar.', reasons, planSignals)
  }

  // Diferencia entre el ritmo deseado y el real, pasada a kcal diarias y amortiguada a la mitad.
  const wantedKgPerWeek = (pace.target / 100) * meanKg
  const rawDelta = ((wantedKgPerWeek - kgPerWeek) * KCAL_PER_KG / 7) * 0.5
  let delta = round25(Math.max(-MAX_STEP_KCAL, Math.min(MAX_STEP_KCAL, rawDelta)))

  // Umbrales de REVISIÓN (no mínimos de seguridad): el reajuste no PROPONE por su cuenta bajar de las kcal ni de los hidratos de
  // revisión. Si el plan ya está en ellos o por debajo, no baja más y lo dice sin llamarlo «seguro».
  let atLimit = false
  if (delta < 0) {
    const lowestDelta = Math.max(th.minKcalReview - plan.kcal_target, (th.minCarbsG - plan.carbs_g) * 4)
    const limited = lowestDelta >= 0 ? 0 : Math.max(delta, Math.ceil(lowestDelta / 25) * 25)
    atLimit = limited !== delta
    delta = limited
  }
  if (Math.abs(delta) < 50) {
    return none('wait',
      atLimit
        ? `Debería bajar kcal, pero el plan ya ${plan.kcal_target < th.minKcalReview || plan.carbs_g < th.minCarbsG ? 'está por debajo del' : 'está en el'} umbral de revisión interno (${fmtInt(th.minKcalReview)} kcal o ${th.minCarbsG} g de carbohidratos): no se baja más de forma automática. Ese umbral es provisional y no garantiza seguridad; si crees que hay que bajar más, decídelo con tu criterio profesional y revisa el caso. Otras palancas: actividad, registro de comidas.`
        : 'La diferencia con su ritmo ideal es demasiado pequeña para justificar un cambio.',
      reasons, planSignals)
  }

  const proposal: PlanTargets = {
    kcal_target: plan.kcal_target + delta,
    protein_g: plan.protein_g,
    carbs_g: Math.max(0, Math.round(plan.carbs_g + delta / 4)),
    fat_g: plan.fat_g,
    fiber_g: plan.fiber_g,
    advice: plan.advice,
  }
  const verb = delta < 0 ? 'Bajar' : 'Subir'
  const why = deviationText(goal, delta)
  return {
    kind: 'adjust',
    headline: `${verb} ${Math.abs(delta)} kcal al día (de ${fmtInt(plan.kcal_target)} a ${fmtInt(proposal.kcal_target)}): ${why}.`,
    reasons,
    proposal,
    signals: signalsFor(proposal.kcal_target, proposal.carbs_g, currentKg),
    deltaKcal: delta,
    historyReason: `Reajuste sugerido: ${signed(kgPerWeek, fmt2)} kg/sem frente a ${signed(wantedKgPerWeek, fmt2)} esperados (${delta > 0 ? '+' : '−'}${Math.abs(delta)} kcal)`,
  }
}
