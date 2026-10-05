// Historial de cambios del plan: qué objetivos se tocaron, de qué a qué. El
// registro real lo escribe un trigger en la base de datos (migración 0046);
// aquí está el mismo criterio en TypeScript para avisar al nutricionista de que
// va a quedar registrado y pedirle el motivo, y para mostrar el historial.

export type PlanChangeField = 'kcal_target' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'advice'

export interface PlanChange {
  field: PlanChangeField
  from: number | string | null
  to: number | string | null
}

export interface PlanTargets {
  kcal_target: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  advice: string
}

const FIELDS: PlanChangeField[] = ['kcal_target', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'advice']

const LABEL: Record<PlanChangeField, string> = {
  kcal_target: 'Kcal', protein_g: 'Proteína', carbs_g: 'Carbohidratos', fat_g: 'Grasas', fiber_g: 'Fibra', advice: 'Consejo',
}
const UNIT: Partial<Record<PlanChangeField, string>> = { protein_g: ' g', carbs_g: ' g', fat_g: ' g', fiber_g: ' g' }

const isEmptyPlan = (t: PlanTargets) => !t.kcal_target && !t.protein_g && !t.carbs_g && !t.fat_g && !t.fiber_g

/**
 * Cambios entre los objetivos guardados y los que se van a guardar. Un plan
 * recién creado (todo a 0) no tiene objetivos todavía: definirlos por primera
 * vez no cuenta como cambio, igual que en el trigger.
 */
export function diffPlanTargets(before: PlanTargets | null, after: PlanTargets): PlanChange[] {
  if (!before || isEmptyPlan(before)) return []
  return FIELDS
    .filter(f => before[f] !== after[f])
    .map(f => ({ field: f, from: before[f], to: after[f] }))
}

const fmtNum = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/** "Kcal: 2100 → 1950", "Proteína: 150 → 155 g", "Consejo modificado". */
export function formatPlanChange(c: PlanChange): string {
  if (c.field === 'advice') return 'Consejo modificado'
  const unit = UNIT[c.field] ?? ''
  const val = (v: PlanChange['from']) => (typeof v === 'number' ? fmtNum(v) : v == null ? '—' : String(v))
  return `${LABEL[c.field]}: ${val(c.from)} → ${val(c.to)}${unit}`
}

/** Valores del formulario (texto) como objetivos numéricos, igual que al guardar. */
export function targetsFromForm(f: { kcal: string; protein: string; carbs: string; fat: string; fiber: string; advice: string }): PlanTargets {
  const n = (s: string) => parseFloat(s) || 0
  return { kcal_target: n(f.kcal), protein_g: n(f.protein), carbs_g: n(f.carbs), fat_g: n(f.fat), fiber_g: n(f.fiber), advice: f.advice }
}
