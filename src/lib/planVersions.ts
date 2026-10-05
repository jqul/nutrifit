// Versiones del plan: instantáneas completas que guarda la base de datos
// (tabla diet_plan_versions, migración 0049) y cómo describirlas. Aquí solo hay
// lectura y comparación; crear y restaurar versiones lo hacen las funciones SQL
// create_plan_version y restore_plan_version.
import { diffPlanTargets, formatPlanChange, PlanTargets } from './planChanges'

export interface SnapshotItem {
  food_name: string
  quantity: string
  unit: string
  kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  sort_order: number
  [column: string]: unknown
}

export interface SnapshotMeal {
  name: string
  time: string
  kcal_target: number | null
  sort_order: number
  day_of_week: number | null
  option_label: string | null
  items: SnapshotItem[]
  [column: string]: unknown
}

export interface SnapshotSupplement { name: string; dose: string; timing: string; visible_to_client: boolean; [column: string]: unknown }

export interface PlanSnapshot {
  name: string
  kcal_target: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  advice: string
  meals: SnapshotMeal[]
  supplements: SnapshotSupplement[]
}

export interface PlanVersionRow {
  id: string
  plan_id: string
  client_id: string
  version_number: number
  snapshot: PlanSnapshot
  note: string | null
  restored_from: number | null
  created_at: string
  created_by: string | null
}

const DAY_LABELS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Cómo se llama una comida en la lista: "Comida", "Comida · martes", "Cena · opción B". */
export function mealLabel(m: Pick<SnapshotMeal, 'name' | 'day_of_week' | 'option_label'>): string {
  const parts = [m.name || 'Comida']
  if (m.day_of_week != null) parts.push(DAY_LABELS[m.day_of_week] ?? `día ${m.day_of_week}`)
  if (m.option_label) parts.push(m.option_label)
  return parts.join(' · ')
}

export interface SnapshotSummary { kcal: number; proteinG: number; carbsG: number; fatG: number; meals: number; items: number; supplements: number }

export function summarizeSnapshot(s: PlanSnapshot): SnapshotSummary {
  return {
    kcal: s.kcal_target, proteinG: s.protein_g, carbsG: s.carbs_g, fatG: s.fat_g,
    meals: s.meals.length, items: s.meals.reduce((n, m) => n + m.items.length, 0), supplements: s.supplements.length,
  }
}

const targetsOf = (s: PlanSnapshot): PlanTargets => ({
  kcal_target: Number(s.kcal_target) || 0, protein_g: Number(s.protein_g) || 0, carbs_g: Number(s.carbs_g) || 0,
  fat_g: Number(s.fat_g) || 0, fiber_g: Number(s.fiber_g) || 0, advice: s.advice || '',
})

// Una comida se identifica por su nombre, hora, día y opción: dos plantillas del
// mismo plan pueden tener "Cena" pero no a la vez en el mismo día y opción.
const mealKey = (m: SnapshotMeal) => `${m.name}|${m.time}|${m.day_of_week ?? ''}|${m.option_label ?? ''}`
const itemsSignature = (m: SnapshotMeal) => JSON.stringify(m.items.map(i => [i.food_name, i.quantity, i.unit]))

/**
 * Qué cambiaría en el plan si se restaurase `target` estando ahora como
 * `current`: líneas legibles, de más a menos importantes. Vacío = son idénticos.
 */
export function describeRestore(current: PlanSnapshot, target: PlanSnapshot): string[] {
  const lines: string[] = []

  for (const c of diffPlanTargets(targetsOf(current), targetsOf(target))) lines.push(formatPlanChange(c))

  const now = new Map(current.meals.map(m => [mealKey(m), m]))
  const then = new Map(target.meals.map(m => [mealKey(m), m]))
  const added = target.meals.filter(m => !now.has(mealKey(m))).map(mealLabel)
  const removed = current.meals.filter(m => !then.has(mealKey(m))).map(mealLabel)
  const changed = target.meals.filter(m => now.has(mealKey(m)) && itemsSignature(now.get(mealKey(m))!) !== itemsSignature(m)).map(mealLabel)
  if (added.length) lines.push(`Vuelven las comidas: ${added.join(', ')}`)
  if (removed.length) lines.push(`Dejan de estar las comidas: ${removed.join(', ')}`)
  if (changed.length) lines.push(`Alimentos distintos en: ${changed.join(', ')}`)

  const nowSup = new Set(current.supplements.map(s => `${s.name}|${s.dose}|${s.timing}`))
  const thenSup = new Set(target.supplements.map(s => `${s.name}|${s.dose}|${s.timing}`))
  const supAdded = [...thenSup].filter(k => !nowSup.has(k)).map(k => k.split('|')[0])
  const supRemoved = [...nowSup].filter(k => !thenSup.has(k)).map(k => k.split('|')[0])
  if (supAdded.length) lines.push(`Vuelven los suplementos: ${supAdded.join(', ')}`)
  if (supRemoved.length) lines.push(`Dejan de estar los suplementos: ${supRemoved.join(', ')}`)

  return lines
}
