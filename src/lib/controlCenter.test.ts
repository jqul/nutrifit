import { describe, it, expect } from 'vitest'
import { Appointment } from '../types'
import { ClientHealthReason } from './clientHealth'
import { priorityOf, summarizePriorities, attentionList, greeting, sortTodayAppointments, monthlyRevenue } from './controlCenter'

const c = (name: string, healthReason?: ClientHealthReason, surname = 'X') => ({ name, surname, healthReason, healthLabel: healthReason })

describe('priorityOf', () => {
  it('asks to act today only for inactivity', () => {
    expect(priorityOf({ healthReason: 'inactive' })).toBe('today')
  })
  it('puts biomarker alerts, unreviewed activity and renewals in the weekly review', () => {
    expect(priorityOf({ healthReason: 'biomarker' })).toBe('week')
    expect(priorityOf({ healthReason: 'unreviewed' })).toBe('week')
    expect(priorityOf({ healthReason: 'billing' })).toBe('week')
  })
  it('treats active, streak and unknown as fine', () => {
    expect(priorityOf({ healthReason: 'active' })).toBe('ok')
    expect(priorityOf({ healthReason: 'streak' })).toBe('ok')
    expect(priorityOf({})).toBe('ok')
  })
})

describe('summarizePriorities', () => {
  it('counts each level and the total', () => {
    const s = summarizePriorities([c('A', 'inactive'), c('B', 'billing'), c('C', 'unreviewed'), c('D', 'active'), c('E', 'streak')])
    expect(s).toEqual({ today: 1, week: 2, ok: 2, total: 5 })
  })
  it('handles no clients', () => {
    expect(summarizePriorities([])).toEqual({ today: 0, week: 0, ok: 0, total: 0 })
  })
})

describe('attentionList', () => {
  it('lists today first, then this week, alphabetically within each, without the fine ones', () => {
    const list = attentionList([c('Zoe', 'inactive'), c('Ana', 'billing'), c('Bea', 'active'), c('Carlos', 'inactive'), c('Dani', 'biomarker')])
    expect(list.map(i => `${i.priority}:${i.client.name}`)).toEqual(['today:Carlos', 'today:Zoe', 'week:Ana', 'week:Dani'])
  })
})

describe('greeting', () => {
  it('adapts to the time of day and uses the first name only', () => {
    expect(greeting(new Date('2026-10-05T09:00:00'), 'Ana López')).toBe('Buenos días, Ana')
    expect(greeting(new Date('2026-10-05T15:00:00'), 'Ana López')).toBe('Buenas tardes, Ana')
    expect(greeting(new Date('2026-10-05T23:00:00'), 'Ana')).toBe('Buenas noches, Ana')
    expect(greeting(new Date('2026-10-05T03:00:00'), 'Ana')).toBe('Buenas noches, Ana')
  })
  it('works without a name', () => {
    expect(greeting(new Date('2026-10-05T09:00:00'), '  ')).toBe('Buenos días')
  })
})

describe('sortTodayAppointments', () => {
  const a = (id: string, local: string, status: Appointment['status'] = 'confirmada'): Appointment => ({
    id, nutricionistaId: 'n', clientId: null, title: id, startAt: new Date(local).toISOString(), endAt: '', status, notes: '', recurring: null, videoLink: null,
  })
  it('drops cancelled ones and sorts by time', () => {
    const out = sortTodayAppointments([a('late', '2026-10-05T16:00:00'), a('gone', '2026-10-05T12:00:00', 'cancelada'), a('early', '2026-10-05T09:00:00')])
    expect(out.map(x => x.id)).toEqual(['early', 'late'])
  })
})

describe('monthlyRevenue', () => {
  it('adds assigned prices and counts clients without one', () => {
    expect(monthlyRevenue([{ monthlyPrice: 45 }, { monthlyPrice: 60 }, { monthlyPrice: null }])).toEqual({ total: 105, withoutPrice: 1 })
  })
  it('is zero with no clients', () => {
    expect(monthlyRevenue([])).toEqual({ total: 0, withoutPrice: 0 })
  })
})
