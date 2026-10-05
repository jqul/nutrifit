// Alimentos propios: el borrador del formulario (todo texto, como lo teclea el
// nutricionista), su validación y su paso a columnas de la base de datos. Los
// límites de aquí coinciden con la restricción foods_custom_values_sane de la
// migración 0051: la base de datos es la última barrera, esto da el mensaje claro
// antes de llegar a ella.
import { Food } from '../types'

export const FOOD_CATEGORIES = ['Verdura', 'Fruta', 'Carbohidrato', 'Proteína', 'Lácteo', 'Legumbre', 'Grasa', 'Fruto seco', 'Suplemento', 'Otros']

/** Todos los valores son por 100 g. */
export const MAX_KCAL = 950
export const MAX_GRAMS_PER_100G = 100
/** Proteína + carbohidratos + grasa (con un margen de redondeo). */
export const MAX_MACRO_SUM_G = 105
export const MAX_NAME_LENGTH = 100

export interface FoodDraft {
  name: string; category: string
  kcal: string; proteinG: string; carbsG: string; fatG: string
  fiberG: string; sugarG: string; sodiumMg: string; saturatedFatG: string
  calciumMg: string; ironMg: string; zincMg: string
}

export function blankFoodDraft(name = ''): FoodDraft {
  return { name, category: 'Otros', kcal: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', sugarG: '', sodiumMg: '', saturatedFatG: '', calciumMg: '', ironMg: '', zincMg: '' }
}

const text = (n: number | null | undefined) => (n == null ? '' : String(n))

export function foodToDraft(f: Food): FoodDraft {
  return {
    name: f.name, category: f.category || 'Otros',
    kcal: text(f.kcal), proteinG: text(f.proteinG), carbsG: text(f.carbsG), fatG: text(f.fatG),
    fiberG: text(f.fiberG), sugarG: text(f.sugarG), sodiumMg: text(f.sodiumMg), saturatedFatG: text(f.saturatedFatG),
    calciumMg: text(f.calciumMg), ironMg: text(f.ironMg), zincMg: text(f.zincMg),
  }
}

/** Número tecleado ("1,5" o "1.5"); null si está vacío o no es un número. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Para comparar nombres sin mayúsculas, acentos ni espacios de más: "Plátano " = "platano". */
export const normalizeFoodName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export interface FoodValidation {
  /** Impiden guardar. */
  errors: string[]
  /** Avisan, pero se puede guardar. */
  warnings: string[]
}

type NumericKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG'
const REQUIRED: { key: NumericKey; label: string; max: number; unit: string }[] = [
  { key: 'kcal', label: 'Kcal', max: MAX_KCAL, unit: ' kcal' },
  { key: 'proteinG', label: 'Proteína', max: MAX_GRAMS_PER_100G, unit: ' g' },
  { key: 'carbsG', label: 'Carbohidratos', max: MAX_GRAMS_PER_100G, unit: ' g' },
  { key: 'fatG', label: 'Grasa', max: MAX_GRAMS_PER_100G, unit: ' g' },
]
const OPTIONAL: { key: keyof FoodDraft; label: string; max: number }[] = [
  { key: 'fiberG', label: 'Fibra', max: MAX_GRAMS_PER_100G }, { key: 'sugarG', label: 'Azúcares', max: MAX_GRAMS_PER_100G },
  { key: 'saturatedFatG', label: 'Grasas saturadas', max: MAX_GRAMS_PER_100G }, { key: 'sodiumMg', label: 'Sodio', max: 40000 },
  { key: 'calciumMg', label: 'Calcio', max: 5000 }, { key: 'ironMg', label: 'Hierro', max: 1000 }, { key: 'zincMg', label: 'Zinc', max: 1000 },
]

/**
 * `existing` son los alimentos que ya ve el nutricionista (los del sistema y los
 * suyos): el nombre no puede repetirse, porque los platos de un plan se enlazan
 * con el alimento POR NOMBRE. `editingId` excluye al propio alimento al editarlo.
 */
export function validateFoodDraft(d: FoodDraft, existing: { id: string; name: string }[], editingId: string | null = null): FoodValidation {
  const errors: string[] = []
  const warnings: string[] = []

  const name = d.name.trim()
  if (!name) errors.push('Ponle un nombre al alimento.')
  else if (name.length > MAX_NAME_LENGTH) errors.push(`El nombre es demasiado largo (máximo ${MAX_NAME_LENGTH} caracteres).`)
  else if (existing.some(f => f.id !== editingId && normalizeFoodName(f.name) === normalizeFoodName(name))) {
    errors.push(`Ya existe un alimento llamado «${name}» en el catálogo.`)
  }

  const values: Partial<Record<NumericKey, number>> = {}
  for (const { key, label, max, unit } of REQUIRED) {
    const n = parseNum(d[key])
    if (n == null) errors.push(`${label}: obligatorio (pon 0 si no tiene).`)
    else if (n < 0) errors.push(`${label}: no puede ser negativo.`)
    else if (n > max) errors.push(`${label}: máximo ${max}${unit} por 100 g.`)
    else values[key] = n
  }

  const { kcal, proteinG, carbsG, fatG } = values
  if (proteinG != null && carbsG != null && fatG != null && proteinG + carbsG + fatG > MAX_MACRO_SUM_G) {
    errors.push('Proteína + carbohidratos + grasa no pueden sumar más de 100 g por cada 100 g de alimento.')
  }

  for (const { key, label, max } of OPTIONAL) {
    if (d[key].trim() === '') continue
    const n = parseNum(d[key])
    if (n == null || n < 0 || n > max) errors.push(`${label}: pon un número entre 0 y ${max.toLocaleString('es-ES')}.`)
  }

  if (errors.length === 0 && kcal != null && proteinG != null && carbsG != null && fatG != null) {
    const estimated = proteinG * 4 + carbsG * 4 + fatG * 9
    const gap = Math.abs(kcal - estimated)
    if (gap > 30 && gap / Math.max(kcal, estimated, 1) > 0.2) {
      warnings.push(`Las kcal no cuadran con los macros (proteína, carbohidratos y grasa suman unas ${Math.round(estimated)} kcal). Revisa que sean por 100 g.`)
    }
    const sugar = parseNum(d.sugarG), fiber = parseNum(d.fiberG), sat = parseNum(d.saturatedFatG)
    if (sugar != null && sugar > carbsG + 0.5) warnings.push('Los azúcares no pueden superar a los carbohidratos.')
    if (fiber != null && fiber > carbsG + 0.5) warnings.push('La fibra no puede superar a los carbohidratos.')
    if (sat != null && sat > fatG + 0.5) warnings.push('Las grasas saturadas no pueden superar a la grasa total.')
  }
  return { errors, warnings }
}

/** Columnas de la tabla foods (sin nutricionista_id: lo pone quien inserta). */
export function draftToColumns(d: FoodDraft) {
  return {
    name: d.name.trim().replace(/\s+/g, ' '), category: d.category,
    kcal: parseNum(d.kcal) ?? 0, protein_g: parseNum(d.proteinG) ?? 0, carbs_g: parseNum(d.carbsG) ?? 0, fat_g: parseNum(d.fatG) ?? 0,
    fiber_g: parseNum(d.fiberG), sugar_g: parseNum(d.sugarG), sodium_mg: parseNum(d.sodiumMg), saturated_fat_g: parseNum(d.saturatedFatG),
    calcium_mg: parseNum(d.calciumMg), iron_mg: parseNum(d.ironMg), zinc_mg: parseNum(d.zincMg),
  }
}
