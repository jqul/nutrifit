// Los objetivos de macros se guardan siempre en gramos, pero muchos nutricionistas los piensan como un porcentaje de las
// calorías («30 % de proteína»). Esto convierte de un lado a otro con los 4-4-9 kcal/g de siempre; no cambia lo guardado.

export type MacroName = 'proteinG' | 'carbsG' | 'fatG'

export const KCAL_PER_G: Record<MacroName, number> = { proteinG: 4, carbsG: 4, fatG: 9 }

/** Gramos de un macro → % de las kcal (entero). null si no hay kcal o los gramos no son un número. */
export function gramsToPercent(kcal: number, grams: number, macro: MacroName): number | null {
  if (!(kcal > 0) || !Number.isFinite(grams) || grams < 0) return null
  return Math.round((grams * KCAL_PER_G[macro] / kcal) * 100)
}

/** % de las kcal → gramos de un macro (entero). null si no hay kcal o el porcentaje no es un número. */
export function percentToGrams(kcal: number, percent: number, macro: MacroName): number | null {
  if (!(kcal > 0) || !Number.isFinite(percent) || percent < 0) return null
  return Math.round((kcal * percent / 100) / KCAL_PER_G[macro])
}

/** Suma de los porcentajes de proteína, carbos y grasas (lo que debería acercarse a 100). null si falta alguno. */
export function percentTotal(kcal: number, grams: Record<MacroName, number>): number | null {
  const parts = (Object.keys(KCAL_PER_G) as MacroName[]).map(m => gramsToPercent(kcal, grams[m], m))
  return parts.some(p => p == null) ? null : (parts as number[]).reduce((a, b) => a + b, 0)
}
