import { describe, it, expect } from 'vitest'
import { ActiveAlert, isKindEnabled, isAppointmentReminderEnabled, planAlertNotifications, buildDigest, alertKey } from './alertDigest'

const a = (clientId: string, clientName: string, kind: ActiveAlert['kind'], label: string = kind): ActiveAlert => ({ clientId, clientName, kind, label })

describe('settings', () => {
  it('treats everything as enabled unless explicitly switched off', () => {
    expect(isKindEnabled(undefined, 'high_hunger')).toBe(true)
    expect(isKindEnabled({}, 'high_hunger')).toBe(true)
    expect(isKindEnabled({ kinds: { high_hunger: false } }, 'high_hunger')).toBe(false)
    expect(isKindEnabled({ kinds: { high_hunger: false } }, 'low_energy')).toBe(true)
    expect(isAppointmentReminderEnabled(null)).toBe(true)
    expect(isAppointmentReminderEnabled({ appointments_tomorrow: false })).toBe(false)
  })
})

describe('planAlertNotifications', () => {
  it('notifies alerts that were not notified before', () => {
    const plan = planAlertNotifications([a('c1', 'Ana', 'high_hunger'), a('c2', 'Bea', 'low_energy')], new Set(), undefined)
    expect(plan.toNotify.map(alertKey)).toEqual(['c1:high_hunger', 'c2:low_energy'])
    expect(plan.keysToClear).toEqual([])
  })

  it('does not notify the same alert twice', () => {
    const plan = planAlertNotifications([a('c1', 'Ana', 'high_hunger')], new Set(['c1:high_hunger']), undefined)
    expect(plan.toNotify).toEqual([])
    expect(plan.keysToClear).toEqual([])
  })

  it('forgets alerts that ended so they notify again if they come back', () => {
    const plan = planAlertNotifications([], new Set(['c1:high_hunger']), undefined)
    expect(plan.keysToClear).toEqual(['c1:high_hunger'])
  })

  it('ignores alert types the nutritionist switched off, and forgets their old state', () => {
    const plan = planAlertNotifications([a('c1', 'Ana', 'high_hunger')], new Set(['c1:high_hunger']), { kinds: { high_hunger: false } })
    expect(plan.toNotify).toEqual([])
    expect(plan.keysToClear).toEqual(['c1:high_hunger'])
  })

  it('notifies only the new one when a client already had another alert', () => {
    const plan = planAlertNotifications([a('c1', 'Ana', 'high_hunger'), a('c1', 'Ana', 'low_energy')], new Set(['c1:high_hunger']), undefined)
    expect(plan.toNotify.map(alertKey)).toEqual(['c1:low_energy'])
  })
})

describe('buildDigest', () => {
  it('returns null when there is nothing to say', () => {
    expect(buildDigest([], [])).toBeNull()
  })

  it('groups alerts by client in a single message', () => {
    const d = buildDigest([a('c1', 'Carlos', 'high_hunger', 'Hambre alta'), a('c1', 'Carlos', 'weight_stalled', 'Peso estancado'), a('c2', 'Laura', 'no_weigh_in', 'Sin registrar peso')], [])!
    expect(d.title).toBe('2 clientes con avisos nuevos')
    expect(d.body).toBe('Carlos (Hambre alta, Peso estancado) · Laura (Sin registrar peso)')
  })

  it('uses the singular for one client', () => {
    expect(buildDigest([a('c1', 'Carlos', 'high_hunger', 'Hambre alta')], [])!.title).toBe('1 cliente con avisos nuevos')
  })

  it('caps the names shown and says how many more', () => {
    const many = ['A', 'B', 'C', 'D', 'E'].map((n, i) => a(`c${i}`, n, 'low_energy', 'Energía baja'))
    const d = buildDigest(many, [])!
    expect(d.body).toBe('A (Energía baja) · B (Energía baja) · C (Energía baja) · +2 más')
  })

  it('adds tomorrow\'s appointments, alone or after the alerts', () => {
    const appts = [{ time: '10:00', clientName: 'María', title: 'Consulta' }, { time: '12:30', clientName: null, title: 'Bloqueo' }, { time: '17:00', clientName: 'Eva', title: 'x' }]
    const only = buildDigest([], appts)!
    expect(only.title).toBe('Tienes citas mañana')
    expect(only.body).toBe('Mañana: 3 citas (10:00 María, 12:30 Bloqueo, …)')
    const both = buildDigest([a('c1', 'Carlos', 'high_hunger', 'Hambre alta')], [appts[0]])!
    expect(both.body).toBe('Carlos (Hambre alta)\nMañana: 1 cita (10:00 María)')
  })
})
