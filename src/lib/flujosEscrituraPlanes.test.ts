import { describe, it, expect } from 'vitest'

// Auditoría automática de los caminos de ESCRITURA de objetivos de plan desde la aplicación: cada uno está en una lista cerrada y, si
// pasa por planSafety, lo hace ANTES de escribir. Si alguien añade un camino nuevo (o quita la evaluación de uno), este test falla.
// Lo que NO puede ver: lo que se ejecuta en el servidor (cron de fases 0068, llamadas directas a la API): ver docs/calculadora-metabolica.md.
const todos = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const codigo = Object.entries(todos).filter(([p]) => !/\.test\.tsx?$/.test(p) && !p.includes('/supabase/'))
const donde = (re: RegExp) => codigo.filter(([, t]) => re.test(t)).map(([p]) => p.replace('../', 'src/')).sort()
const texto = (suffix: string) => codigo.find(([p]) => p.endsWith(suffix))![1]

describe('caminos de escritura de planes: lista cerrada', () => {
  it('save_diet_plan solo se llama desde PlanDietaTab, y después de decideSave', () => {
    expect(donde(/rpc\(\s*'save_diet_plan'/)).toEqual(['src/components/trainer/client-panel/PlanDietaTab.tsx'])
    const t = texto('PlanDietaTab.tsx')
    expect(t.indexOf('decideSave(')).toBeGreaterThan(0)
    expect(t.indexOf('decideSave(')).toBeLessThan(t.indexOf("rpc('save_diet_plan'"))
  })
  it('restore_plan_version solo se llama desde PlanVersions, tras evaluar con decideApply y con la evaluación obligatoria', () => {
    expect(donde(/rpc\(\s*'restore_plan_version'/)).toEqual(['src/components/trainer/client-panel/PlanVersions.tsx'])
    const t = texto('PlanVersions.tsx')
    expect(t.indexOf('decideApply(')).toBeGreaterThan(0)
    expect(t.indexOf('decideApply(')).toBeLessThan(t.indexOf("rpc('restore_plan_version'"))
    expect(t).toMatch(/evaluateSnapshot: \(snapshot: PlanSnapshot\) => PlanEvaluation/) // obligatoria (sin «?»)
    expect(t).not.toMatch(/evaluateSnapshot\?:/)
  })
  it('todo uso de <PlanVersions> pasa la evaluación', () => {
    const usos = codigo.flatMap(([p, t]) => [...t.matchAll(/<PlanVersions\b[^>]*?(?:\/>|>)/gs)].map(m => ({ p, tag: m[0] })))
    expect(usos.length).toBe(1)
    for (const u of usos) expect(u.tag, u.p).toContain('evaluateSnapshot=')
  })
  it('el UPDATE directo de diet_plans solo existe en el reajuste, que evalúa la cifra que se aplica', () => {
    expect(donde(/from\('diet_plans'\)\s*\.update\(/)).toEqual(['src/components/trainer/client-panel/DietAdjustmentCard.tsx'])
    const t = texto('DietAdjustmentCard.tsx')
    expect(t).toContain('evaluateAdjustmentTarget(')
    expect(t.indexOf('blocked ||')).toBeGreaterThan(0)
    expect(t.indexOf('blocked ||')).toBeLessThan(t.indexOf("from('diet_plans').update("))
  })
  it('el único INSERT en diet_plans crea un plan VACÍO (todos los objetivos a 0)', () => {
    expect(donde(/from\('diet_plans'\)\s*\.insert\(/)).toEqual(['src/components/trainer/client-panel/PlanDietaTab.tsx'])
    const t = texto('PlanDietaTab.tsx')
    const i = t.indexOf("from('diet_plans').insert(")
    expect(t.slice(i, i + 400)).toMatch(/kcal_target: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0/)
  })
  it('no hay UPSERT ni DELETE de diet_plans desde la app', () => {
    expect(donde(/from\('diet_plans'\)\s*\.(upsert|delete)\(/)).toEqual([])
  })
  it('las funciones de borde no escriben planes', () => {
    expect(donde(/diet_plans/).filter(p => p.includes('functions'))).toEqual([])
  })
})

describe('los flujos de aplicación evalúan antes de cambiar nada', () => {
  it('aplicar una plantilla evalúa con decideApply antes de tocar el formulario', () => {
    const t = texto('PlanDietaTab.tsx')
    const i = t.indexOf('const applyTemplate = (tpl: DietTemplateRow) => {')
    expect(i).toBeGreaterThan(0)
    const cuerpo = t.slice(i, i + 3500)
    expect(cuerpo.indexOf("decideApply(")).toBeGreaterThan(0)
    expect(cuerpo.indexOf('decideApply(')).toBeLessThan(cuerpo.indexOf('setKcalTarget('))
  })
  it('la calculadora no escribe nada: solo rellena el formulario (y luego rige la guarda de guardado)', () => {
    const t = texto('MetabolicCalculatorPanel.tsx')
    expect(t).not.toMatch(/supabase/)
  })
})

describe('lo que NO está protegido está avisado en pantalla', () => {
  it('las fases con aplicación automática (cron) avisan de que no pasan por la evaluación y de que el aviso no es una protección', () => {
    const t = texto('PlanPhasesCard.tsx')
    expect(t).toMatch(/NO pasa por la evaluación de seguridad del plan/)
    expect(t).toMatch(/no es una protección/)
    expect(t).toMatch(/Este aviso no impide ni corrige nada/)
    // y no afirma lo contrario
    expect(t).not.toMatch(/protegid[oa]|queda protegid|pasa por la evaluación de seguridad(?! del plan)/i)
  })
})
