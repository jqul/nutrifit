import { describe, it, expect } from 'vitest'
import { DailyCheckin, WeightEntry } from '../types'
import { AdjustmentPlan, AdjustmentProfile, suggestDietAdjustment, evaluateAdjustmentTarget, MIN_KCAL, MIN_CARBS_G } from './dietAdjustment'

const TODAY = new Date(2026, 9, 5, 15, 30)   // 5 oct 2026, por la tarde (a propósito: no medianoche)
const iso = (daysAgo: number) => {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const w = (daysAgo: number, weightKg: number): WeightEntry => ({ id: `w${daysAgo}`, clientId: 'c', date: iso(daysAgo), weightKg, note: '' })
/** Un check-in diario durante los últimos `days` días; los que están en `missed` se saltan. */
const checkins = (days: number, followed: 'si' | 'parcial' | 'no' = 'si', missed: number[] = []): DailyCheckin[] =>
  Array.from({ length: days }, (_, i) => i).filter(i => !missed.includes(i)).map(i => ({
    id: `k${i}`, clientId: 'c', date: iso(i), followedPlan: followed, hunger: 3, energy: 3, mood: 3, waterL: null, notes: '',
  }))
const plan = (over: Partial<AdjustmentPlan> = {}, changedDaysAgo = 30): AdjustmentPlan => ({
  kcal_target: 2000, protein_g: 150, carbs_g: 200, fat_g: 67, fiber_g: 28, advice: 'x',
  updatedAt: new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - changedDaysAgo, 10).getTime(), ...over,
})
/** Pesajes semanales (cada 7 días, de hace `weeks*7` días a hoy) que pierden/ganan `kgPerWeek` desde `startKg`. */
const weekly = (startKg: number, kgPerWeek: number, weeks = 3): WeightEntry[] =>
  Array.from({ length: weeks + 1 }, (_, i) => w((weeks - i) * 7, startKg + kgPerWeek * i))

const suggest = (over: Partial<Parameters<typeof suggestDietAdjustment>[0]> = {}) =>
  suggestDietAdjustment({ weights: weekly(80, -0.1), checkins: checkins(28), goal: 'perder_peso', goalWeightKg: 70, plan: plan(), ...over }, TODAY)

describe('suggestDietAdjustment — cuándo NO propone nada', () => {
  it('asks for a plan first when there are no targets', () => {
    expect(suggest({ plan: null }).kind).toBe('no_plan')
    expect(suggest({ plan: plan({ kcal_target: 0 }) }).kind).toBe('no_plan')
  })

  it('needs a goal to know what pace to expect', () => {
    expect(suggest({ goal: null }).kind).toBe('wait')
    expect(suggest({ goal: 'otra cosa libre' }).kind).toBe('wait')
  })

  it('waits two weeks after the plan changed, whatever the weight does', () => {
    const r = suggest({ plan: plan({}, 6), weights: weekly(80, 0.5, 3) })
    expect(r.kind).toBe('wait')
    expect(r.headline).toContain('hace 6 días')
    expect(r.proposal).toBeNull()
  })

  it('does not use weigh-ins from before the plan changed', () => {
    // Plan cambiado hace 15 días: solo cuentan los pesajes de los últimos 15; 2 pesajes no bastan.
    const r = suggest({ plan: plan({}, 15), weights: [w(20, 85), w(18, 84), w(12, 80), w(1, 79.8)] })
    expect(r.kind).toBe('wait')
    expect(r.headline).toContain('hay 2')
  })

  it('needs at least 3 weigh-ins spanning 10 days', () => {
    expect(suggest({ weights: [w(14, 80), w(7, 79.9)] }).kind).toBe('wait')
    expect(suggest({ weights: [w(5, 80), w(3, 80), w(1, 80)] }).kind).toBe('wait')   // 3 pesajes pero solo 4 días
  })

  it('asks for a fresh weigh-in when the last one is old', () => {
    const r = suggest({ weights: [w(30, 80), w(24, 80), w(18, 80), w(12, 80)] })
    expect(r.kind).toBe('wait')
    expect(r.headline).toContain('hace 12 días')
  })

  it('does not cut calories from someone who is not following the plan', () => {
    const r = suggest({ checkins: checkins(28, 'no') })
    expect(r.kind).toBe('wait')
    expect(r.headline).toContain('Sigue el plan solo el 0 %')
    expect(r.proposal).toBeNull()
  })

  it('does not count days without a check-in as adherence', () => {
    const r = suggest({ checkins: checkins(28, 'si', Array.from({ length: 14 }, (_, i) => i * 2)) })   // la mitad de los días
    expect(r.kind).toBe('wait')
  })

  it('says it is on track when the pace fits the goal', () => {
    // 80 kg perdiendo 0,4 kg/sem = 0,5 %/sem: dentro de 0,3–1 %
    const r = suggest({ weights: weekly(80, -0.4) })
    expect(r.kind).toBe('on_track')
    expect(r.proposal).toBeNull()
  })

  it('suggests moving to maintenance once the goal weight is reached', () => {
    const r = suggest({ weights: weekly(72, -0.6), goalWeightKg: 70.3 })   // acaba en 70,2
    expect(r.kind).toBe('goal_reached')
    expect(r.headline).toContain('mantenimiento')
  })
})

describe('suggestDietAdjustment — cuándo propone un cambio', () => {
  it('lowers calories when weight loss stalls on a weight-loss goal', () => {
    const r = suggest({ weights: weekly(80, 0) })
    expect(r.kind).toBe('adjust')
    expect(r.deltaKcal).toBeLessThan(0)
    expect(r.proposal!.kcal_target).toBe(2000 + r.deltaKcal)
    expect(r.headline).toContain('no baja al ritmo previsto')
  })

  it('lowers calories when the client is gaining while trying to lose', () => {
    const r = suggest({ weights: weekly(80, 0.4) })
    expect(r.kind).toBe('adjust')
    expect(r.deltaKcal).toBeLessThan(0)
  })

  it('raises calories when weight drops faster than planned', () => {
    // 1,2 kg/sem sobre 80 kg = 1,5 %/sem: demasiado rápido
    const r = suggest({ weights: weekly(80, -1.2), goalWeightKg: 60 })
    expect(r.kind).toBe('adjust')
    expect(r.deltaKcal).toBeGreaterThan(0)
    expect(r.headline).toContain('baja más rápido de lo previsto')
  })

  it('raises calories for a muscle-gain goal that is not gaining', () => {
    const r = suggest({ goal: 'ganar_masa', goalWeightKg: 90, weights: weekly(75, 0) })
    expect(r.kind).toBe('adjust')
    expect(r.deltaKcal).toBeGreaterThan(0)
    expect(r.headline).toContain('no sube al ritmo previsto')
  })

  it('treats a maintenance goal that drifts as a reason to adjust', () => {
    const r = suggest({ goal: 'mantenimiento', goalWeightKg: null, weights: weekly(80, -0.6) })
    expect(r.kind).toBe('adjust')
    expect(r.deltaKcal).toBeGreaterThan(0)
  })

  it('keeps the step small: rounded to 25 and never more than 250 kcal', () => {
    for (const rate of [0, 0.4, 1.0, 2.0]) {
      const r = suggest({ weights: weekly(80, rate) })
      expect(r.kind).toBe('adjust')
      expect(Math.abs(r.deltaKcal) % 25).toBe(0)
      expect(Math.abs(r.deltaKcal)).toBeLessThanOrEqual(250)
      expect(Math.abs(r.deltaKcal)).toBeGreaterThanOrEqual(50)
    }
  })

  it('leaves protein, fat, fibre and advice alone and moves the difference to carbs', () => {
    const r = suggest({ weights: weekly(80, 0) })
    const p = r.proposal!
    expect(p.protein_g).toBe(150)
    expect(p.fat_g).toBe(67)
    expect(p.fiber_g).toBe(28)
    expect(p.advice).toBe('x')
    expect(p.carbs_g).toBe(Math.round(200 + r.deltaKcal / 4))
  })

  it('explains itself with the numbers it used', () => {
    const r = suggest({ weights: weekly(80, 0) })
    expect(r.reasons.join(' ')).toContain('4 pesajes')
    expect(r.reasons.join(' ')).toContain('Adherencia')
    expect(r.historyReason.length).toBeLessThanOrEqual(200)
    expect(r.historyReason).toContain('Reajuste sugerido')
  })

  it('gives the same answer whatever time of day it is asked', () => {
    const base = { weights: weekly(80, 0), checkins: checkins(28), goal: 'perder_peso', goalWeightKg: 70, plan: plan() }
    const a = suggestDietAdjustment(base, new Date(2026, 9, 5, 0, 5))
    const b = suggestDietAdjustment(base, new Date(2026, 9, 5, 23, 55))
    expect(a.deltaKcal).toBe(b.deltaKcal)
    expect(a.kind).toBe(b.kind)
  })
})

describe('suggestDietAdjustment — límites de seguridad', () => {
  it('never proposes going below the minimum calories', () => {
    const r = suggest({ weights: weekly(80, 0.4), plan: plan({ kcal_target: 1300, carbs_g: 120, protein_g: 120, fat_g: 40 }) })
    if (r.kind === 'adjust') expect(r.proposal!.kcal_target).toBeGreaterThanOrEqual(MIN_KCAL)
    else expect(r.kind).toBe('wait')
  })

  it('refuses to cut a plan that is already at the minimum, and says why', () => {
    const r = suggest({ weights: weekly(80, 0.4), plan: plan({ kcal_target: MIN_KCAL, carbs_g: 150 }) })
    expect(r.kind).toBe('wait')
    expect(r.proposal).toBeNull()
    // Es un umbral de REVISIÓN, no una garantía: así se dice (y ya no «límite seguro»).
    expect(r.headline).toContain('umbral de revisión')
    expect(r.headline).toContain('no garantiza seguridad')
    expect(r.headline).not.toMatch(/l[ií]mite seguro/)
  })

  it('never leaves fewer than the minimum carbs', () => {
    const r = suggest({ weights: weekly(80, 0.4), plan: plan({ kcal_target: 1800, carbs_g: 60 }) })
    if (r.kind === 'adjust') expect(r.proposal!.carbs_g).toBeGreaterThanOrEqual(MIN_CARBS_G)
    else expect(r.kind).toBe('wait')
  })

  it('still allows raising calories when the plan is at the floor', () => {
    const r = suggest({ weights: weekly(80, -1.2), goalWeightKg: 60, plan: plan({ kcal_target: MIN_KCAL, carbs_g: 100 }) })
    expect(r.kind).toBe('adjust')
    expect(r.deltaKcal).toBeGreaterThan(0)
  })

  it('does not call a tiny difference a reason to change anything', () => {
    // Justo fuera de la banda (0,28 %/sem frente a 0,3 %): la diferencia en kcal es pequeña
    const r = suggest({ weights: weekly(80, -0.224) })
    expect(['wait', 'adjust']).toContain(r.kind)
    if (r.kind === 'adjust') expect(Math.abs(r.deltaKcal)).toBeGreaterThanOrEqual(50)
  })
})

describe('suggestDietAdjustment — mantenimiento dinámico', () => {
  const hold = (over: Partial<Parameters<typeof suggestDietAdjustment>[0]> = {}) =>
    suggest({ goal: 'mantenimiento', ...over })

  it('holds when the weight is within 0,7 kg of the maintenance weight and stable', () => {
    const r = hold({ goalWeightKg: 75, weights: weekly(75.5, 0) })
    expect(r.kind).toBe('on_track')
  })
  it('proposes going back down slowly when it is well above the maintenance weight and not moving', () => {
    const r = hold({ goalWeightKg: 75, weights: weekly(77, 0) })
    expect(r.kind).toBe('adjust')
    expect(r.deltaKcal).toBeLessThan(0)
    expect(r.reasons.join(' ')).toContain('peso de mantenimiento (75,0 kg)')
  })
  it('proposes going back up slowly when it is well below the maintenance weight and not moving', () => {
    const r = hold({ goalWeightKg: 75, weights: weekly(73, 0) })
    expect(r.kind).toBe('adjust')
    expect(r.deltaKcal).toBeGreaterThan(0)
  })
  it('leaves it alone when it is already heading back at the gentle pace', () => {
    const r = hold({ goalWeightKg: 75, weights: weekly(77, -0.115) })
    expect(r.kind).toBe('on_track')
  })
  it('without a maintenance weight, the stable pace applies as before', () => {
    expect(hold({ goalWeightKg: null, weights: weekly(77, 0) }).kind).toBe('on_track')
  })
  it('does not change what losing or gaining goals do near their goal weight', () => {
    const r = suggest({ goal: 'perder_peso', goalWeightKg: 70, weights: weekly(80, -0.1) })
    expect(r.kind).toBe('adjust')
  })
})

// ── Motor de evaluación en el reajuste (planSafety.ts) ─────────────────────────────────────────────────────────────────────────────
const adultaCompleta: AdjustmentProfile = { sex: 'mujer', ageYears: 35, birthDate: '1991-03-01', heightCm: 165, reproductiveStatus: 'ninguno' }
const stalled = () => weekly(80, 0)            // peso estancado en 80 kg (meta 70): con objetivo de perder, pide bajar kcal
const codesOf = (r: ReturnType<typeof suggestDietAdjustment>) => r.signals.map(s => s.code)

describe('suggestDietAdjustment — planes por debajo de los umbrales de revisión', () => {
  const casos: [number, number][] = [[1500, 55], [1250, 120], [1200, 120], [1142, 73], [1100, 90], [1045, 60], [900, 30], [700, 20]]
  it.each(casos)('plan de %i kcal con %i g de hidratos y la pérdida estancada: no baja más por su cuenta y no lo llama «seguro»', (kcal, carbs) => {
    const r = suggest({ weights: stalled(), plan: plan({ kcal_target: kcal, carbs_g: carbs, protein_g: 100, fat_g: 50 }) })
    if (r.kind === 'adjust') {
      expect(r.proposal!.kcal_target).toBeGreaterThanOrEqual(MIN_KCAL)
      expect(r.proposal!.carbs_g).toBeGreaterThanOrEqual(MIN_CARBS_G)
    } else {
      expect(r.kind).toBe('wait')
      expect(r.headline).toContain('umbral de revisión')
      expect(r.headline).toContain('no garantiza seguridad')
    }
    expect(r.headline).not.toMatch(/l[ií]mite seguro|es seguro|m[ií]nimo seguro/i)
  })
  it('los planes bajo el umbral lo dicen: «por debajo del umbral» (no «en el umbral») y llevan la señal de revisión', () => {
    for (const kcal of [1142, 1045, 900]) {
      const r = suggest({ weights: stalled(), plan: plan({ kcal_target: kcal, carbs_g: 60, protein_g: 100, fat_g: 50 }) })
      expect(r.headline, String(kcal)).toContain('por debajo del umbral de revisión')
      expect(codesOf(r), String(kcal)).toContain('OBJETIVO_BAJO_UMBRAL')
    }
    expect(suggest({ weights: stalled(), plan: plan({ kcal_target: 1200, carbs_g: 150 }) }).headline).toContain('está en el umbral de revisión')
  })
  it('también señala el plan bajo el umbral cuando NO propone nada (va según lo previsto); si propone subir, las señales son las de la propuesta', () => {
    const bajo = plan({ kcal_target: 1045, carbs_g: 60, protein_g: 100, fat_g: 50 })
    const onTrack = suggest({ weights: weekly(80, -0.48), plan: bajo })
    expect(onTrack.kind).toBe('on_track')
    expect(codesOf(onTrack)).toContain('OBJETIVO_BAJO_UMBRAL')
    const sube = suggest({ weights: weekly(80, -1.2), goalWeightKg: 60, plan: bajo })
    expect(sube.kind).toBe('adjust')
    expect(sube.deltaKcal).toBeGreaterThan(0)
    expect(sube.proposal!.kcal_target).toBe(1295)
    expect(codesOf(sube)).not.toContain('OBJETIVO_BAJO_UMBRAL') // las señales son las de la propuesta, que ya supera el umbral
  })
  it('un plan normal no lleva señales', () => {
    expect(suggest({ weights: weekly(80, -0.48), plan: plan() }).signals).toEqual([])
  })
  it('los umbrales son configurables: con 1.000 kcal un plan de 1.045 no se marca', () => {
    const r = suggest({ weights: stalled(), plan: plan({ kcal_target: 1045, carbs_g: 100, protein_g: 100, fat_g: 50 }), thresholds: { minKcalReview: 1000 } })
    expect(codesOf(r)).not.toContain('OBJETIVO_BAJO_UMBRAL')
    expect(r.headline).toContain('1000 kcal')
  })
  it('no cambia ningún comportamiento numérico para planes normales respecto a antes', () => {
    const r = suggest({ weights: stalled(), plan: plan() })
    expect(r.kind).toBe('adjust')
    expect(r.deltaKcal).toBe(-250) // (−0,48 kg/sem esperados × 7700 / 7) × 0,5 = −264, acotado a −250
    expect(r.proposal!.kcal_target).toBe(1750)
  })
})

describe('suggestDietAdjustment — población y perfil', () => {
  it('menores de 18 años: no se proponen reajustes automáticos, se explica y se señala', () => {
    for (const ageYears of [17, 15, 12, 9, 0]) {
      const r = suggest({ weights: stalled(), profile: { ...adultaCompleta, ageYears } })
      expect(r.kind, String(ageYears)).toBe('wait')
      expect(r.proposal).toBeNull()
      expect(r.headline).toContain('menores de 18 años')
      expect(r.headline).toContain('valoración profesional')
      expect(codesOf(r)).toContain('MENOR_DE_EDAD')
    }
  })
  it('a los 18 ya funciona como un adulto', () => {
    expect(suggest({ weights: stalled(), profile: { ...adultaCompleta, ageYears: 18 } }).kind).toBe('adjust')
  })
  it('embarazo o lactancia declarados: no se proponen reajustes automáticos con ningún objetivo', () => {
    for (const reproductiveStatus of ['embarazo', 'lactancia'] as const) for (const goal of ['perder_peso', 'ganar_masa', 'mantenimiento']) {
      const r = suggest({ goal, weights: weekly(80, 0.5), profile: { ...adultaCompleta, reproductiveStatus } })
      expect(r.kind, reproductiveStatus + ' ' + goal).toBe('wait')
      expect(r.proposal).toBeNull()
      expect(r.headline).toMatch(/embarazo|lactancia/)
      expect(r.headline).toContain('valoración profesional')
      expect(codesOf(r)).toContain(goal === 'perder_peso' ? 'EMBARAZO_LACTANCIA_PERDIDA_DE_PESO' : 'EMBARAZO_LACTANCIA_REVISION')
    }
  })
  it('sin perfil, o con «no» o «no consta», el reajuste funciona exactamente como antes', () => {
    const sin = suggest({ weights: stalled() })
    for (const reproductiveStatus of ['ninguno', 'no_consta'] as const) {
      const con = suggest({ weights: stalled(), profile: { ...adultaCompleta, reproductiveStatus } })
      expect(con.kind).toBe(sin.kind)
      expect(con.deltaKcal).toBe(sin.deltaKcal)
      expect(con.proposal).toEqual(sin.proposal)
    }
  })
  it('con sexo, edad y altura conocidos compara el plan con la TMB estimada (Mifflin) y lo señala', () => {
    // mujer 35 a, 165 cm, 60 kg → TMB 1.320: un plan de 1.250 está por encima del umbral (1.200) pero por debajo de la TMB
    const r = suggest({ weights: weekly(60, -0.36), goalWeightKg: 50, plan: plan({ kcal_target: 1250, carbs_g: 130, protein_g: 100, fat_g: 50 }), profile: adultaCompleta })
    expect(codesOf(r)).toContain('OBJETIVO_BAJO_TMB')
    expect(codesOf(r)).not.toContain('OBJETIVO_BAJO_UMBRAL')
    // sin altura o sin sexo no hay con qué comparar: no se inventa una TMB
    expect(codesOf(suggest({ weights: weekly(60, -0.36), goalWeightKg: 50, plan: plan({ kcal_target: 1250, carbs_g: 130 }), profile: { ...adultaCompleta, heightCm: null } }))).not.toContain('OBJETIVO_BAJO_TMB')
    expect(codesOf(suggest({ weights: weekly(60, -0.36), goalWeightKg: 50, plan: plan({ kcal_target: 1250, carbs_g: 130 }), profile: { ...adultaCompleta, sex: null } }))).not.toContain('OBJETIVO_BAJO_TMB')
  })
  it('con IMC bajo y objetivo de perder peso lo señala como revisión', () => {
    const r = suggest({ weights: weekly(45, -0.27), goalWeightKg: 40, profile: { ...adultaCompleta, heightCm: 160 } })
    const s = r.signals.find(x => x.code === 'IMC_BAJO')
    expect(s).toBeDefined()
    expect(s!.severity).toBe('revision')
  })
  it('evaluateAdjustmentTarget evalúa la cifra que edite el profesional, no solo la propuesta', () => {
    const e = evaluateAdjustmentTarget(adultaCompleta, 'perder_peso', 1000, 80, 60)
    expect(e.signals.map(s => s.code)).toEqual(expect.arrayContaining(['OBJETIVO_BAJO_UMBRAL', 'OBJETIVO_BAJO_TMB']))
    expect(e.needsProfessionalReview).toBe(true)
    expect(evaluateAdjustmentTarget(adultaCompleta, 'perder_peso', 1800, 200, 60).signals).toEqual([])
  })
})
