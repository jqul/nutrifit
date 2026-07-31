import { Food } from '../types'

/** Gramos (o ml, para líquidos) equivalentes a una unidad de medida casera habitual. */
export const UNIT_GRAMS: Record<string, number> = {
  g: 1,
  ml: 1,
  cucharada: 15,
  cucharadita: 5,
  taza: 240,
  vaso: 200,
  puñado: 30,
}

export const CONVERTIBLE_UNITS = Object.keys(UNIT_GRAMS)

/** Convierte una cantidad de una unidad casera a otra, vía su equivalencia en gramos. Null si alguna unidad no es convertible (ej. "unidad", que depende del alimento). */
export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  const from = UNIT_GRAMS[fromUnit.toLowerCase().trim()]
  const to = UNIT_GRAMS[toUnit.toLowerCase().trim()]
  if (from == null || to == null) return null
  return (quantity * from) / to
}

export interface Macros { kcal: number; proteinG: number; carbsG: number; fatG: number }

/** Escala los macros por 100g de un alimento a la cantidad indicada (en la unidad dada). */
export function computeMacros(food: Food, quantity: number, unit: string): Macros | null {
  const grams = convertQuantity(quantity, unit, 'g')
  if (grams == null) return null
  const factor = grams / 100
  return {
    kcal: Math.round(food.kcal * factor),
    proteinG: Math.round(food.proteinG * factor * 10) / 10,
    carbsG: Math.round(food.carbsG * factor * 10) / 10,
    fatG: Math.round(food.fatG * factor * 10) / 10,
  }
}
