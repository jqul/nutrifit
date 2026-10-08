import { describe, expect, it } from 'vitest'
import { progressReading } from './progressReading'

const TODAY = new Date(2026, 9, 8)
const w = (date: string, weightKg: number) => ({ date, weightKg })
const base = { goal: 'perder_peso', goalWeightKg: 70, adherence7d: 90, streak: 3, today: TODAY }

describe('progressReading', () => {
  it('asks for more weigh-ins when there is not enough data', () => {
    expect(progressReading({ ...base, weights: [w('2026-10-01', 80)] }).headline).toBe('Aún es pronto para valorar')
    expect(progressReading({ ...base, weights: [] }).tone).toBe('neutral')
  })
  it('says the client is on track when the weight moves the right way', () => {
    const r = progressReading({ ...base, weights: [w('2026-09-01', 80), w('2026-09-20', 78.5), w('2026-10-07', 77.6)] })
    expect(r).toMatchObject({ tone: 'good', headline: 'Vas en la dirección prevista', detail: 'Mantén el plan actual.' })
    expect(r.goalPercent).toBe(24)
  })
  it('mentions a long streak and a low adherence', () => {
    const rows = [w('2026-09-01', 80), w('2026-10-07', 78)]
    expect(progressReading({ ...base, streak: 12, weights: rows }).detail).toContain('12 días de racha')
    expect(progressReading({ ...base, adherence7d: 40, weights: rows })).toMatchObject({ tone: 'neutral' })
  })
  it('warns when the weight goes the wrong way, blaming adherence first if it is low', () => {
    const rows = [w('2026-09-10', 78), w('2026-10-07', 79.5)]
    expect(progressReading({ ...base, weights: rows })).toMatchObject({ tone: 'attention', headline: 'El peso va en la dirección contraria' })
    expect(progressReading({ ...base, adherence7d: 30, weights: rows }).detail).toContain('30%')
    expect(progressReading({ ...base, weights: rows }).detail).toContain('ajustar')
  })
  it('calls a flat weight stable', () => {
    expect(progressReading({ ...base, weights: [w('2026-09-12', 78), w('2026-10-07', 77.9)] }).headline).toBe('El peso está estable')
  })
  it('congratulates when the goal weight is reached', () => {
    const r = progressReading({ ...base, weights: [w('2026-08-01', 80), w('2026-10-07', 69.8)] })
    expect(r).toMatchObject({ tone: 'good', headline: '¡Has llegado a tu objetivo!', goalPercent: 100 })
  })
  it('does not judge the direction of the weight for other goals', () => {
    const r = progressReading({ ...base, goal: 'mantenimiento', goalWeightKg: null, weights: [w('2026-09-12', 70), w('2026-10-07', 71)] })
    expect(r).toMatchObject({ tone: 'good', headline: 'Buen ritmo', goalPercent: null })
  })
})
