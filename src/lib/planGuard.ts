// Guarda de los objetivos del plan en los flujos de EDICIÓN y APLICACIÓN (entrada manual, plantillas, restauraciones): lógica pura sobre el
// motor común (planSafety.ts). La pantalla solo pinta lo que decide este módulo.
//
// Lo que NO es: no registra nada (la confirmación del profesional es visual y vive en el estado de la pantalla), no sustituye una
// auditoría y no puede proteger lo que se ejecuta en el servidor (fases con aplicación automática, ver docs/calculadora-metabolica.md).
import { ACTIVITY_FACTORS, bmrMifflinStJeor } from './metabolicCalculator'
import {
  ADULT_AGE, PlanEvaluation, ReproductiveCheck, ReproductiveStatus, ReviewThresholds, SexValue, evaluatePlanSafety,
} from './planSafety'

export interface GuardProfile {
  sex: SexValue | null
  ageYears: number | null
  birthDate?: string | null
  heightCm?: number | null
  reproductiveStatus?: ReproductiveStatus | null
  reproductiveCheck?: ReproductiveCheck
}

/** Objetivos tal como están en la pantalla (texto de los campos) o ya numéricos. */
export interface TargetsInput {
  kcal: string | number | null | undefined
  proteinG: string | number | null | undefined
  carbsG: string | number | null | undefined
  fatG: string | number | null | undefined
}

export interface ParsedTargets { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }

export function parseTarget(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export const parseTargets = (t: TargetsInput): ParsedTargets => ({
  kcal: parseTarget(t.kcal), proteinG: parseTarget(t.proteinG), carbsG: parseTarget(t.carbsG), fatG: parseTarget(t.fatG),
})

/** Objetivos de la ficha que dicen expresamente que NO se quiere perder peso. Todo lo demás (vacío, texto libre, «perder_peso») no lo descarta. */
const NON_LOSS_GOALS = ['mantenimiento', 'ganar_masa', 'salud', 'rendimiento']

/**
 * ¿Es posible que este objetivo sea una pérdida de peso? Sí si la ficha no dice expresamente lo contrario (vacío o texto libre), o si las kcal
 * quedan por debajo del mantenimiento MÍNIMO estimable (TMB × 1,2, el factor de actividad más bajo): un déficit efectivo aunque la ficha
 * diga «mantenimiento». Sin TMB (faltan sexo, edad, altura o peso) no se puede comparar y manda el objetivo de la ficha.
 * Solo se usa en embarazo y lactancia (ver `SafetyProfile.weightLossLikely`).
 */
export function weightLossLikely(goal: string | null | undefined, kcal: number | null, bmr: number | null): boolean {
  if (!NON_LOSS_GOALS.includes(goal ?? '')) return true
  return kcal != null && bmr != null && bmr > 0 && kcal < bmr * ACTIVITY_FACTORS.sedentario
}

const EMPTY: PlanEvaluation = { level: 'ok', signals: [], blocked: false, needsProfessionalReview: false }

/**
 * Evalúa unos objetivos (a mano, de una plantilla o de una versión a restaurar) con lo que se sabe AHORA del cliente. Una plantilla que era
 * válida para otra persona o en otro momento no se da por buena: se evalúa igual que un objetivo escrito a mano.
 * Sin kcal (objetivo vacío) no hay nada que evaluar.
 */
export function evaluateTargets(
  profile: GuardProfile, goal: string | null, weightKg: number | null, targets: TargetsInput,
  opts: { thresholds?: Partial<ReviewThresholds>; today?: Date } = {},
): PlanEvaluation {
  const t = parseTargets(targets)
  if (t.kcal == null || t.kcal <= 0) return EMPTY
  const age = profile.ageYears
  const bmr = profile.sex && typeof age === 'number' && age >= ADULT_AGE && profile.heightCm && weightKg
    ? bmrMifflinStJeor(profile.sex, weightKg, profile.heightCm, age) : null
  return evaluatePlanSafety({
    sex: profile.sex, ageYears: age, birthDate: profile.birthDate ?? null, weightKg, heightCm: profile.heightCm ?? null,
    losingWeight: goal === 'perder_peso', weightLossLikely: weightLossLikely(goal, t.kcal, bmr),
    reproductiveStatus: profile.reproductiveStatus ?? null, reproductiveCheck: profile.reproductiveCheck,
  }, { kcal: t.kcal, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG, bmr }, { strict: false, thresholds: opts.thresholds, today: opts.today })
}

/**
 * Huella de lo que se ha evaluado: los objetivos EXACTOS y las señales resultantes. Si cambia cualquier objetivo, o cambian los datos del
 * cliente de forma que cambien las señales, la huella cambia y la confirmación anterior deja de valer.
 */
export function targetsFingerprint(targets: TargetsInput, evaluation: PlanEvaluation): string {
  const t = parseTargets(targets)
  return [t.kcal, t.proteinG, t.carbsG, t.fatG].map(n => (n == null ? '-' : String(n))).join('|') + '#' + evaluation.signals.map(s => s.code).join(',')
}

/** ¿Los objetivos del formulario difieren de los guardados? Sin objetivos guardados, cualquier objetivo con kcal es nuevo. */
export function targetsChanged(saved: TargetsInput | null, current: TargetsInput): boolean {
  const c = parseTargets(current)
  const s = saved ? parseTargets(saved) : { kcal: null, proteinG: null, carbsG: null, fatG: null }
  const norm = (n: number | null) => n ?? 0
  return (['kcal', 'proteinG', 'carbsG', 'fatG'] as const).some(k => norm(c[k]) !== norm(s[k]))
}

export type SaveReason = 'ok' | 'sin_cambios' | 'bloqueado' | 'falta_confirmacion'
export interface SaveDecision { allowed: boolean; reason: SaveReason; message: string | null }

export const CONFIRMATION_REQUIRED_MESSAGE =
  'Este objetivo pide revisión profesional: marca la confirmación antes de guardar. Es una confirmación visual en pantalla, no queda registrada.'

/**
 * ¿Se puede guardar? La guarda solo actúa si los objetivos CAMBIAN respecto a los guardados (guardar solo comidas de un plan antiguo
 * no obliga a reconfirmar un objetivo que ya estaba). Se bloquea lo matemáticamente incompatible o no calculable, y las señales de
 * revisión exigen la confirmación del MISMO objetivo evaluado (misma huella): si se cambia algo después, hay que volver a confirmar.
 */
export function decideSave(args: { evaluation: PlanEvaluation; fingerprint: string; confirmedFingerprint: string | null; changed: boolean }): SaveDecision {
  const { evaluation, fingerprint, confirmedFingerprint, changed } = args
  if (!changed) return { allowed: true, reason: 'sin_cambios', message: null }
  if (evaluation.blocked) {
    const first = evaluation.signals.find(s => s.severity === 'bloqueo')
    return { allowed: false, reason: 'bloqueado', message: `No se puede guardar este objetivo: ${first?.title ?? 'hay una señal de bloqueo'}.` }
  }
  if (evaluation.needsProfessionalReview && confirmedFingerprint !== fingerprint) {
    return { allowed: false, reason: 'falta_confirmacion', message: CONFIRMATION_REQUIRED_MESSAGE }
  }
  return { allowed: true, reason: 'ok', message: null }
}

/**
 * Aplicar una plantilla o restaurar una versión: se rechaza si, con los datos de HOY del cliente, el objetivo es incalculable o
 * incompatible (p. ej. el cliente es menor, o hay embarazo y la plantilla es de déficit). Con señales de revisión se aplica, pero se
 * enseñan, y al guardar hará falta la confirmación.
 */
export function decideApply(evaluation: PlanEvaluation, what: 'plantilla' | 'versión'): { allowed: boolean; message: string | null } {
  if (!evaluation.blocked) return { allowed: true, message: null }
  const first = evaluation.signals.find(s => s.severity === 'bloqueo')
  return { allowed: false, message: `No se aplica la ${what}: con los datos actuales del cliente su objetivo no es válido (${first?.title ?? 'señal de bloqueo'}).` }
}
