import { describe, it, expect } from 'vitest'
import { summarizeSignals, isConcerningCheckin } from './checkinSignals'
import { DailyCheckin } from '../types'

const today = new Date('2026-10-04T12:00:00')
const d = (daysAgo: number) => {
  const x = new Date(today); x.setDate(x.getDate() - daysAgo)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const ck = (daysAgo: number, over: Partial<DailyCheckin> = {}): DailyCheckin => ({
  id: String(daysAgo), clientId: 'c', date: d(daysAgo), followedPlan: 'si', hunger: 3, energy: 3, mood: 3, waterL: null, notes: '', ...over,
})

describe('isConcerningCheckin', () => {
  it('flags very hard or very loose stools (Bristol <=2 or >=6)', () => {
    expect(isConcerningCheckin(ck(0, { bristolScale: 1 }))).toBe(true)
    expect(isConcerningCheckin(ck(0, { bristolScale: 7 }))).toBe(true)
    expect(isConcerningCheckin(ck(0, { bristolScale: 4 }))).toBe(false)
  })
  it('flags moderate bloating or abdominal pain', () => {
    expect(isConcerningCheckin(ck(0, { bloating: 2 }))).toBe(true)
    expect(isConcerningCheckin(ck(0, { abdominalPain: 2 }))).toBe(true)
    expect(isConcerningCheckin(ck(0, { bloating: 1, abdominalPain: 1 }))).toBe(false)
  })
})

describe('summarizeSignals', () => {
  it('returns empty readings when there are no check-ins in the window', () => {
    const r = summarizeSignals([ck(20)], today)
    expect(r.days).toBe(0)
    expect(r.hunger).toEqual({ avg: null, tone: 'neutral' })
    expect(r.digestion).toEqual({ daysWithData: 0, concerningDays: 0, tone: 'neutral' })
  })

  it('averages the last 7 days only (today included, 8 days ago excluded)', () => {
    const r = summarizeSignals([ck(0, { energy: 5 }), ck(6, { energy: 3 }), ck(7, { energy: 1 })], today)
    expect(r.days).toBe(2)
    expect(r.energy.avg).toBe(4)
  })

  it('tones energy and mood: high good, low warn, middle neutral', () => {
    expect(summarizeSignals([ck(0, { energy: 4, mood: 2 })], today).energy.tone).toBe('good')
    expect(summarizeSignals([ck(0, { energy: 4, mood: 2 })], today).mood.tone).toBe('warn')
    expect(summarizeSignals([ck(0, { energy: 3 })], today).energy.tone).toBe('neutral')
  })

  it('tones hunger: sustained very high warns, moderate is good', () => {
    expect(summarizeSignals([ck(0, { hunger: 5 }), ck(1, { hunger: 4 })], today).hunger.tone).toBe('warn')
    expect(summarizeSignals([ck(0, { hunger: 3 })], today).hunger.tone).toBe('good')
  })

  it('tones digestion by the number of concerning days', () => {
    const base = [ck(0, { bloating: 0 }), ck(1, { bloating: 0 })]
    expect(summarizeSignals(base, today).digestion).toEqual({ daysWithData: 2, concerningDays: 0, tone: 'good' })
    expect(summarizeSignals([...base, ck(2, { bloating: 2 })], today).digestion.tone).toBe('neutral')
    expect(summarizeSignals([...base, ck(2, { bloating: 2 }), ck(3, { abdominalPain: 3 })], today).digestion)
      .toEqual({ daysWithData: 4, concerningDays: 2, tone: 'warn' })
  })

  it('ignores days without digestion data when tone-ing digestion', () => {
    const r = summarizeSignals([ck(0), ck(1, { bloating: 0 })], today)
    expect(r.digestion.daysWithData).toBe(1)
  })
})
