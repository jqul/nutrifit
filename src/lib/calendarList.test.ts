import { describe, it, expect } from 'vitest'
import { Appointment } from '../types'
import { groupAppointmentsByDay, dayHeading } from './calendarList'

const appt = (id: string, local: string): Appointment => ({
  id, nutricionistaId: 'n', clientId: null, title: id, startAt: new Date(local).toISOString(),
  endAt: new Date(local).toISOString(), status: 'confirmada', notes: '', recurring: null, videoLink: null,
})

describe('groupAppointmentsByDay', () => {
  it('returns nothing for an empty week', () => {
    expect(groupAppointmentsByDay([])).toEqual([])
  })

  it('groups by local day, sorted by time, skipping days without appointments', () => {
    const groups = groupAppointmentsByDay([
      appt('c', '2026-10-07T09:00:00'), appt('b', '2026-10-05T16:30:00'), appt('a', '2026-10-05T10:00:00'),
    ])
    expect(groups.map(g => g.day)).toEqual(['2026-10-05', '2026-10-07'])
    expect(groups[0].appointments.map(a => a.id)).toEqual(['a', 'b'])
    expect(groups[1].appointments.map(a => a.id)).toEqual(['c'])
  })

  it('does not mutate the input array', () => {
    const input = [appt('b', '2026-10-05T16:30:00'), appt('a', '2026-10-05T10:00:00')]
    groupAppointmentsByDay(input)
    expect(input.map(a => a.id)).toEqual(['b', 'a'])
  })
})

describe('dayHeading', () => {
  const today = new Date('2026-10-05T12:00:00')
  it('names today and tomorrow', () => {
    expect(dayHeading('2026-10-05', today)).toBe('Hoy')
    expect(dayHeading('2026-10-06', today)).toBe('Mañana')
  })
  it('spells out other days with weekday, day and month', () => {
    const h = dayHeading('2026-10-08', today)
    expect(h).toContain('jueves')
    expect(h).toContain('8')
  })
})
