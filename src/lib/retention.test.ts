import { describe, it, expect } from 'vitest'
import { ClientAlert } from './clientAlerts'
import { RetentionClient, churnRisk, cohorts, daysInactive, isActive, rankByRisk, retentionMetrics } from './retention'

// Lunes 5 oct 2026, mediodía.
const today = new Date('2026-10-05T12:00:00')
const iso = (daysAgo: number) => {
  const d = new Date(today); d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const joined = (daysAgo: number) => today.getTime() - daysAgo * 86400000
const client = (id: string, over: Partial<RetentionClient> = {}): RetentionClient => ({
  id, name: id, surname: 'X', createdAt: joined(100), monthlyPrice: null, goal: 'perder_peso', goalWeightKg: null, lastActivity: iso(0), adherence7d: 90, ...over,
})
const reachedAlert: ClientAlert = { kind: 'goal_reached', priority: 'info', label: 'Objetivo alcanzado' }

describe('daysInactive / isActive', () => {
  it('counts days since the last check-in or weigh-in', () => {
    expect(daysInactive({ lastActivity: iso(0) }, today)).toBe(0)
    expect(daysInactive({ lastActivity: iso(12) }, today)).toBe(12)
    expect(daysInactive({}, today)).toBeNull()
  })
  it('is active within 30 days only', () => {
    expect(isActive({ lastActivity: iso(30) }, today)).toBe(true)
    expect(isActive({ lastActivity: iso(31) }, today)).toBe(false)
    expect(isActive({}, today)).toBe(false)
  })
})

describe('churnRisk', () => {
  it('is high at 10+ days without activity, or no activity at all since signing up', () => {
    expect(churnRisk(client('a', { lastActivity: iso(10) }), today).level).toBe('high')
    expect(churnRisk(client('a', { lastActivity: iso(12) }), today).reasons).toEqual(['Sin actividad hace 12 días'])
    const never = churnRisk(client('a', { lastActivity: undefined }), today)
    expect(never.level).toBe('high')
    expect(never.reasons).toEqual(['Sin actividad desde el alta'])
  })

  it('is medium between 4 and 9 days without activity', () => {
    expect(churnRisk(client('a', { lastActivity: iso(4) }), today).level).toBe('medium')
    expect(churnRisk(client('a', { lastActivity: iso(9) }), today).level).toBe('medium')
    expect(churnRisk(client('a', { lastActivity: iso(3) }), today).level).toBe('low')
  })

  it('is medium with low adherence even if still active', () => {
    const r = churnRisk(client('a', { lastActivity: iso(1), adherence7d: 40 }), today)
    expect(r.level).toBe('medium')
    expect(r.reasons).toEqual(['Adherencia 40%'])
  })

  it('is medium when adherence fell 25+ points against the previous week', () => {
    const r = churnRisk(client('a', { lastActivity: iso(0), adherence7d: 60, adherencePrev7d: 90 }), today)
    expect(r.level).toBe('medium')
    expect(r.reasons).toEqual(['Adherencia −30 pts frente a la semana anterior'])
    expect(churnRisk(client('a', { adherence7d: 70, adherencePrev7d: 90 }), today).level).toBe('low')
  })

  it('mentions low adherence and its drop in a single reason', () => {
    const r = churnRisk(client('a', { lastActivity: iso(1), adherence7d: 40, adherencePrev7d: 85 }), today)
    expect(r.reasons).toEqual(['Adherencia 40% (−45 pts frente a la semana anterior)'])
  })

  it('gives a brand-new client the benefit of the doubt', () => {
    const r = churnRisk(client('a', { createdAt: joined(3), lastActivity: undefined }), today)
    expect(r.level).toBe('low')
    expect(r.reasons).toEqual(['Cliente nuevo'])
  })

  it('says how recently an active client was seen', () => {
    expect(churnRisk(client('a', { lastActivity: iso(0) }), today).reasons).toEqual(['Activo hoy'])
    expect(churnRisk(client('a', { lastActivity: iso(2) }), today).reasons).toEqual(['Activo hace 2 d'])
  })
})

describe('rankByRisk', () => {
  it('puts high before medium before low, the longest inactive first, then by name', () => {
    const list = rankByRisk([
      client('Ok'), client('Mid', { lastActivity: iso(5) }), client('Gone12', { lastActivity: iso(12) }), client('Gone20', { lastActivity: iso(20) }),
    ], today)
    expect(list.map(x => x.client.id)).toEqual(['Gone20', 'Gone12', 'Mid', 'Ok'])
  })
})

describe('retentionMetrics', () => {
  const clients = [
    client('a', { monthlyPrice: 50 }),
    client('b', { monthlyPrice: 70, lastActivity: iso(6) }),                    // riesgo medio, activo
    client('c', { monthlyPrice: 40, lastActivity: iso(45) }),                   // sin actividad >30 d: probablemente perdido, riesgo alto
    client('d', { createdAt: joined(3), lastActivity: iso(1) }),                // nuevo, alta el 2 de octubre (este mes)
    client('e', { monthlyPrice: null, lastActivity: iso(2) }),                  // activo sin precio
  ]

  it('counts active, new this month and likely lost', () => {
    const m = retentionMetrics(clients, today)
    expect(m.total).toBe(5)
    expect(m.active).toBe(4)
    expect(m.newThisMonth).toBe(1)
    expect(m.likelyLost).toBe(1)
  })

  it('computes retention over established clients only (30+ days since sign-up)', () => {
    // establecidos: a, b, c, e (d es nuevo) → 3 activos de 4
    expect(retentionMetrics(clients, today).retentionPct).toBe(75)
  })

  it('has no retention figure until someone is old enough', () => {
    expect(retentionMetrics([client('n', { createdAt: joined(5) })], today).retentionPct).toBeNull()
    expect(retentionMetrics([], today).retentionPct).toBeNull()
  })

  it('splits clients by risk and adds up revenue, average and revenue at risk', () => {
    const m = retentionMetrics(clients, today)
    expect(m.highRisk).toBe(1)
    expect(m.mediumRisk).toBe(1)
    expect(m.revenue.activeMonthly).toBe(120)       // a + b (c está inactivo, e y d sin precio)
    expect(m.revenue.avgPerActiveClient).toBe(60)
    expect(m.revenue.atRiskMonthly).toBe(110)       // b (70) + c (40)
  })

  it('counts the first days of a month as new', () => {
    const m = retentionMetrics([client('x', { createdAt: new Date('2026-10-01T09:00:00').getTime() })], today)
    expect(m.newThisMonth).toBe(1)
  })
})

describe('cohorts', () => {
  const list = [
    client('a', { goal: 'perder_peso', weightStartKg: 80, weightKg: 76, adherence7d: 90, goalWeightKg: 75 }),
    client('b', { goal: 'perder_peso', weightStartKg: 100, weightKg: 95, adherence7d: 70, goalWeightKg: 90, lastActivity: iso(20), alerts: [reachedAlert] }),
    client('c', { goal: 'ganar_masa', weightStartKg: 70, weightKg: 72, adherence7d: 80 }),
  ]

  it('groups by goal, the biggest group first, with weight change, adherence and who is active this week', () => {
    const rows = cohorts(list, 'goal', today)
    expect(rows.map(r => r.label)).toEqual(['Perder peso', 'Ganar masa'])
    const lose = rows[0]
    expect(lose.clients).toBe(2)
    expect(lose.weightChangePct).toBe(-5)             // (-5 % y -5 %) → -5
    expect(lose.adherencePct).toBe(80)
    expect(lose.activeWeekPct).toBe(50)               // b lleva 20 días sin actividad
  })

  it('computes goal reached only among clients that have a goal weight', () => {
    const rows = cohorts(list, 'goal', today)
    expect(rows[0].goalReachedPct).toBe(50)           // a no, b sí
    expect(rows[1].goalReachedPct).toBeNull()         // c no tiene peso objetivo
  })

  it('groups by join month, the most recent first', () => {
    const rows = cohorts([
      client('a', { createdAt: new Date('2026-08-10T10:00:00').getTime() }),
      client('b', { createdAt: new Date('2026-09-02T10:00:00').getTime() }),
      client('c', { createdAt: new Date('2026-09-20T10:00:00').getTime() }),
    ], 'joinMonth', today)
    expect(rows.map(r => `${r.label}:${r.clients}`)).toEqual(['sept 2026:2', 'ago 2026:1'])
  })

  it('handles clients without a goal or weights', () => {
    const rows = cohorts([client('a', { goal: null, weightStartKg: undefined, weightKg: undefined })], 'goal', today)
    expect(rows[0].label).toBe('Sin objetivo')
    expect(rows[0].weightChangePct).toBeNull()
  })
})
