import { describe, it, expect } from 'vitest'
import { DailyCheckin, WeightEntry } from '../types'
import { AdjustmentPlan, AdjustmentProfile, suggestDietAdjustment } from './dietAdjustment'

// Reajuste: mientras el cuestionario de salud no se pueda comprobar (cargando o error de lectura) no se propone nada.
const TODAY = new Date(2026, 9, 5, 15, 30)
const iso = (daysAgo: number) => { const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - daysAgo); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const w = (daysAgo: number, weightKg: number): WeightEntry => ({ id: `w${daysAgo}`, clientId: 'c', date: iso(daysAgo), weightKg, note: '' })
const checkins = (days: number): DailyCheckin[] => Array.from({ length: days }, (_, i) => ({ id: `k${i}`, clientId: 'c', date: iso(i), followedPlan: 'si', hunger: 3, energy: 3, mood: 3, waterL: null, notes: '' }) as DailyCheckin)
const plan = (): AdjustmentPlan => ({ kcal_target: 2000, protein_g: 150, carbs_g: 200, fat_g: 67, fiber_g: 28, advice: 'x', updatedAt: new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - 30, 10).getTime() })
const stalled = () => [3, 2, 1, 0].map(i => w(i * 7, 80))
const base: AdjustmentProfile = { sex: 'mujer', ageYears: 35, birthDate: null, heightCm: 165, reproductiveStatus: 'no_consta' }
const suggest = (profile?: AdjustmentProfile) => suggestDietAdjustment({ weights: stalled(), checkins: checkins(28), goal: 'perder_peso', goalWeightKg: 70, plan: plan(), profile }, TODAY)

describe('reajuste: estado de la comprobación del cuestionario', () => {
  it('con el cuestionario leído (aunque no haya respuesta) funciona como siempre', () => {
    const r = suggest({ ...base, reproductiveCheck: 'ready' })
    expect(r.kind).toBe('adjust')
    expect(r.proposal).not.toBeNull()
    expect(suggest().kind).toBe('adjust') // y sin perfil, igual que antes
  })
  it('CARGANDO: no propone nada y lo dice', () => {
    const r = suggest({ ...base, reproductiveCheck: 'loading' })
    expect(r.kind).toBe('wait')
    expect(r.proposal).toBeNull()
    expect(r.headline).toMatch(/Comprobando el cuestionario/)
    expect(r.signals.map(s => s.code)).toContain('ANAMNESIS_NO_COMPROBADA')
  })
  it('ERROR: no propone nada, dice claramente que no se ha podido comprobar y NO lo trata como «no hay embarazo»', () => {
    const r = suggest({ ...base, reproductiveCheck: 'error' })
    expect(r.kind).toBe('wait')
    expect(r.proposal).toBeNull()
    expect(r.deltaKcal).toBe(0)
    expect(r.headline).toMatch(/No se ha podido comprobar si hay embarazo o lactancia/)
    expect(r.headline).toMatch(/no se proponen reajustes automáticos hasta poder comprobarlo/)
    const s = r.signals.find(x => x.code === 'ANAMNESIS_NO_COMPROBADA')!
    expect(s.severity).toBe('bloqueo')
    expect(s.explanation).toMatch(/NO significa que no haya embarazo/)
  })
  it('un error pesa más que cualquier otra cosa: tampoco propone aunque la persona sea adulta y el peso esté estancado', () => {
    expect(suggest({ ...base, reproductiveStatus: 'ninguno', reproductiveCheck: 'error' }).kind).toBe('wait')
  })
  it('al pasar de error/cargando a leído, vuelve a proponer (el estado no se queda pegado)', () => {
    expect(suggest({ ...base, reproductiveCheck: 'error' }).kind).toBe('wait')
    expect(suggest({ ...base, reproductiveCheck: 'ready' }).kind).toBe('adjust')
  })
  it('si consta embarazo y además falla la lectura, sigue sin proponer (y el motivo es la comprobación)', () => {
    expect(suggest({ ...base, reproductiveStatus: 'embarazo', reproductiveCheck: 'error' }).kind).toBe('wait')
  })
})
