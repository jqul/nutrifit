import { describe, it, expect } from 'vitest'
import { WeightEntry } from '../types'
import { summarizeProgress, formatChangeKg, formatTimeSince } from './progressHeadline'

const today = new Date('2026-10-05T12:00:00')
const w = (date: string, weightKg: number): WeightEntry => ({ id: date, clientId: 'c', date, weightKg, note: '' })

describe('summarizeProgress', () => {
  it('returns null without weigh-ins', () => {
    expect(summarizeProgress([], today)).toBeNull()
  })

  it('compares the first weigh-in with the latest regardless of input order', () => {
    const r = summarizeProgress([w('2026-09-21', 78.4), w('2026-08-24', 80), w('2026-10-05', 75.8)], today)!
    expect(r.initialKg).toBe(80)
    expect(r.currentKg).toBe(75.8)
    expect(r.changeKg).toBe(-4.2)
    expect(r.startDate).toBe('2026-08-24')
    expect(r.daysSinceStart).toBe(42)
    expect(r.singleEntry).toBe(false)
  })

  it('flags a single weigh-in as having no change yet', () => {
    const r = summarizeProgress([w('2026-10-05', 77.7)], today)!
    expect(r.singleEntry).toBe(true)
    expect(r.changeKg).toBe(0)
    expect(r.daysSinceStart).toBe(0)
  })

  it('rounds the change to one decimal without float noise', () => {
    expect(summarizeProgress([w('2026-09-01', 70.1), w('2026-10-01', 70.4)], today)!.changeKg).toBe(0.3)
  })
})

describe('formatChangeKg', () => {
  it('uses a real minus sign, a comma and one decimal', () => {
    expect(formatChangeKg(-4.2)).toBe('−4,2 kg')
    expect(formatChangeKg(1)).toBe('+1,0 kg')
  })
  it('treats tiny changes as no change', () => {
    expect(formatChangeKg(0)).toBe('0 kg')
    expect(formatChangeKg(-0.04)).toBe('0 kg')
  })
})

describe('formatTimeSince', () => {
  it('speaks in days, weeks and months', () => {
    expect(formatTimeSince(0)).toBe('hoy')
    expect(formatTimeSince(1)).toBe('ayer')
    expect(formatTimeSince(5)).toBe('hace 5 días')
    expect(formatTimeSince(42)).toBe('hace 6 semanas')
    expect(formatTimeSince(61)).toBe('hace 2 meses')
    expect(formatTimeSince(200)).toBe('hace 7 meses')
  })
})
