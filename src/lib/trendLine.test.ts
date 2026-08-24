import { describe, it, expect } from 'vitest'
import { movingAverage } from './trendLine'

describe('movingAverage', () => {
  it('returns an empty array for no input', () => {
    expect(movingAverage([])).toEqual([])
  })

  it('leaves a single value unchanged', () => {
    expect(movingAverage([70])).toEqual([70])
  })

  it('smooths a noisy middle point with a window of 3', () => {
    const result = movingAverage([70, 74, 70], 3)
    expect(result[1]).toBeCloseTo((70 + 74 + 70) / 3)
  })

  it('shrinks the window at the edges instead of padding with missing data', () => {
    const result = movingAverage([70, 68, 66, 64], 3)
    expect(result[0]).toBeCloseTo((70 + 68) / 2)
    expect(result[3]).toBeCloseTo((66 + 64) / 2)
  })

  it('preserves a steady linear trend', () => {
    const result = movingAverage([70, 69, 68, 67, 66], 3)
    expect(result[2]).toBeCloseTo(68)
  })
})
