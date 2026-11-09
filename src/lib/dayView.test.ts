import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readDayView, saveDayView, remainingHeadline } from './dayView'
import { initialDark } from './useDarkMode'

describe('remainingHeadline', () => {
  it('says how many kcal are left', () => {
    expect(remainingHeadline(1500, 2000)).toBe('Te quedan 500 kcal')
    expect(remainingHeadline(2000, 2000)).toBe('Te quedan 0 kcal')
  })
  it('says how far over it is, without blame', () => {
    expect(remainingHeadline(2250, 2000)).toBe('Hoy llevas 250 kcal por encima')
  })
  it('rounds fractions', () => {
    expect(remainingHeadline(1499.6, 2000)).toBe('Te quedan 500 kcal')
  })
})

describe('saved day view', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } })
  })
  afterEach(() => { vi.unstubAllGlobals() })
  it('opens on «consumed» by default and remembers «remaining»', () => {
    expect(readDayView()).toBe('consumed')
    saveDayView('remaining')
    expect(readDayView()).toBe('remaining')
    saveDayView('consumed')
    expect(readDayView()).toBe('consumed')
  })
  it('ignores a junk value and survives blocked storage', () => {
    store.set('nf_day_view', 'zzz')
    expect(readDayView()).toBe('consumed')
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
    expect(readDayView()).toBe('consumed')
    expect(() => saveDayView('remaining')).not.toThrow()
  })
})

describe('initialDark', () => {
  it('respects an explicit choice over the system', () => {
    expect(initialDark('1', false)).toBe(true)
    expect(initialDark('0', true)).toBe(false)
  })
  it('follows the system when nothing was chosen', () => {
    expect(initialDark(null, true)).toBe(true)
    expect(initialDark(null, false)).toBe(false)
  })
  it('treats an unknown saved value as not chosen', () => {
    expect(initialDark('x', true)).toBe(true)
  })
})
