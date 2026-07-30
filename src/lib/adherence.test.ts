import { describe, it, expect } from 'vitest'
import { calcAdherence, calcStreak } from './adherence'
import { DailyCheckin, FollowedPlan } from '../types'

function dateStr(daysAgo: number, ref = new Date()): string {
  const d = new Date(ref)
  d.setDate(d.getDate() - daysAgo)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function checkin(daysAgo: number, followedPlan: FollowedPlan, ref = new Date()): DailyCheckin {
  return {
    id: `c-${daysAgo}`, clientId: 'client-1', date: dateStr(daysAgo, ref),
    followedPlan, hunger: 3, energy: 3, mood: 3, waterL: 2, notes: '',
  }
}

describe('calcAdherence', () => {
  it('returns 0 with no checkins', () => {
    expect(calcAdherence([], 7)).toBe(0)
  })

  it('counts si and parcial as adherent, no as non-adherent', () => {
    const ref = new Date()
    const checkins = [checkin(0, 'si', ref), checkin(1, 'parcial', ref), checkin(2, 'no', ref)]
    expect(calcAdherence(checkins, 7, ref)).toBe(Math.round((2 / 7) * 100))
  })

  it('treats missing days as non-adherent', () => {
    const ref = new Date()
    const checkins = [checkin(0, 'si', ref)]
    expect(calcAdherence(checkins, 7, ref)).toBe(Math.round((1 / 7) * 100))
  })

  it('is 100 when every day in the window has an adherent checkin', () => {
    const ref = new Date()
    const checkins = [0, 1, 2].map(d => checkin(d, 'si', ref))
    expect(calcAdherence(checkins, 3, ref)).toBe(100)
  })
})

describe('calcStreak', () => {
  it('returns 0 with no checkins', () => {
    expect(calcStreak([])).toBe(0)
  })

  it('counts consecutive days ending today, regardless of adherence quality', () => {
    // La racha mide constancia registrando el check-in, no si se siguió el plan
    // (eso lo mide calcAdherence por separado) — un día "no" sigue contando.
    const ref = new Date()
    const checkins = [checkin(0, 'si', ref), checkin(1, 'no', ref), checkin(2, 'si', ref)]
    expect(calcStreak(checkins, ref)).toBe(3)
  })

  it('stops counting at the first gap', () => {
    const ref = new Date()
    const checkins = [checkin(0, 'si', ref), checkin(2, 'si', ref)]
    expect(calcStreak(checkins, ref)).toBe(1)
  })

  it('is 0 if today has no checkin, even with a past streak', () => {
    const ref = new Date()
    const checkins = [checkin(1, 'si', ref), checkin(2, 'si', ref)]
    expect(calcStreak(checkins, ref)).toBe(0)
  })
})
