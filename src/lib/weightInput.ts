// Un peso escrito a mano (en kg): admite coma o punto y solo vale si es una persona razonable.
export const MIN_WEIGHT_KG = 20
export const MAX_WEIGHT_KG = 400

export type WeightParse = { status: 'empty' } | { status: 'ok'; kg: number } | { status: 'invalid' }

export function parseWeightKg(text: string): WeightParse {
  const t = text.trim().replace(',', '.')
  if (t === '') return { status: 'empty' }
  if (!/^\d+(\.\d+)?$/.test(t)) return { status: 'invalid' }
  const kg = Math.round(parseFloat(t) * 10) / 10
  return kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG ? { status: 'ok', kg } : { status: 'invalid' }
}
