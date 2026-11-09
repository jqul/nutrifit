import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { trendSeries, indicesInRange, defaultRange, rangeStats, signedKg, rangeHasData, readSavedRange, saveRange, TREND_HALF_LIFE_DAYS } from './weightRange'

const w = (date: string, weightKg: number) => ({ date, weightKg })

describe('trendSeries', () => {
  it('starts at the first weigh-in and gives one value per entry', () => {
    const t = trendSeries([w('2026-01-01', 80), w('2026-01-08', 79)])
    expect(t).toHaveLength(2)
    expect(t[0]).toBe(80)
  })
  it('moves half the way after one half-life', () => {
    const t = trendSeries([w('2026-01-01', 80), w('2026-01-07', 70)], 6)
    expect(t[1]).toBeCloseTo(75, 5)
  })
  it('counts the real time between weigh-ins: a later weigh-in moves the trend more', () => {
    const soon = trendSeries([w('2026-01-01', 80), w('2026-01-02', 70)])[1]
    const late = trendSeries([w('2026-01-01', 80), w('2026-01-29', 70)])[1]
    expect(late).toBeLessThan(soon)
  })
  it('leaves a steady weight untouched and ignores a one-day spike mostly', () => {
    const t = trendSeries([w('2026-01-01', 80), w('2026-01-02', 80), w('2026-01-03', 82), w('2026-01-04', 80)])
    expect(t[2]).toBeLessThan(80.5)
    expect(t[3]).toBeCloseTo(80, 0)
  })
  it('does not go backwards in time on same-day entries', () => {
    expect(trendSeries([w('2026-01-01', 80), w('2026-01-01', 90)])[1]).toBe(80)
  })
  it('is empty for no data', () => { expect(trendSeries([])).toEqual([]) })
  it('exposes its half-life', () => { expect(TREND_HALF_LIFE_DAYS).toBe(6) })
})

describe('indicesInRange', () => {
  const entries = [w('2026-01-01', 80), w('2026-06-01', 78), w('2026-10-20', 77), w('2026-11-05', 76)]
  it('keeps what falls inside the last N days counted from today', () => {
    expect(indicesInRange(entries, '1m', '2026-11-09')).toEqual([2, 3])
    expect(indicesInRange(entries, '6m', '2026-11-09')).toEqual([1, 2, 3])
  })
  it('includes the boundary day', () => {
    expect(indicesInRange([w('2026-10-10', 70)], '1m', '2026-11-09')).toEqual([0])
    expect(indicesInRange([w('2026-10-09', 70)], '1m', '2026-11-09')).toEqual([])
  })
  it('returns everything for «all»', () => {
    expect(indicesInRange(entries, 'all', '2026-11-09')).toEqual([0, 1, 2, 3])
  })
})

describe('defaultRange and rangeHasData', () => {
  it('opens on «all» for a short history and on 3M for a long one', () => {
    expect(defaultRange([w('2026-09-01', 70)], '2026-11-09')).toBe('all')
    expect(defaultRange([w('2025-01-01', 70)], '2026-11-09')).toBe('3m')
    expect(defaultRange([], '2026-11-09')).toBe('all')
  })
  it('says a range has data only with at least two weigh-ins', () => {
    const e = [w('2026-01-01', 80), w('2026-11-05', 76)]
    expect(rangeHasData(e, '1m', '2026-11-09')).toBe(false)
    expect(rangeHasData(e, 'all', '2026-11-09')).toBe(true)
  })
})

describe('rangeStats', () => {
  it('averages, and gives the change of the weigh-ins and of the trend', () => {
    const s = rangeStats([80, 79, 78], [80, 79.5, 78.8])!
    expect(s.count).toBe(3)
    expect(s.averageKg).toBeCloseTo(79, 5)
    expect(s.changeKg).toBeCloseTo(-2, 5)
    expect(s.trendChangeKg).toBeCloseTo(-1.2, 5)
  })
  it('is null with fewer than two weigh-ins or mismatched series', () => {
    expect(rangeStats([80], [80])).toBeNull()
    expect(rangeStats([80, 79], [80])).toBeNull()
  })
})

describe('signedKg', () => {
  it('uses a real minus, a decimal comma and one decimal', () => {
    expect(signedKg(-1.24)).toBe('−1,2')
    expect(signedKg(0.45)).toBe('+0,5')
    expect(signedKg(0.04)).toBe('0,0')
    expect(signedKg(-0.04)).toBe('0,0')
  })
})

describe('saved range', () => {
  // Los tests corren en Node, sin navegador: un almacenamiento en memoria hace de localStorage.
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
    })
  })
  afterEach(() => { vi.unstubAllGlobals() })
  it('falls back to nothing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(readSavedRange()).toBeNull()
    expect(() => saveRange('1y')).not.toThrow()
  })
  it('remembers a valid choice', () => {
    saveRange('6m')
    expect(readSavedRange()).toBe('6m')
  })
  it('ignores nothing saved or a junk value', () => {
    expect(readSavedRange()).toBeNull()
    store.set('nf_weight_range', 'zzz')
    expect(readSavedRange()).toBeNull()
  })
})
