import { describe, it, expect } from 'vitest'
import { computeWeightProgress } from './weightProgress'

describe('computeWeightProgress', () => {
  it('returns no progress fields when there is no goal', () => {
    const p = computeWeightProgress(68, 64, null)
    expect(p.changeKg).toBe(-4)
    expect(p.remainingKg).toBeNull()
    expect(p.progressPct).toBeNull()
    expect(p.goalReached).toBe(false)
  })

  it('computes remaining distance and percent progress toward a weight-loss goal', () => {
    const p = computeWeightProgress(68, 64, 62)
    expect(p.changeKg).toBeCloseTo(-4)
    expect(p.remainingKg).toBeCloseTo(2)
    expect(p.progressPct).toBeCloseTo((6 - 2) / 6 * 100)
  })

  it('works the same way for a weight-gain goal', () => {
    const p = computeWeightProgress(70, 74, 78)
    expect(p.changeKg).toBeCloseTo(4)
    expect(p.remainingKg).toBeCloseTo(4)
    expect(p.progressPct).toBeCloseTo(50)
  })

  it('marks the goal reached once within half a kilo', () => {
    expect(computeWeightProgress(68, 62.4, 62).goalReached).toBe(true)
    expect(computeWeightProgress(68, 61.9, 62).goalReached).toBe(true)
    expect(computeWeightProgress(68, 63, 62).goalReached).toBe(false)
  })

  it('caps progress at 100% even if the client overshoots the goal', () => {
    const p = computeWeightProgress(68, 60, 62)
    expect(p.progressPct).toBe(100)
  })

  it('treats an initial weight equal to the goal as already at 100%', () => {
    const p = computeWeightProgress(62, 62, 62)
    expect(p.progressPct).toBe(100)
  })
})
