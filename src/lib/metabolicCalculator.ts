// Calculadora metabólica: fórmulas clínicas estándar para estimar el gasto
// energético y repartir macros — sin IA, solo aritmética conocida. El
// nutricionista sigue teniendo la última palabra: esto solo rellena un
// punto de partida razonable que luego puede ajustar a mano.

export type Sex = 'hombre' | 'mujer'
export type Formula = 'mifflin' | 'harris' | 'katch'
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

/** Mifflin-St Jeor — la fórmula más usada y más precisa para población general. */
export function bmrMifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'hombre' ? base + 5 : base - 161
}

/** Harris-Benedict (revisada) — más antigua, tiende a sobreestimar ligeramente. */
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
  sex: Sex
  weightKg: number
  heightCm: number
  age: number
  bodyFatPct?: number // solo necesario para 'katch'
  activity: ActivityLevel
  goal: Goal
  proteinGPerKg: number // g/kg de peso — el nutricionista decide el objetivo (ej. 1.6-2.2 en déficit/recomp)
  fatGPerKg: number // g/kg de peso
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

/** Reparto de macros: proteína y grasa fijadas por g/kg, el resto de las
 * kcal del objetivo se reparte en carbohidratos. La fibra sigue la guía
 * habitual de ~14g por cada 1000 kcal. */
export function computeMetabolicPlan(input: MetabolicInput): MetabolicResult | null {
  const { formula, sex, weightKg, heightCm, age, bodyFatPct, activity, goal, proteinGPerKg, fatGPerKg } = input
  if (!weightKg || weightKg <= 0 || !heightCm || heightCm <= 0 || !age || age <= 0) return null
  if (formula === 'katch' && (bodyFatPct == null || bodyFatPct <= 0 || bodyFatPct >= 100)) return null

  const bmr = formula === 'mifflin' ? bmrMifflinStJeor(sex, weightKg, heightCm, age)
    : formula === 'harris' ? bmrHarrisBenedict(sex, weightKg, heightCm, age)
    : bmrKatchMcArdle(weightKg, bodyFatPct as number)

  const tdee = bmr * ACTIVITY_FACTORS[activity]
  const kcalTarget = tdee * (1 + GOAL_ADJUSTMENTS[goal])

  const proteinG = proteinGPerKg * weightKg
  const fatG = fatGPerKg * weightKg
  const remainingKcal = Math.max(0, kcalTarget - (proteinG * 4 + fatG * 9))
  const carbsG = remainingKcal / 4
  const fiberG = (kcalTarget / 1000) * 14

  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee), kcalTarget: Math.round(kcalTarget),
    proteinG: Math.round(proteinG), fatG: Math.round(fatG), carbsG: Math.round(carbsG), fiberG: Math.round(fiberG),
  }
}

export function ageFromBirthDate(birthDate: string | null, referenceDate = new Date()): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate + 'T00:00:00')
  if (isNaN(birth.getTime())) return null
  let age = referenceDate.getFullYear() - birth.getFullYear()
  const monthDiff = referenceDate.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) age--
  return age
}
