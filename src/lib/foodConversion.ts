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

export interface Macros {
  kcal: number; proteinG: number; carbsG: number; fatG: number
  fiberG: number | null; sugarG: number | null; sodiumMg: number | null; saturatedFatG: number | null
  calciumMg: number | null; ironMg: number | null; zincMg: number | null
}

function scaleNullable(v: number | null | undefined, factor: number): number | null {
  return v != null ? Math.round(v * factor * 10) / 10 : null
}

/** Escala los macros (y nutrientes ampliados, si el alimento los tiene) por 100g a la cantidad indicada. */
export function computeMacros(food: Food, quantity: number, unit: string): Macros | null {
  const grams = convertQuantity(quantity, unit, 'g')
  if (grams == null) return null
  const factor = grams / 100
  return {
    kcal: Math.round(food.kcal * factor),
    proteinG: Math.round(food.proteinG * factor * 10) / 10,
    carbsG: Math.round(food.carbsG * factor * 10) / 10,
    fatG: Math.round(food.fatG * factor * 10) / 10,
    fiberG: scaleNullable(food.fiberG, factor),
    sugarG: scaleNullable(food.sugarG, factor),
    sodiumMg: scaleNullable(food.sodiumMg, factor),
    saturatedFatG: scaleNullable(food.saturatedFatG, factor),
    calciumMg: scaleNullable(food.calciumMg, factor),
    ironMg: scaleNullable(food.ironMg, factor),
    zincMg: scaleNullable(food.zincMg, factor),
  }
}

export type MacroKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG'
export const MACRO_KEY_PER_100G: Record<MacroKey, keyof Food> = {
  kcal: 'kcal', proteinG: 'proteinG', carbsG: 'carbsG', fatG: 'fatG',
}

/**
 * Sustituto de un alimento por otro: cuántos gramos de `toFood` aportan el mismo
 * valor de `matchBy` que `quantity` `unit` de `fromFood` (ej. "150g de pollo ≈
 * cuántos gramos de tofu para igualar la proteína"). Null si la unidad de origen
 * no es convertible, o si el alimento destino no aporta nada de ese macro (división por cero).
 */
export function computeSubstitution(
  fromFood: Food, quantity: number, unit: string, toFood: Food, matchBy: MacroKey
): number | null {
  const grams = convertQuantity(quantity, unit, 'g')
  if (grams == null) return null
  const targetPer100g = fromFood[MACRO_KEY_PER_100G[matchBy]] as number
  const target = (targetPer100g * grams) / 100
  const toPer100g = toFood[MACRO_KEY_PER_100G[matchBy]] as number
  if (toPer100g === 0) return null
  return (target * 100) / toPer100g
}

export interface MacroDiff { kcal: number; proteinG: number; carbsG: number; fatG: number }

/**
 * Diferencia de macros (toFood - fromFood) al hacer la sustitución completa —
 * el macro igualado (matchBy) siempre sale ~0, los otros muestran cuánto se
 * gana o se pierde al hacer el cambio (ej. cambiar pollo por tofu igualando
 * proteína: cuánta grasa de más o de menos, cuántos carbohidratos de más).
 */
export function computeSubstitutionDiff(
  fromFood: Food, quantity: number, unit: string, toFood: Food, substituteGrams: number
): MacroDiff | null {
  const fromMacros = computeMacros(fromFood, quantity, unit)
  const toMacros = computeMacros(toFood, substituteGrams, 'g')
  if (!fromMacros || !toMacros) return null
  return {
    kcal: Math.round((toMacros.kcal - fromMacros.kcal) * 10) / 10,
    proteinG: Math.round((toMacros.proteinG - fromMacros.proteinG) * 10) / 10,
    carbsG: Math.round((toMacros.carbsG - fromMacros.carbsG) * 10) / 10,
    fatG: Math.round((toMacros.fatG - fromMacros.fatG) * 10) / 10,
  }
}
