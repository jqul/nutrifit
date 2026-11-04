import { describe, it, expect } from 'vitest'
import {
  MetricDefinition, STANDARD_METRICS, clientVisibleSeries, formatMetricDelta, formatMetricValue, missingStandardMetrics,
  parseMetricInput, pointsOf, sparklinePath, summarizeMetric,
} from './bodyMetrics'

const def = (id: string, name: string, over: Partial<MetricDefinition> = {}): MetricDefinition =>
  ({ id, key: null, name, unit: 'cm', clientVisible: true, sortOrder: 0, ...over })

describe('parseMetricInput', () => {
  it('accepts comma and dot decimals', () => {
    expect(parseMetricInput('82,5')).toBe(82.5)
    expect(parseMetricInput(' 82.5 ')).toBe(82.5)
    expect(parseMetricInput('90')).toBe(90)
  })
  it('rounds to two decimals and rejects empty, junk, zero, negatives and absurd values', () => {
    expect(parseMetricInput('82,456')).toBe(82.46)
    for (const bad of ['', 'abc', '0', '-3', '10000', '1,2,3', '12cm']) expect(parseMetricInput(bad), bad).toBeNull()
  })
})

describe('standard metrics', () => {
  it('lists only the ones a nutritionist does not have yet', () => {
    expect(missingStandardMetrics([])).toHaveLength(STANDARD_METRICS.length)
    const have = [{ key: 'waist_cm' }, { key: null }, { key: 'hip_cm' }]
    expect(missingStandardMetrics(have).map(m => m.key)).not.toContain('waist_cm')
    expect(missingStandardMetrics(have)).toHaveLength(STANDARD_METRICS.length - 2)
  })
})

describe('formatting', () => {
  it('writes values with a decimal comma and the unit', () => {
    expect(formatMetricValue(82.5, 'cm')).toBe('82,5 cm')
    expect(formatMetricValue(90, 'cm')).toBe('90 cm')
    expect(formatMetricValue(21.333, '%')).toBe('21,33 %')
    expect(formatMetricValue(7, '')).toBe('7')
  })
  it('writes changes with a real minus sign, or «sin cambios»', () => {
    expect(formatMetricDelta(-1.5, 'cm')).toBe('−1,5 cm')
    expect(formatMetricDelta(0.3, '%')).toBe('+0,3 %')
    expect(formatMetricDelta(0, 'cm')).toBe('sin cambios')
    expect(formatMetricDelta(0.001, 'cm')).toBe('sin cambios')
  })
})

describe('summarizeMetric', () => {
  const pts = [{ date: '2026-11-04', value: 80 }, { date: '2026-09-01', value: 84 }, { date: '2026-10-01', value: 82 }]
  it('finds the latest, the previous and the first, whatever the order', () => {
    const s = summarizeMetric(pts)!
    expect(s.latest.value).toBe(80)
    expect(s.previous?.value).toBe(82)
    expect(s.first.value).toBe(84)
    expect(s.deltaFromPrevious).toBe(-2)
    expect(s.deltaFromFirst).toBe(-4)
  })
  it('has no deltas with a single value, and nothing with none', () => {
    const one = summarizeMetric([{ date: '2026-11-04', value: 80 }])!
    expect(one.deltaFromPrevious).toBeNull()
    expect(one.deltaFromFirst).toBeNull()
    expect(summarizeMetric([])).toBeNull()
  })
})

describe('what the client sees', () => {
  const defs = [def('a', 'Cintura', { sortOrder: 1 }), def('b', 'Pliegue', { clientVisible: false }), def('c', 'Brazo', { sortOrder: 0 }), def('d', 'Muslo', { sortOrder: 2 })]
  const values = [
    { metricId: 'a', date: '2026-10-01', value: 90 }, { metricId: 'a', date: '2026-11-01', value: 88 },
    { metricId: 'b', date: '2026-11-01', value: 14 }, { metricId: 'c', date: '2026-11-01', value: 31 },
  ]
  it('hides the hidden ones and the ones with no values, in the nutritionist order', () => {
    expect(clientVisibleSeries(defs, values).map(s => s.def.name)).toEqual(['Brazo', 'Cintura'])
  })
  it('gives each series its points oldest first', () => {
    expect(pointsOf(values, 'a')).toEqual([{ date: '2026-10-01', value: 90 }, { date: '2026-11-01', value: 88 }])
  })
})

describe('sparklinePath', () => {
  it('draws nothing for fewer than two points', () => {
    expect(sparklinePath([], 100, 30)).toBe('')
    expect(sparklinePath([{ date: '2026-11-01', value: 5 }], 100, 30)).toBe('')
  })
  it('goes left to right in date order, higher values higher up', () => {
    const d = sparklinePath([{ date: '2026-11-02', value: 10 }, { date: '2026-11-01', value: 20 }], 100, 30)
    expect(d).toBe('M2 2 L98 28')
  })
  it('draws a flat line when every value is the same', () => {
    expect(sparklinePath([{ date: '2026-11-01', value: 5 }, { date: '2026-11-02', value: 5 }], 100, 30)).toBe('M2 15 L98 15')
  })
})
