import { DietPlan } from '../../../../types'
import { MacroKey } from '../../../../lib/foodConversion'

export interface EditableItem {
  id: string; foodName: string; quantity: string; unit: string
  kcal: string; proteinG: string; carbsG: string; fatG: string
  fiberG: string; sugarG: string; sodiumMg: string; saturatedFatG: string
  calciumMg: string; ironMg: string; zincMg: string
  recipeId?: string | null
}
// 0=lunes...6=domingo. null = todos los días (comportamiento anterior al
// cuadrante semanal — los planes ya creados siguen así hasta que se les
// asigne un día concreto a alguna comida).
export interface EditableMeal {
  id: string; name: string; time: string; kcalTarget: string; dayOfWeek: number | null
  optionGroup: string | null; optionLabel: string | null
  dayType: 'on' | 'off' | null
  items: EditableItem[]
}
export interface EditableSupplement { id: string; name: string; dose: string; timing: string; visibleToClient: boolean }

export const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function newId() { return crypto.randomUUID() }

export const MACRO_LABELS: Record<MacroKey, string> = { kcal: 'kcal', proteinG: 'proteína', carbsG: 'carbohidratos', fatG: 'grasas' }

/** Suma de macros de una comida/receta completa — la "calculadora de recetas":
 * a partir de los alimentos individuales, el total nutricional del plato. */
export function sumItemMacros(items: EditableItem[]) {
  return items.reduce((acc, i) => ({
    kcal: acc.kcal + (parseFloat(i.kcal) || 0),
    proteinG: acc.proteinG + (parseFloat(i.proteinG) || 0),
    carbsG: acc.carbsG + (parseFloat(i.carbsG) || 0),
    fatG: acc.fatG + (parseFloat(i.fatG) || 0),
    fiberG: acc.fiberG + (parseFloat(i.fiberG) || 0),
  }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
}

/** Suma de macros de un conjunto de comidas — para las barras de progreso
 * "objetivo vs. lo sumado en las comidas". Cada comida cuenta una sola vez:
 * quien llama debe pasar ya solo una comida por hueco (p.ej. una por grupo
 * de opciones intercambiables), no todas las alternativas a la vez. */
export function sumMealsMacros(meals: EditableMeal[]) {
  return meals.reduce((acc, m) => {
    const t = sumItemMacros(m.items)
    return { kcal: acc.kcal + t.kcal, proteinG: acc.proteinG + t.proteinG, carbsG: acc.carbsG + t.carbsG, fatG: acc.fatG + t.fatG, fiberG: acc.fiberG + t.fiberG }
  }, { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 })
}

export const SCALABLE_ITEM_FIELDS: (keyof EditableItem)[] = [
  'quantity', 'kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sugarG', 'sodiumMg', 'saturatedFatG', 'calciumMg', 'ironMg', 'zincMg',
]

/** Escala una receta entera (todos los ingredientes) a un objetivo de kcal,
 * multiplicando cada gramaje por el mismo factor — al escalar todo por igual,
 * las proporciones de macros se mantienen automáticamente. Es el "escalado
 * automático por tramo calórico": la misma receta sirve para un objetivo de
 * 400, 600 u 800 kcal sin tener que rehacerla a mano. */
export function scaleRecipeToKcal(items: EditableItem[], targetKcal: number): EditableItem[] {
  const currentKcal = items.reduce((sum, i) => sum + (parseFloat(i.kcal) || 0), 0)
  if (currentKcal <= 0) return items.map(i => ({ ...i, id: newId() }))
  const factor = targetKcal / currentKcal
  return items.map(item => {
    const scaled: EditableItem = { ...item, id: newId() }
    for (const field of SCALABLE_ITEM_FIELDS) {
      const raw = item[field]
      if (raw) {
        const num = parseFloat(raw)
        if (!isNaN(num)) scaled[field] = String(Math.round(num * factor * 10) / 10)
      }
    }
    return scaled
  })
}

export function demoPlanToEditable(plan: DietPlan) {
  return {
    kcalTarget: String(plan.kcalTarget), proteinG: String(plan.proteinG),
    carbsG: String(plan.carbsG), fatG: String(plan.fatG), fiberG: String(plan.fiberG), advice: plan.advice,
    meals: plan.meals.map(m => ({
      id: m.id, name: m.name, time: m.time, kcalTarget: m.kcalTarget != null ? String(m.kcalTarget) : '',
      dayOfWeek: m.dayOfWeek ?? null, optionGroup: m.optionGroup ?? null, optionLabel: m.optionLabel ?? null,
      dayType: m.dayType ?? null,
      items: m.items.map(i => ({
        id: i.id, foodName: i.foodName, quantity: i.quantity, unit: i.unit,
        kcal: i.kcal != null ? String(i.kcal) : '', proteinG: i.proteinG != null ? String(i.proteinG) : '',
        carbsG: i.carbsG != null ? String(i.carbsG) : '', fatG: i.fatG != null ? String(i.fatG) : '',
        fiberG: i.fiberG != null ? String(i.fiberG) : '', sugarG: i.sugarG != null ? String(i.sugarG) : '',
        sodiumMg: i.sodiumMg != null ? String(i.sodiumMg) : '', saturatedFatG: i.saturatedFatG != null ? String(i.saturatedFatG) : '',
        calciumMg: i.calciumMg != null ? String(i.calciumMg) : '', ironMg: i.ironMg != null ? String(i.ironMg) : '',
        zincMg: i.zincMg != null ? String(i.zincMg) : '', recipeId: i.recipeId ?? null,
      })),
    })),
    supplements: plan.supplements.map(s => ({ id: s.id, name: s.name, dose: s.dose, timing: s.timing, visibleToClient: s.visibleToClient })),
  }
}
