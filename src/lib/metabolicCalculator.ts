// Calculadora metabólica: ecuaciones predictivas del metabolismo basal (adultos) y reparto de macros — sin IA, solo aritmética.
// Es un PUNTO DE PARTIDA que el nutricionista valida: una ecuación predictiva tiene un margen de error en cada persona.
//
// Qué hace distinto desde la evaluación común (planSafety.ts):
//  · No se asume el sexo si la ficha no lo dice: Mifflin y Harris lo piden (Katch-McArdle no).
//  · Las ecuaciones de adultos no se aplican a menores de 18 años.
//  · Con embarazo o lactancia declarados no se genera un objetivo de pérdida de peso.
//  · Los datos imposibles o ausentes bloquean el cálculo, en vez de dar una cifra sin sentido.
//  · Si proteína y grasa (g/kg) ya superan las kcal del objetivo, los hidratos NO se recortan a 0 en silencio: el reparto se marca como
//    incompatible y no se presenta como válido.
//  · Las señales (objetivo bajo la TMB, bajo el umbral de revisión, IMC bajo…) acompañan al resultado; no hay un mínimo universal.
//
// Fórmulas y fuentes (detalle y su estado de verificación en docs/calculadora-metabolica.md):
//  · Mifflin-St Jeor: Mifflin et al., Am J Clin Nutr 1990;51:241-247 (498 personas de 19 a 78 años).
//  · Harris-Benedict revisada: Roza y Shizgal, Am J Clin Nutr 1984;40:168-182.
//  · Katch-McArdle: 370 + 21,6 × masa magra; atribuida al manual McArdle, Katch y Katch (fuente primaria no verificada).
//  · Factores de actividad: convención de calculadoras (NO son los PAL de FAO/OMS/UNU 2004; ver el documento).
//  · Déficit −20 % y superávit +15 %: decisiones de producto, sin fuente.
import {
  CalculatorFormula, PlanEvaluation, ReproductiveCheck, ReproductiveStatus, ReviewThresholds, SexValue, evaluatePlanSafety, invalidFieldSignal, PlanSignal,
} from './planSafety'

export { ageFromBirthDate, sexFromGender } from './planSafety'

export type Sex = SexValue
export type Formula = CalculatorFormula
export type ActivityLevel = 'sedentario' | 'ligero' | 'moderado' | 'intenso' | 'muy_intenso'
export type Goal = 'deficit' | 'mantenimiento' | 'superavit'

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentario: 1.2, ligero: 1.375, moderado: 1.55, intenso: 1.725, muy_intenso: 1.9,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentario: 'Sedentario (poco o ningún ejercicio)',
  ligero: 'Ligero (ejercicio 1-3 días/semana)',
  moderado: 'Moderado (ejercicio 3-5 días/semana)',
  intenso: 'Intenso (ejercicio 6-7 días/semana)',
  muy_intenso: 'Muy intenso (ejercicio diario + trabajo físico)',
}

export const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  deficit: -0.2, mantenimiento: 0, superavit: 0.15,
}

export const GOAL_LABELS: Record<Goal, string> = {
  deficit: 'Déficit (perder peso)', mantenimiento: 'Mantenimiento', superavit: 'Superávit (ganar peso)',
}

/** Mifflin-St Jeor — la ecuación que más a menudo queda dentro del 10 % de lo medido en adultos (Frankenfield 2005). */
export function bmrMifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'hombre' ? base + 5 : base - 161
}

/** Harris-Benedict (revisada por Roza y Shizgal 1984). Con la muestra original de 1919, Mifflin 1990 la vio sobreestimar un 5 %. */
export function bmrHarrisBenedict(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return sex === 'hombre'
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age
}

/** Katch-McArdle — usa masa magra en vez de peso total; más precisa si se conoce el % de grasa corporal. */
export function bmrKatchMcArdle(weightKg: number, bodyFatPct: number): number {
  const leanMassKg = weightKg * (1 - bodyFatPct / 100)
  return 370 + 21.6 * leanMassKg
}

export interface MetabolicInput {
  formula: Formula
  /** `null` = no informado: no se asume. Obligatorio para Mifflin y Harris. */
  sex: Sex | null
  weightKg: number
  heightCm: number
  age: number
  /** Fecha de nacimiento de la ficha (opcional): sirve para comprobar que la edad escrita es coherente. */
  birthDate?: string | null
  bodyFatPct?: number // solo necesario para 'katch'
  activity: ActivityLevel
  goal: Goal
  proteinGPerKg: number // g/kg de peso — el nutricionista decide el objetivo (ej. 1.6-2.2 en déficit/recomp)
  fatGPerKg: number // g/kg de peso
  /** Embarazo/lactancia declarados (cuestionario o selección en la calculadora). */
  reproductiveStatus?: ReproductiveStatus | null
  /** Si la lectura del cuestionario está cargando o ha fallado (y el profesional no ha indicado el estado a mano): se señala, no se supone «no». */
  reproductiveCheck?: ReproductiveCheck
  thresholds?: Partial<ReviewThresholds>
  /** Fecha de referencia (pruebas). */
  today?: Date
}

export interface MetabolicResult {
  bmr: number
  tdee: number
  kcalTarget: number
  proteinG: number
  fatG: number
  carbsG: number
  fiberG: number
}

export interface MetabolicEnergy { bmr: number; tdee: number; kcalTarget: number }

/** Cuentas de macros SIN recortar: `remainingKcalForCarbs` puede ser negativo. */
export interface MacroBalance {
  proteinKcal: number
  fatKcal: number
  remainingKcalForCarbs: number
}

export interface MetabolicOutcome {
  /** TMB, gasto y objetivo (si se pudieron calcular). */
  energy: MetabolicEnergy | null
  /** Reparto aplicable. `null` si hay un bloqueo (datos, edad, embarazo con déficit, macros incompatibles). */
  plan: MetabolicResult | null
  macros: MacroBalance | null
  evaluation: PlanEvaluation
}

const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/**
 * Calcula y evalúa. Devuelve siempre la evaluación; `plan` solo si nada bloquea.
 * La fibra sigue ~14 g por cada 1000 kcal (Ingesta Adecuada de las DRI del IOM; decisión de producto usarla como objetivo del plan).
 */
export function calculateMetabolicPlan(input: MetabolicInput): MetabolicOutcome {
  const { formula, sex, weightKg, heightCm, age, bodyFatPct, activity, goal, proteinGPerKg, fatGPerKg } = input
  const profile = {
    sex, ageYears: isFiniteNumber(age) ? age : null, birthDate: input.birthDate ?? null,
    weightKg: isFiniteNumber(weightKg) ? weightKg : null, heightCm: isFiniteNumber(heightCm) ? heightCm : null,
    bodyFatPct: isFiniteNumber(bodyFatPct) ? bodyFatPct : null, formula, losingWeight: goal === 'deficit',
    reproductiveStatus: input.reproductiveStatus ?? null, reproductiveCheck: input.reproductiveCheck,
  }
  const options = { thresholds: input.thresholds, strict: true, today: input.today }

  // 1. ¿Se puede calcular? (datos válidos, adulto, sin déficit en embarazo/lactancia)
  const extra: PlanSignal[] = []
  if (!(activity in ACTIVITY_FACTORS)) extra.push(invalidFieldSignal('nivel de actividad', activity))
  if (!(goal in GOAL_ADJUSTMENTS)) extra.push(invalidFieldSignal('objetivo', goal))
  if (!isFiniteNumber(proteinGPerKg) || proteinGPerKg < 0) extra.push(invalidFieldSignal('proteína (g/kg)', proteinGPerKg))
  if (!isFiniteNumber(fatGPerKg) || fatGPerKg < 0) extra.push(invalidFieldSignal('grasas (g/kg)', fatGPerKg))
  const pre = evaluatePlanSafety(profile, null, options)
  if (pre.blocked || extra.length > 0) {
    return { energy: null, plan: null, macros: null, evaluation: withExtra(pre, extra) }
  }

  // 2. Cálculo. Los datos ya están validados: peso, altura y edad son números verosímiles; el sexo existe si la fórmula lo pide.
  const bmr = formula === 'mifflin' ? bmrMifflinStJeor(sex as Sex, weightKg, heightCm, age)
    : formula === 'harris' ? bmrHarrisBenedict(sex as Sex, weightKg, heightCm, age)
    : bmrKatchMcArdle(weightKg, bodyFatPct as number)
  const tdee = bmr * ACTIVITY_FACTORS[activity]
  const kcalTarget = tdee * (1 + GOAL_ADJUSTMENTS[goal])

  const proteinG = proteinGPerKg * weightKg
  const fatG = fatGPerKg * weightKg
  const remainingKcalForCarbs = kcalTarget - (proteinG * 4 + fatG * 9)
  const carbsG = Math.max(0, remainingKcalForCarbs) / 4
  const fiberG = (kcalTarget / 1000) * 14

  const energy: MetabolicEnergy = { bmr: Math.round(bmr), tdee: Math.round(tdee), kcalTarget: Math.round(kcalTarget) }
  const macros: MacroBalance = { proteinKcal: proteinG * 4, fatKcal: fatG * 9, remainingKcalForCarbs }

  // 3. Evaluación del resultado (TMB, umbral de revisión, hidratos, macros incompatibles).
  // Se evalúan los GRAMOS ENTEROS que el profesional va a ver (no los internos): así el redondeo se cuantifica y se dice. La comparación
  // de «proteína + grasa por encima del objetivo» sigue usando las cuentas exactas (remainingKcalForCarbs).
  const shown = { proteinG: Math.round(proteinG), carbsG: Math.round(carbsG), fatG: Math.round(fatG), fiberG: Math.round(fiberG) }
  const evaluation = evaluatePlanSafety(profile, { kcal: energy.kcalTarget, proteinG: shown.proteinG, carbsG: shown.carbsG, fatG: shown.fatG, bmr, remainingKcalForCarbs }, options)
  const plan: MetabolicResult | null = evaluation.blocked ? null : { ...energy, ...shown }
  return { energy, plan, macros, evaluation }
}

function withExtra(e: PlanEvaluation, extra: PlanSignal[]): PlanEvaluation {
  if (extra.length === 0) return e
  return { ...e, level: 'bloqueo', blocked: true, signals: [...extra, ...e.signals] }
}

/**
 * Atajo de siempre: el reparto aplicable o `null`. Devuelve `null` también cuando algo bloquea (menor de edad, sexo sin informar,
 * macros incompatibles…): para saber por qué, usa `calculateMetabolicPlan`.
 */
export function computeMetabolicPlan(input: MetabolicInput): MetabolicResult | null {
  return calculateMetabolicPlan(input).plan
}
