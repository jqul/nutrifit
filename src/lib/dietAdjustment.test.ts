import { describe, it, expect } from 'vitest'
import { DailyCheckin, WeightEntry } from '../types'
import { AdjustmentPlan, suggestDietAdjustment, MIN_KCAL, MIN_CARBS_G } from './dietAdjustment'

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
    expect(r.headline).toContain('límite seguro')
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
