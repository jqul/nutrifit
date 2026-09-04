import { describe, it, expect } from 'vitest'
import { buildHealthTimeline, groupTimelineByMonth } from './healthTimeline'
import { WeightEntry, DailyCheckin, MealLog, FollowedPlan } from '../types'
import { BloodMarkerRow } from './supabase-types'

function checkin(date: string, id: string): DailyCheckin {
  return { id, clientId: 'c1', date, followedPlan: 'si' as FollowedPlan, hunger: 3, energy: 3, mood: 3, waterL: 1, notes: '' }
}

describe('buildHealthTimeline', () => {
  it('groups blood markers drawn on the same date into a single analítica event', () => {
    const bloodMarkers: BloodMarkerRow[] = [
      { id: 'b1', client_id: 'c1', date: '2026-01-10', marker_key: 'glucosa', value: 92, created_at: '' },
      { id: 'b2', client_id: 'c1', date: '2026-01-10', marker_key: 'hdl', value: 55, created_at: '' },
    ]
    const events = buildHealthTimeline({ weights: [], bloodMarkers, photos: [], clinicalNotes: [], mealLogs: [], checkins: [] })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'analitica', date: '2026-01-10' })
    if (events[0].type === 'analitica') expect(events[0].markers).toHaveLength(2)
  })

  it('computes weight delta against the previous reading in chronological order', () => {
    const weights: WeightEntry[] = [
      { id: 'w1', clientId: 'c1', date: '2026-01-01', weightKg: 80, note: '' },
      { id: 'w2', clientId: 'c1', date: '2026-01-08', weightKg: 78.6, note: '' },
    ]
    const events = buildHealthTimeline({ weights, bloodMarkers: [], photos: [], clinicalNotes: [], mealLogs: [], checkins: [] })
    const first = events.find(e => e.id === 'peso-w1')
    const second = events.find(e => e.id === 'peso-w2')
    expect(first?.type === 'peso' && first.deltaKg).toBeNull()
    expect(second?.type === 'peso' && second.deltaKg).toBe(-1.4)
  })

  it('marks a streak milestone only on the 7th consecutive day, not every day', () => {
    const checkins = Array.from({ length: 8 }, (_, i) => checkin(`2026-01-0${i + 1}`, `c${i}`))
    const events = buildHealthTimeline({ weights: [], bloodMarkers: [], photos: [], clinicalNotes: [], mealLogs: [], checkins })
    const hitos = events.filter(e => e.type === 'hito' && e.label.includes('seguidos'))
    expect(hitos).toHaveLength(1)
    expect(hitos[0].date).toBe('2026-01-07')
  })

  it('does not award a streak milestone when the run breaks before 7 days', () => {
    const checkins = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05', '2026-01-06'].map((d, i) => checkin(d, `c${i}`))
    const events = buildHealthTimeline({ weights: [], bloodMarkers: [], photos: [], clinicalNotes: [], mealLogs: [], checkins })
    expect(events.filter(e => e.type === 'hito' && e.label.includes('seguidos'))).toHaveLength(0)
  })

  it('collapses same-day meal logs into a single milestone event', () => {
    const mealLogs: MealLog[] = [
      { id: 'm1', clientId: 'c1', date: '2026-01-05', mealName: 'Desayuno', photoUrl: null, note: '', createdAt: 1 },
      { id: 'm2', clientId: 'c1', date: '2026-01-05', mealName: 'Comida', photoUrl: null, note: '', createdAt: 2 },
    ]
    const events = buildHealthTimeline({ weights: [], bloodMarkers: [], photos: [], clinicalNotes: [], mealLogs, checkins: [] })
    const hito = events.find(e => e.id === 'hito-comidas-2026-01-05')
    expect(hito?.type === 'hito' && hito.label).toContain('2 comidas registradas')
  })

  it('sorts events across all types most-recent-first', () => {
    const weights: WeightEntry[] = [{ id: 'w1', clientId: 'c1', date: '2026-02-01', weightKg: 70, note: '' }]
    const bloodMarkers: BloodMarkerRow[] = [{ id: 'b1', client_id: 'c1', date: '2026-03-01', marker_key: 'glucosa', value: 90, created_at: '' }]
    const events = buildHealthTimeline({ weights, bloodMarkers, photos: [], clinicalNotes: [], mealLogs: [], checkins: [] })
    expect(events[0].date).toBe('2026-03-01')
    expect(events[1].date).toBe('2026-02-01')
  })
})

describe('groupTimelineByMonth', () => {
  it('buckets events by year-month and orders groups most-recent-first', () => {
    const events = buildHealthTimeline({
      weights: [
        { id: 'w1', clientId: 'c1', date: '2026-01-15', weightKg: 70, note: '' },
        { id: 'w2', clientId: 'c1', date: '2026-02-15', weightKg: 69, note: '' },
      ],
      bloodMarkers: [], photos: [], clinicalNotes: [], mealLogs: [], checkins: [],
    })
    const groups = groupTimelineByMonth(events)
    expect(groups.map(g => g.label)).toEqual(['febrero 2026', 'enero 2026'])
    expect(groups[0].events).toHaveLength(1)
  })
})
