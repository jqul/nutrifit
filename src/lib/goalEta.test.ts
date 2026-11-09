import { describe, it, expect } from 'vitest'
import { goalEta, etaSentence } from './goalEta'

const w = (date: string, weightKg: number) => ({ date, weightKg })
const TODAY = '2026-11-09'
// Bajada de 0,5 kg por semana durante 4 semanas.
const LOSING = [w('2026-10-12', 70), w('2026-10-19', 69.5), w('2026-10-26', 69), w('2026-11-02', 68.5), w('2026-11-09', 68)]

describe('goalEta', () => {
  it('projects the date at the recent rate when the weight is heading to the goal', () => {
    const eta = goalEta(LOSING, 65, TODAY)
    expect(eta.kind).toBe('eta')
    if (eta.kind !== 'eta') return
    expect(eta.ratePerWeekKg).toBeCloseTo(-0.5, 1)
    // Faltan ~3 kg sobre la tendencia (≈68,3): unas 6 semanas.
    expect(eta.weeks).toBeGreaterThan(5)
    expect(eta.weeks).toBeLessThan(8)
    expect(eta.dateISO > TODAY).toBe(true)
  })
  it('works for gaining too', () => {
    const gain = [w('2026-10-12', 60), w('2026-10-19', 60.4), w('2026-10-26', 60.8), w('2026-11-02', 61.2), w('2026-11-09', 61.6)]
    const eta = goalEta(gain, 64, TODAY)
    expect(eta.kind).toBe('eta')
    if (eta.kind === 'eta') expect(eta.ratePerWeekKg).toBeGreaterThan(0)
  })
  it('says nothing useful when the weight goes away from the goal', () => {
    expect(goalEta(LOSING, 75, TODAY).kind).toBe('not-moving')
  })
  it('says nothing useful when the weight is flat', () => {
    const flat = [w('2026-10-12', 70), w('2026-10-19', 70.01), w('2026-10-26', 69.99), w('2026-11-02', 70), w('2026-11-09', 70)]
    expect(goalEta(flat, 65, TODAY).kind).toBe('not-moving')
  })
  it('recognises the goal as reached when the trend is within 0,3 kg', () => {
    expect(goalEta(LOSING, 68.2, TODAY).kind).toBe('reached')
  })
  it('refuses a date more than a year away', () => {
    expect(goalEta(LOSING, 40, TODAY).kind).toBe('too-far')
  })
  it('needs data: no goal, too few weigh-ins, too short a span, or a stale last weigh-in', () => {
    expect(goalEta(LOSING, null, TODAY).kind).toBe('too-early')
    expect(goalEta([], 65, TODAY).kind).toBe('too-early')
    expect(goalEta([w('2026-11-02', 70), w('2026-11-09', 69.5)], 65, TODAY).kind).toBe('too-early')
    expect(goalEta([w('2026-11-04', 70), w('2026-11-06', 69.8), w('2026-11-09', 69.6)], 65, TODAY).kind).toBe('too-early')
    expect(goalEta(LOSING, 65, '2026-12-10').kind).toBe('too-early')
  })
  it('only looks at the last 28 days, so an old fast loss does not inflate the rate', () => {
    const old = [w('2026-06-01', 90), w('2026-06-08', 85), ...LOSING]
    const eta = goalEta(old, 65, TODAY)
    expect(eta.kind).toBe('eta')
    if (eta.kind === 'eta') expect(eta.ratePerWeekKg).toBeGreaterThan(-0.9)
  })
  it('does not depend on the order of the input', () => {
    expect(goalEta([...LOSING].reverse(), 65, TODAY)).toEqual(goalEta(LOSING, 65, TODAY))
  })
})

describe('etaSentence', () => {
  const eta = { kind: 'eta' as const, dateISO: '2027-01-12', weeks: 9, ratePerWeekKg: -0.4 }
  it('speaks to the client in second person and writes the date in Spanish', () => {
    const s = etaSentence(eta, TODAY, 'client')!
    expect(s).toContain('llegarías a tu objetivo')
    expect(s).toContain('12 de enero de 2027')
    expect(s).toContain('−0,4 kg/semana')
    expect(s).toContain('estimación')
  })
  it('speaks about the client in third person for the nutritionist and omits a same-year', () => {
    const s = etaSentence({ ...eta, dateISO: '2026-12-20' }, TODAY, 'pro')!
    expect(s).toContain('llegaría a su objetivo')
    expect(s).toContain('20 de diciembre.')
    expect(s).not.toContain('2026')
  })
  it('says nothing for any other result', () => {
    for (const kind of ['reached', 'not-moving', 'too-far', 'too-early'] as const) expect(etaSentence({ kind }, TODAY, 'client')).toBeNull()
  })
})
