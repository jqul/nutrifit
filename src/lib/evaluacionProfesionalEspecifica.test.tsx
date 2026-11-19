import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DailyCheckin, WeightEntry } from '../types'
import { EVALUATION_TEXT, ProfessionalEvaluation } from '../components/shared/ProfessionalEvaluation'
import { CONFIRMATION_TEXT } from '../components/shared/ProfessionalConfirmation'
import { calculateMetabolicPlan } from './metabolicCalculator'
import { AdjustmentProfile, suggestDietAdjustment } from './dietAdjustment'
import { EVALUATION_REQUIRED_MESSAGE, GuardProfile, MIN_EVALUATION_REASON_CHARS, decideApply, decideSave, evaluateTargets, targetsFingerprint } from './planGuard'

// Lo que la app NO puede determinar (embarazo o lactancia + un objetivo del que no se sabe si implica pérdida de peso) queda PENDIENTE de una
// evaluación profesional ESPECÍFICA. TMB × 1,2 es solo una alerta: por debajo se bloquea; por encima NO certifica mantenimiento.
const TODAY = new Date(2026, 10, 19, 12)
const emb: GuardProfile = { sex: 'mujer', ageYears: 32, heightCm: 165, reproductiveStatus: 'embarazo', reproductiveCheck: 'ready' }
const KG = 60 // TMB = 10·60 + 6,25·165 − 5·32 − 161 = 1.310,25 → ×1,2 = 1.572,3
const t = (kcal: number) => ({ kcal, proteinG: Math.round(kcal * 0.2 / 4), carbsG: Math.round(kcal * 0.5 / 4), fatG: Math.round(kcal * 0.3 / 9) })
const ev = (goal: string | null, kcal: number, kg: number | null = KG, p: Partial<GuardProfile> = {}) => evaluateTargets({ ...emb, ...p }, goal, kg, t(kcal), { today: TODAY })
const codes = (e: { signals: { code: string }[] }) => e.signals.map(s => s.code)
const LARGO = 'Valorado con la persona y su matrona: objetivo de mantenimiento con ingesta suficiente.'

describe('1. Objetivo de la ficha «mantenimiento», «salud» o «rendimiento» pero las kcal podrían ser un déficit', () => {
  it('por debajo de TMB × 1,2: BLOQUEADO', () => {
    for (const goal of ['mantenimiento', 'salud', 'rendimiento', 'ganar_masa']) {
      const e = ev(goal, 1500)
      expect(e.blocked, goal).toBe(true)
      expect(codes(e), goal).toContain('EMBARAZO_LACTANCIA_PERDIDA_DE_PESO')
    }
  })
  it('por encima de TMB × 1,2: NO se certifica el mantenimiento; queda PENDIENTE de evaluación profesional específica', () => {
    for (const goal of ['mantenimiento', 'salud', 'rendimiento', 'ganar_masa']) for (const kcal of [1573, 1900, 2600]) {
      const e = ev(goal, kcal)
      expect(e.blocked, `${goal} ${kcal}`).toBe(false)
      expect(e.needsSpecificProfessionalEvaluation, `${goal} ${kcal}`).toBe(true)
      expect(codes(e), `${goal} ${kcal}`).toContain('EMBARAZO_LACTANCIA_REVISION')
    }
  })
  it('el texto de la señal dice que TMB × 1,2 no demuestra que no haya déficit y que no es una validación de seguridad', () => {
    const s = ev('mantenimiento', 1900).signals.find(x => x.code === 'EMBARAZO_LACTANCIA_REVISION')!
    expect(s.title).toMatch(/Pendiente de evaluación profesional/)
    expect(s.explanation).toMatch(/no demuestra que no haya déficit/)
    expect(s.explanation).toMatch(/no es una validación de seguridad/)
    expect(s.explanation).not.toMatch(/mantenimiento (confirmado|garantizado|seguro)|es seguro|apto/i)
  })
})

describe('2. Faltan datos para calcular la TMB', () => {
  it('sin peso, sin altura o sin sexo no se puede comparar con TMB × 1,2: pendiente de evaluación específica (no se supone mantenimiento)', () => {
    const casos: [string, GuardProfile, number | null][] = [
      ['sin peso', emb, null], ['sin altura', { ...emb, heightCm: null }, KG], ['sin sexo', { ...emb, sex: null }, KG], ['sin edad', { ...emb, ageYears: null }, KG],
    ]
    for (const [nombre, perfil, kg] of casos) {
      const e = evaluateTargets(perfil, 'mantenimiento', kg, t(1500), { today: TODAY })
      expect(e.blocked, nombre).toBe(false)
      expect(e.needsSpecificProfessionalEvaluation, nombre).toBe(true)
    }
  })
  it('sin objetivo en la ficha, aunque falten datos, se bloquea (no se puede descartar la pérdida)', () => {
    expect(evaluateTargets({ ...emb, sex: null }, null, null, t(2200), { today: TODAY }).blocked).toBe(true)
  })
})

describe('3. Una evaluación pendiente no se supera con la confirmación genérica ni se confunde con una validación', () => {
  const e = ev('mantenimiento', 1900)
  const fp = targetsFingerprint(t(1900), e)
  const base = { evaluation: e, fingerprint: fp, changed: true }

  it('la casilla genérica marcada para este mismo objetivo NO basta', () => {
    const d = decideSave({ ...base, confirmedFingerprint: fp })
    expect(d).toMatchObject({ allowed: false, reason: 'falta_evaluacion_profesional', message: EVALUATION_REQUIRED_MESSAGE })
    expect(EVALUATION_REQUIRED_MESSAGE).toMatch(/La casilla genérica no basta/)
    expect(EVALUATION_REQUIRED_MESSAGE).toMatch(/No es una validación de seguridad de la app/)
  })
  it('sin declaración, con una justificación corta, o de relleno: no se permite', () => {
    expect(decideSave({ ...base, confirmedFingerprint: null, attestation: null }).allowed).toBe(false)
    expect(decideSave({ ...base, confirmedFingerprint: null, attestation: { fingerprint: fp, reason: 'ok' } }).allowed).toBe(false)
    expect(decideSave({ ...base, confirmedFingerprint: null, attestation: { fingerprint: fp, reason: 'x'.repeat(MIN_EVALUATION_REASON_CHARS - 1) } }).allowed).toBe(false)
    expect(decideSave({ ...base, confirmedFingerprint: null, attestation: { fingerprint: fp, reason: ' '.repeat(50) + 'a' } }).allowed).toBe(false) // los espacios no cuentan
  })
  it('una declaración de otro objetivo (huella distinta) no vale: si se cambia algo tras declararla, hay que volver a hacerlo', () => {
    const otro = targetsFingerprint(t(1950), ev('mantenimiento', 1950))
    expect(decideSave({ ...base, confirmedFingerprint: null, attestation: { fingerprint: otro, reason: LARGO } }).allowed).toBe(false)
  })
  it('con la declaración específica (misma huella) y su justificación, se permite', () => {
    expect(decideSave({ ...base, confirmedFingerprint: null, attestation: { fingerprint: fp, reason: LARGO } })).toMatchObject({ allowed: true, reason: 'ok' })
  })
  it('lo bloqueado sigue bloqueado aunque haya declaración', () => {
    const b = ev('mantenimiento', 1500); const bfp = targetsFingerprint(t(1500), b)
    expect(decideSave({ evaluation: b, fingerprint: bfp, confirmedFingerprint: bfp, changed: true, attestation: { fingerprint: bfp, reason: LARGO } }).reason).toBe('bloqueado')
  })
  it('sin cambios de objetivos no se pide nada (guardar solo comidas)', () => {
    expect(decideSave({ ...base, changed: false, confirmedFingerprint: null }).reason).toBe('sin_cambios')
  })
  it('las revisiones normales (sin embarazo) siguen necesitando solo la casilla genérica: la evaluación específica es solo para lo no determinable', () => {
    const bajo = evaluateTargets({ ...emb, reproductiveStatus: 'ninguno' }, 'mantenimiento', KG, t(1100), { today: TODAY })
    expect(bajo.needsProfessionalReview).toBe(true)
    expect(bajo.needsSpecificProfessionalEvaluation).toBe(false)
    const f = targetsFingerprint(t(1100), bajo)
    expect(decideSave({ evaluation: bajo, fingerprint: f, confirmedFingerprint: f, changed: true }).allowed).toBe(true)
  })
  it('los textos no se confunden: la casilla genérica y la declaración específica dicen que no son auditadas ni una validación de la app', () => {
    for (const texto of [CONFIRMATION_TEXT, EVALUATION_TEXT]) { expect(texto).toMatch(/no auditada/); expect(texto).not.toMatch(/trazab|validación de seguridad garantizada|certific/i) }
    expect(EVALUATION_TEXT).toMatch(/no es una validación de seguridad de la app/)
    expect(EVALUATION_TEXT).toMatch(/declaro que he valorado/)
    expect(EVALUATION_TEXT).not.toBe(CONFIRMATION_TEXT)
  })
  it('la pantalla de la declaración exige la justificación y cuenta los caracteres que faltan', () => {
    const corto = renderToStaticMarkup(<ProfessionalEvaluation checked={false} onChange={() => {}} reason="ok" onReasonChange={() => {}} />)
    expect(corto).toContain('Pendiente de evaluación profesional')
    expect(corto).toContain(`mínimo ${MIN_EVALUATION_REASON_CHARS} caracteres`)
    expect(corto).toContain(`Faltan ${MIN_EVALUATION_REASON_CHARS - 2} caracteres`)
    expect(corto).toContain('no se guarda en ningún registro')
    expect(corto).toMatch(/<textarea id="[^"]+-reason"/)
    const largo = renderToStaticMarkup(<ProfessionalEvaluation checked onChange={() => {}} reason={LARGO} onReasonChange={() => {}} />)
    expect(largo).not.toContain('Faltan')
  })
})

describe('4. Coherencia entre entrada manual, plantillas, restauraciones, reajuste y calculadora', () => {
  const iso = (d: number) => { const x = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
  const w = (kgs: number[]): WeightEntry[] => kgs.map((kg, i) => ({ id: `w${i}`, clientId: 'c', date: iso((kgs.length - 1 - i) * 7), weightKg: kg, note: '' }))
  const ck: DailyCheckin[] = Array.from({ length: 30 }, (_, i) => ({ id: `k${i}`, clientId: 'c', date: iso(i), followedPlan: 'si', hunger: 3, energy: 3, mood: 3, waterL: null, notes: '' }) as DailyCheckin)
  const reajuste = (goal: string | null, profile: AdjustmentProfile) => suggestDietAdjustment({ weights: w([80, 80, 80, 80]), checkins: ck, goal, goalWeightKg: 70, plan: { kcal_target: 2000, protein_g: 150, carbs_g: 200, fat_g: 67, fiber_g: 28, advice: '', updatedAt: TODAY.getTime() - 30 * 86400000 }, profile }, TODAY)
  const perfilAdj: AdjustmentProfile = { sex: 'mujer', ageYears: 32, heightCm: 165, reproductiveStatus: 'embarazo', reproductiveCheck: 'ready' }

  type Clase = 'bloqueo' | 'pendiente_evaluacion' | 'revision'
  const clase = (e: ReturnType<typeof ev>): Clase => e.blocked ? 'bloqueo' : e.needsSpecificProfessionalEvaluation ? 'pendiente_evaluacion' : 'revision'
  const escenarios: [string, string | null, number, number | null, Clase][] = [
    ['sin objetivo en la ficha', null, 2200, KG, 'bloqueo'],
    ['«perder peso»', 'perder_peso', 2200, KG, 'bloqueo'],
    ['«mantenimiento» con kcal bajo TMB × 1,2', 'mantenimiento', 1500, KG, 'bloqueo'],
    ['«mantenimiento» con kcal por encima de TMB × 1,2', 'mantenimiento', 1900, KG, 'pendiente_evaluacion'],
    ['«salud» por encima', 'salud', 2000, KG, 'pendiente_evaluacion'],
    ['«rendimiento» por encima', 'rendimiento', 2400, KG, 'pendiente_evaluacion'],
    ['«mantenimiento» sin peso (sin TMB)', 'mantenimiento', 1900, null, 'pendiente_evaluacion'],
  ]
  it.each(escenarios)('%s → %s', (_n, goal, kcal, kg, esperado) => {
    const e = ev(goal, kcal, kg)
    expect(clase(e)).toBe(esperado)
    const fp = targetsFingerprint(t(kcal), e)
    // entrada manual y restauración (misma decisión)
    const sinDeclarar = decideSave({ evaluation: e, fingerprint: fp, confirmedFingerprint: fp, changed: true })
    expect(sinDeclarar.allowed).toBe(false)
    // plantilla y versión: lo bloqueado no se aplica; lo pendiente se aplica pero luego NO se puede guardar sin la declaración específica
    expect(decideApply(e, 'plantilla').allowed).toBe(esperado !== 'bloqueo')
    expect(decideApply(e, 'versión').allowed).toBe(esperado !== 'bloqueo')
    expect(sinDeclarar.reason).toBe(esperado === 'bloqueo' ? 'bloqueado' : 'falta_evaluacion_profesional')
    // reajuste: con embarazo no propone NADA en ningún caso (ni déficit ni subida)
    const r = reajuste(goal, perfilAdj)
    expect(r.kind).toBe('wait'); expect(r.proposal).toBeNull(); expect(r.deltaKcal).toBe(0)
  })
  it('calculadora: con embarazo, el déficit se bloquea y mantenimiento o superávit quedan pendientes de evaluación específica (no hay objetivo «validado»)', () => {
    const base = { formula: 'mifflin' as const, sex: 'mujer' as const, weightKg: KG, heightCm: 165, age: 32, activity: 'moderado' as const, proteinGPerKg: 1.6, fatGPerKg: 1, reproductiveStatus: 'embarazo' as const, today: TODAY }
    expect(calculateMetabolicPlan({ ...base, goal: 'deficit' }).plan).toBeNull()
    for (const goal of ['mantenimiento', 'superavit'] as const) {
      const o = calculateMetabolicPlan({ ...base, goal })
      expect(o.plan, goal).not.toBeNull()
      expect(o.evaluation.needsSpecificProfessionalEvaluation, goal).toBe(true)
    }
  })
  it('lactancia se trata igual que embarazo en todos los flujos', () => {
    const e = ev('mantenimiento', 1900, KG, { reproductiveStatus: 'lactancia' })
    expect(clase(e)).toBe('pendiente_evaluacion')
    expect(reajuste('mantenimiento', { ...perfilAdj, reproductiveStatus: 'lactancia' }).kind).toBe('wait')
  })
  it('un error de lectura del cuestionario no cambia nada de lo anterior (sigue pendiente o bloqueado, nunca permitido)', () => {
    expect(clase(ev('mantenimiento', 1900, KG, { reproductiveCheck: 'error' }))).toBe('pendiente_evaluacion')
    expect(clase(ev(null, 1900, KG, { reproductiveCheck: 'error' }))).toBe('bloqueo')
  })
})

describe('5. El código de las pantallas usa la declaración específica', () => {
  const fuentes = import.meta.glob(
    ['../components/trainer/client-panel/PlanDietaTab.tsx', '../components/trainer/client-panel/PlanVersions.tsx', '../components/trainer/client-panel/plan-dieta/MetabolicCalculatorPanel.tsx', '../components/trainer/client-panel/DietAdjustmentCard.tsx'],
    { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const src = (n: string) => Object.entries(fuentes).find(([k]) => k.endsWith(n))![1]
  it('manual, restauraciones y calculadora piden la evaluación específica cuando hace falta', () => {
    for (const f of ['PlanDietaTab.tsx', 'PlanVersions.tsx', 'MetabolicCalculatorPanel.tsx']) {
      const t = src(f)
      expect(t, f).toContain('ProfessionalEvaluation')
      expect(t, f).toContain('needsSpecificProfessionalEvaluation')
    }
  })
  it('la restauración decide con decideSave (la misma regla que el guardado) antes de llamar al servidor', () => {
    const t = src('PlanVersions.tsx')
    expect(t.indexOf('decideSave(')).toBeGreaterThan(0)
    expect(t.indexOf('restoreDecision && !restoreDecision.allowed')).toBeLessThan(t.indexOf("rpc('restore_plan_version'"))
  })
  it('el reajuste no aplica nada que esté pendiente de evaluación específica', () => {
    expect(src('DietAdjustmentCard.tsx')).toContain('needsSpecificProfessionalEvaluation')
  })
})
