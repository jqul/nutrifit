import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClientData, DailyCheckin, WeightEntry } from '../types'
import { MetabolicCalculatorPanel } from '../components/trainer/client-panel/plan-dieta/MetabolicCalculatorPanel'
import { calculateMetabolicPlan } from './metabolicCalculator'
import { AdjustmentPlan, AdjustmentProfile, suggestDietAdjustment } from './dietAdjustment'
import { GuardProfile, decideApply, decideSave, evaluateTargets, targetsFingerprint, weightLossLikely } from './planGuard'

// Embarazo o lactancia declarados + (posible) pérdida de peso: no se genera, no se propone ni se guarda un déficit, y NO se puede eludir
// dejando vacío o cambiando el objetivo de la ficha (client.goal).
const TODAY = new Date(2026, 10, 19, 12)
const GOALS_FICHA: (string | null)[] = [null, '', 'perder_peso', 'mantenimiento', 'ganar_masa', 'salud', 'rendimiento', 'otra cosa libre']

describe('1. Calculadora: sin objetivo en la ficha + déficit seleccionado + embarazo → bloqueado', () => {
  const base = { formula: 'mifflin' as const, sex: 'mujer' as const, weightKg: 65, heightCm: 165, age: 32, activity: 'moderado' as const, proteinGPerKg: 1.6, fatGPerKg: 1, today: TODAY }
  it('con déficit y embarazo/lactancia no se calcula nada, ni siquiera la TMB', () => {
    for (const reproductiveStatus of ['embarazo', 'lactancia'] as const) {
      const o = calculateMetabolicPlan({ ...base, goal: 'deficit', reproductiveStatus })
      expect(o.plan, reproductiveStatus).toBeNull()
      expect(o.energy, reproductiveStatus).toBeNull()
      expect(o.evaluation.signals.map(s => s.code)).toContain('EMBARAZO_LACTANCIA_PERDIDA_DE_PESO')
    }
  })
  it('la pantalla de la calculadora no lee client.goal: sea cual sea el objetivo de la ficha, con embarazo y el déficit por defecto está bloqueada', () => {
    for (const goal of GOALS_FICHA) {
      const client = { id: 'c', name: 'Ana', gender: 'Mujer', birthDate: `${new Date().getFullYear() - 32}-01-15`, heightCm: 165, goal } as unknown as ClientData
      const out = renderToStaticMarkup(<MetabolicCalculatorPanel client={client} onClose={() => {}} onApply={() => {}} reproductiveAnswer="Embarazo" reproductiveCheck="ready" />)
      expect(out, String(goal)).toContain('En embarazo no se calcula un objetivo de pérdida de peso')
      expect(out, String(goal)).not.toContain('Aplicar al plan')
    }
  })
})

describe('2. Reajuste: el mismo caso no propone nada, con cualquier objetivo de la ficha', () => {
  const iso = (daysAgo: number) => { const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - daysAgo); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const weights = (kgs: number[]): WeightEntry[] => kgs.map((kg, i) => ({ id: `w${i}`, clientId: 'c', date: iso((kgs.length - 1 - i) * 7), weightKg: kg, note: '' }))
  const checkins: DailyCheckin[] = Array.from({ length: 30 }, (_, i) => ({ id: `k${i}`, clientId: 'c', date: iso(i), followedPlan: 'si', hunger: 3, energy: 3, mood: 3, waterL: null, notes: '' }) as DailyCheckin)
  const plan: AdjustmentPlan = { kcal_target: 2000, protein_g: 150, carbs_g: 200, fat_g: 67, fiber_g: 28, advice: '', updatedAt: TODAY.getTime() - 30 * 86400000 }
  const profile = (reproductiveStatus: 'embarazo' | 'lactancia'): AdjustmentProfile => ({ sex: 'mujer', ageYears: 32, birthDate: null, heightCm: 165, reproductiveStatus, reproductiveCheck: 'ready' })

  it.each(GOALS_FICHA.map(g => [String(g), g] as const))('objetivo de la ficha «%s»: sin déficit (ni ningún otro reajuste)', (_n, goal) => {
    for (const estado of ['embarazo', 'lactancia'] as const) for (const kgs of [[80, 80, 80, 80], [80, 80.6, 81.2, 81.8], [80, 79, 78, 77]]) {
      const r = suggestDietAdjustment({ weights: weights(kgs), checkins, goal, goalWeightKg: 70, plan, profile: profile(estado) }, TODAY)
      expect(r.kind, `${estado} ${kgs}`).toBe('wait')
      expect(r.proposal).toBeNull()
      expect(r.deltaKcal).toBe(0)
      expect(r.headline).toMatch(/embarazo|lactancia/)
      expect(r.signals.map(s => s.code).some(c => c.startsWith('EMBARAZO_LACTANCIA'))).toBe(true)
    }
  })
  it('cambiar el objetivo de la ficha no cambia el resultado: es el mismo para todos los objetivos', () => {
    const resultados = GOALS_FICHA.map(goal => { const r = suggestDietAdjustment({ weights: weights([80, 80, 80, 80]), checkins, goal, goalWeightKg: 70, plan, profile: profile('embarazo') }, TODAY); return [r.kind, r.deltaKcal, r.proposal === null] })
    expect(new Set(resultados.map(r => JSON.stringify(r))).size).toBe(1)
  })
})

describe('3. Entrada manual, plantillas y restauraciones: cambiar el objetivo de la ficha no permite eludirlo', () => {
  const emb: GuardProfile = { sex: 'mujer', ageYears: 32, heightCm: 165, reproductiveStatus: 'embarazo', reproductiveCheck: 'ready' }
  const ev = (goal: string | null, kcal: number, kg: number | null = 60, p: Partial<GuardProfile> = {}) =>
    evaluateTargets({ ...emb, ...p }, goal, kg, { kcal, proteinG: Math.round(kcal * 0.2 / 4), carbsG: Math.round(kcal * 0.5 / 4), fatG: Math.round(kcal * 0.3 / 9) }, { today: TODAY })
  const codes = (e: { signals: { code: string }[] }) => e.signals.map(s => s.code)

  it('ficha sin objetivo (vacío, null o texto libre) + embarazo: BLOQUEADO, también con un objetivo energético alto', () => {
    for (const goal of [null, '', '   ', 'otra cosa libre']) {
      const e = ev(goal, 2200)
      expect(codes(e), String(goal)).toContain('EMBARAZO_LACTANCIA_PERDIDA_DE_PESO')
      expect(e.blocked, String(goal)).toBe(true)
    }
  })
  it('«perder peso» en la ficha + embarazo: bloqueado', () => { expect(ev('perder_peso', 2200).blocked).toBe(true) })
  it('TMB de referencia: mujer de 32 años, 165 cm, 60 kg → 1.310; ×1,2 = 1.572', () => {
    // 10·60 + 6,25·165 − 5·32 − 161 = 1.310,25
    expect(weightLossLikely('mantenimiento', 1500, 1310.25)).toBe(true)
    expect(weightLossLikely('mantenimiento', 1600, 1310.25)).toBe(false)
  })
  it('cambiar la ficha a «mantenimiento» NO elude el bloqueo si las kcal están por debajo del mantenimiento mínimo (TMB × 1,2)', () => {
    for (const goal of ['mantenimiento', 'ganar_masa', 'salud', 'rendimiento']) {
      const e = ev(goal, 1500)
      expect(codes(e), goal).toContain('EMBARAZO_LACTANCIA_PERDIDA_DE_PESO')
      expect(e.blocked, goal).toBe(true)
    }
  })
  it('el mismo objetivo es siempre bloqueado: da igual qué objetivo se ponga en la ficha mientras las kcal sigan por debajo del mantenimiento', () => {
    const resultados = [null, '', 'perder_peso', 'mantenimiento', 'ganar_masa', 'salud', 'rendimiento', 'libre'].map(g => ev(g, 1500).blocked)
    expect(resultados.every(Boolean)).toBe(true)
  })
  it('LÍMITE que queda: con «mantenimiento» expreso y kcal por encima de TMB × 1,2, o sin TMB, solo se pide revisión (no se puede saber si es déficit)', () => {
    const arriba = ev('mantenimiento', 1900)
    expect(arriba.blocked).toBe(false)
    expect(codes(arriba)).toContain('EMBARAZO_LACTANCIA_REVISION')
    expect(arriba.needsProfessionalReview).toBe(true)
    const sinPeso = ev('mantenimiento', 1500, null) // sin peso no hay TMB
    expect(sinPeso.blocked).toBe(false)
    expect(codes(sinPeso)).toContain('EMBARAZO_LACTANCIA_REVISION')
  })
  it('sin embarazo ni lactancia, el objetivo vacío de la ficha no bloquea nada (la regla es solo para embarazo y lactancia)', () => {
    for (const goal of [null, '', 'libre']) expect(ev(goal, 2200, 60, { reproductiveStatus: 'ninguno' }).blocked).toBe(false)
  })
  it('guardar: el bloqueo se mantiene cualquiera que sea el objetivo de la ficha (decideSave)', () => {
    for (const goal of [null, '', 'perder_peso', 'mantenimiento']) {
      const t = { kcal: 1500, proteinG: 75, carbsG: 188, fatG: 50 }
      const e = ev(goal, 1500)
      const fp = targetsFingerprint(t, e)
      expect(decideSave({ evaluation: e, fingerprint: fp, confirmedFingerprint: fp, changed: true }).reason, String(goal)).toBe('bloqueado')
    }
  })
  it('plantillas y restauraciones: se rechazan igual con cualquier objetivo de la ficha', () => {
    for (const goal of [null, '', 'perder_peso', 'mantenimiento']) {
      expect(decideApply(ev(goal, 1500), 'plantilla').allowed, `plantilla ${goal}`).toBe(false)
      expect(decideApply(ev(goal, 1500), 'versión').allowed, `versión ${goal}`).toBe(false)
    }
  })
  it('lactancia se comporta igual que embarazo', () => {
    expect(ev(null, 2200, 60, { reproductiveStatus: 'lactancia' }).blocked).toBe(true)
  })
  it('un error de lectura del cuestionario no desbloquea: con embarazo conocido y error, sigue bloqueado', () => {
    expect(ev(null, 2200, 60, { reproductiveCheck: 'error' }).blocked).toBe(true)
  })
})
