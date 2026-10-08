import { describe, it, expect } from 'vitest'
import { Appointment } from '../types'
import { ClientHealthReason } from './clientHealth'
import { ClientAlert } from './clientAlerts'
import { priorityOf, issuesOf, summarizePriorities, attentionList, goalReachedClients, greeting, sortTodayAppointments, monthlyRevenue, recommendedAction, dayHeadline, okBreakdown } from './controlCenter'

const c = (name: string, healthReason?: ClientHealthReason, alerts?: ClientAlert[], surname = 'X') => ({ name, surname, healthReason, healthLabel: healthReason, alerts })
const alert = (kind: ClientAlert['kind'], priority: ClientAlert['priority'] = 'week', label: string = kind): ClientAlert => ({ kind, priority, label })

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

describe('issuesOf / alerts', () => {
  it('turns the health reason and the weekly alerts into issues, most urgent first, each with the tab to open', () => {
    const issues = issuesOf({ healthReason: 'inactive', healthLabel: 'Sin check-in hace 9d', alerts: [alert('weight_stalled', 'week', 'Peso estancado 3 semanas')] })
    expect(issues).toEqual([
      { priority: 'today', label: 'Sin check-in hace 9d', tab: 'mensajes' },
      { priority: 'week', label: 'Peso estancado 3 semanas', tab: 'seguimiento' },
    ])
  })
  it('opens the lab tab for a biomarker alert and the profile for a renewal', () => {
    expect(issuesOf({ healthReason: 'biomarker', healthLabel: 'Analítica en alerta' })[0].tab).toBe('analiticas')
    expect(issuesOf({ healthReason: 'billing', healthLabel: 'Falta la factura de este mes' })[0].tab).toBe('perfil')
  })
  it('puts an urgent health issue before a weekly alert even if the alert comes first', () => {
    const issues = issuesOf({ healthReason: 'inactive', healthLabel: 'x', alerts: [alert('high_hunger')] })
    expect(issues.map(i => i.priority)).toEqual(['today', 'week'])
  })
  it('does not treat good news as something to act on', () => {
    expect(issuesOf({ healthReason: 'active', alerts: [alert('goal_reached', 'info')] })).toEqual([])
    expect(priorityOf({ healthReason: 'active', alerts: [alert('goal_reached', 'info')] })).toBe('ok')
  })
  it('a weekly alert alone makes an otherwise active client "revisar esta semana"', () => {
    expect(priorityOf({ healthReason: 'active', alerts: [alert('low_adherence')] })).toBe('week')
  })
})

describe('goalReachedClients', () => {
  it('lists only clients with a goal_reached alert', () => {
    const list = goalReachedClients([c('A', 'active', [alert('goal_reached', 'info')]), c('B', 'active'), c('C', 'inactive', [alert('weight_stalled')])])
    expect(list.map(x => x.name)).toEqual(['A'])
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
  it('includes active clients that only have a weekly alert, with all their issues', () => {
    const list = attentionList([c('Eva', 'active', [alert('high_hunger', 'week', 'Hambre alta'), alert('low_energy', 'week', 'Energía baja')])])
    expect(list).toHaveLength(1)
    expect(list[0].priority).toBe('week')
    expect(list[0].issues.map(i => i.label)).toEqual(['Hambre alta', 'Energía baja'])
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

describe('recommendedAction', () => {
  it('asks to write first when the client is inactive, before touching the plan if there is more going on', () => {
    expect(recommendedAction({ healthReason: 'inactive' })).toBe('Escríbele para retomar el contacto.')
    expect(recommendedAction({ healthReason: 'inactive', alerts: [alert('low_adherence')] })).toMatch(/antes de tocar el plan/)
  })
  it('does not suggest changing the plan when adherence is the problem', () => {
    expect(recommendedAction({ alerts: [alert('low_adherence'), alert('weight_stalled')] })).toMatch(/antes de modificarlo/)
  })
  it('tells a stalled weight with good adherence from one with poor adherence', () => {
    expect(recommendedAction({ alerts: [alert('weight_stalled')], adherence7d: 90 })).toMatch(/valora ajustarlo/)
    expect(recommendedAction({ alerts: [alert('weight_stalled')], adherence7d: 40 })).toMatch(/Mira primero la adherencia/)
    expect(recommendedAction({ alerts: [alert('weight_stalled')] })).toMatch(/Mira primero la adherencia/)
  })
  it('has a suggestion for the other warnings', () => {
    expect(recommendedAction({ alerts: [alert('high_hunger')] })).toMatch(/hambre y energía/)
    expect(recommendedAction({ alerts: [alert('no_weigh_in')] })).toMatch(/se pese/)
    expect(recommendedAction({ healthReason: 'biomarker' })).toMatch(/analítica/)
    expect(recommendedAction({ healthReason: 'unreviewed' })).toMatch(/Marcar|márcalo/)
    expect(recommendedAction({ healthReason: 'billing' })).toMatch(/factura/)
  })
  it('ignores good news and says nothing when there is nothing to do', () => {
    expect(recommendedAction({ alerts: [alert('goal_reached', 'info')] })).toBeNull()
    expect(recommendedAction({ healthReason: 'active' })).toBeNull()
    expect(recommendedAction({})).toBeNull()
  })
})

describe('dayHeadline', () => {
  it('lists only what is there, joined naturally', () => {
    expect(dayHeadline({ appointments: 5, actToday: 2, pendingReviews: 4, goalsReached: 1 }))
      .toBe('Hoy: 5 citas, 2 clientes para actuar hoy, 4 revisiones semanales pendientes y 1 objetivo alcanzado.')
    expect(dayHeadline({ appointments: 1, actToday: 0, pendingReviews: 0, goalsReached: 0 })).toBe('Hoy: 1 cita.')
    expect(dayHeadline({ appointments: 0, actToday: 1, pendingReviews: 3, goalsReached: 0 })).toBe('Hoy: 1 cliente para actuar hoy y 3 revisiones semanales pendientes.')
  })
  it('says there is nothing urgent when everything is zero', () => {
    expect(dayHeadline({ appointments: 0, actToday: 0, pendingReviews: 0, goalsReached: 0 })).toBe('Hoy no tienes nada urgente.')
  })
})

describe('okBreakdown', () => {
  const today = new Date(2026, 9, 8)
  const fine = (over: Record<string, unknown> = {}) => ({ ...c('A', 'active'), lastCheckin: '2026-10-07', adherence7d: 90, streak: 5, ...over })
  it('counts why the clients without incidents are fine, ignoring those who need attention', () => {
    const clients = [fine(), fine({ lastCheckin: '2026-09-20', adherence7d: 50, streak: 0 }), { ...c('B', 'inactive'), lastCheckin: '2026-10-07', adherence7d: 95, streak: 9 }]
    expect(okBreakdown(clients, today)).toEqual({ total: 2, recentCheckin: 1, goodAdherence: 1, onStreak: 1 })
  })
  it('handles clients with no data yet', () => {
    expect(okBreakdown([c('A')], today)).toEqual({ total: 1, recentCheckin: 0, goodAdherence: 0, onStreak: 0 })
  })
})
