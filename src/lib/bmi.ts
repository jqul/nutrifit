// Índice de masa corporal — fórmula estándar (peso en kg / altura en m al
// cuadrado) con las categorías de la OMS. Solo orientativo: no distingue
// composición corporal (masa muscular vs. grasa), así que un cliente muy
// musculado puede caer en "sobrepeso" sin que sea un problema real.
export type BmiCategory = 'bajo peso' | 'normal' | 'sobrepeso' | 'obesidad'

export function calcBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'bajo peso'
  if (bmi < 25) return 'normal'
  if (bmi < 30) return 'sobrepeso'
  return 'obesidad'
}
