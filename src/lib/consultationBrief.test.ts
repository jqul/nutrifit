import { describe, it, expect } from 'vitest'
import { BriefInput, buildConsultationBrief, describeMeasurement, DEFAULT_WINDOW_DAYS } from './consultationBrief'
import { DailyCheckin } from '../types'
import { MetricDefinition } from './bodyMetrics'
import { PlanPhase } from './planPhases'

const TODAY = '2026-11-04'
const ms = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime()

function checkin(date: string, over: Partial<DailyCheckin> = {}): DailyCheckin {
  return { id: date, clientId: 'c1', date, followedPlan: 'si', hunger: 3, energy: 3, mood: 3, waterL: 2, notes: '', ...over }
}
function days(from: string, to: string, over: Partial<DailyCheckin> = {}): DailyCheckin[] {
  const out: DailyCheckin[] = []
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86400000)) out.push(checkin(d.toISOString().slice(0, 10), over))
  return out
}

function input(over: Partial<BriefInput> = {}): BriefInput {
  return {
    client: { goal: 'perder_peso', goalWeightKg: 70, createdAt: ms('2026-08-01') },
    todayISO: TODAY, lastConsultationISO: '2026-10-14',
    weights: [], checkins: [], bloodMarkers: [], metricDefs: [], metricValues: [], planChanges: [], clinicalNotes: [], phases: [], alerts: [],
    ...over,
  }
}

describe('period', () => {
  it('compares from the last consultation when there is one', () => {
    const b = buildConsultationBrief(input())
    expect(b.since).toBe('2026-10-14')
    expect(b.fromLastConsultation).toBe(true)
    expect(b.daysSince).toBe(21)
  })
  it('falls back to the last four weeks without one, or if the date is not in the past', () => {
    for (const last of [null, TODAY, '2026-12-01']) {
      const b = buildConsultationBrief(input({ lastConsultationISO: last }))
      expect(b.fromLastConsultation).toBe(false)
      expect(b.daysSince).toBe(DEFAULT_WINDOW_DAYS)
    }
  })
})

describe('weight', () => {
  const weights = [{ date: '2026-09-01', weightKg: 85 }, { date: '2026-10-10', weightKg: 82 }, { date: '2026-10-28', weightKg: 80.5 }, { date: '2026-11-03', weightKg: 80 }]
  it('takes the last weigh-in before the reference date as the starting point', () => {
    const w = buildConsultationBrief(input({ weights })).weight!
    expect(w).toMatchObject({ baselineKg: 82, baselineDate: '2026-10-10', latestKg: 80, deltaKg: -2, goalKg: 70, remainingKg: 10 })
  })
  it('uses the first weigh-in of the period when nothing is older', () => {
    const w = buildConsultationBrief(input({ weights: weights.slice(2) })).weight!
    expect(w.baselineKg).toBe(80.5)
    expect(w.deltaKg).toBe(-0.5)
  })
  it('is null with fewer than two weigh-ins', () => {
    expect(buildConsultationBrief(input({ weights: [weights[3]] })).weight).toBeNull()
  })
})

describe('measurements', () => {
  const defs: MetricDefinition[] = [
    { id: 'a', key: 'waist_cm', name: 'Cintura', unit: 'cm', clientVisible: true, sortOrder: 1 },
    { id: 'b', key: null, name: 'Pliegue', unit: 'mm', clientVisible: false, sortOrder: 0 },
    { id: 'c', key: 'hip_cm', name: 'Cadera', unit: 'cm', clientVisible: true, sortOrder: 2 },
  ]
  it('lists each measured metric with its change since the reference date, hidden ones too (it is for the nutritionist)', () => {
    const b = buildConsultationBrief(input({
      metricDefs: defs,
      metricValues: [{ metricId: 'a', date: '2026-10-01', value: 90 }, { metricId: 'a', date: '2026-11-01', value: 87.5 }, { metricId: 'b', date: '2026-11-01', value: 14 }],
    }))
    expect(b.measurements.map(m => m.name)).toEqual(['Pliegue', 'Cintura'])
    expect(b.measurements[1]).toMatchObject({ latest: 87.5, delta: -2.5 })
    expect(b.measurements[0].delta).toBeNull() // una sola medida
    expect(describeMeasurement(b.measurements[1])).toBe('Cintura 87,5 cm (−2,5 cm)')
  })
})

describe('adherence', () => {
  it('gives the last week, the period and the monthly history with its trend', () => {
    const checkins = [...days('2026-09-01', '2026-09-30'), ...days('2026-10-01', '2026-10-12', { followedPlan: 'no' }), ...days('2026-10-13', '2026-11-04')]
    const a = buildConsultationBrief(input({ checkins })).adherence
    expect(a.last7).toBe(100)
    expect(a.sincePct).toBe(100)
    expect(a.months.map(m => m.month)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11'])
    expect(a.trend).toBe('up')
  })
})

describe('labs', () => {
  it('shows only the latest reading of each marker when it is out of range, newest first', () => {
    const b = buildConsultationBrief(input({
      bloodMarkers: [
        { id: '1', client_id: 'c1', date: '2026-09-01', marker_key: 'glucosa', value: 120, created_at: '' },
        { id: '2', client_id: 'c1', date: '2026-10-30', marker_key: 'glucosa', value: 90, created_at: '' }, // ya normal
        { id: '3', client_id: 'c1', date: '2026-10-30', marker_key: 'colesterol_total', value: 260, created_at: '' },
        { id: '4', client_id: 'c1', date: '2026-10-01', marker_key: 'no_existe', value: 1, created_at: '' },
      ],
    }))
    expect(b.labs.map(l => l.label.toLowerCase())).toEqual([expect.stringContaining('colesterol')])
    expect(b.labs[0]).toMatchObject({ status: 'alto', isNew: true })
  })
})

describe('plan, phase and notes', () => {
  const phase = (id: string, name: string, startDate: string, endDate: string): PlanPhase => ({ id, clientId: 'c1', name, description: '', startDate, endDate, templateId: null })
  it('reports plan changes and notes since the reference date only', () => {
    const b = buildConsultationBrief(input({
      planChanges: [
        { id: 'p1', plan_id: 'x', client_id: 'c1', changed_at: '2026-10-01T10:00:00Z', changed_by: null, changes: [{ field: 'kcal_target', from: 2000, to: 1900 }], reason: 'viejo' },
        { id: 'p2', plan_id: 'x', client_id: 'c1', changed_at: '2026-10-20T10:00:00Z', changed_by: null, changes: [{ field: 'kcal_target', from: 1900, to: 1800 }], reason: 'peso estancado' },
      ],
      clinicalNotes: [{ date: '2026-10-01', note: 'antigua' }, { date: '2026-10-25', note: 'Empieza a entrenar' }],
    }))
    expect(b.planChanges).toHaveLength(1)
    expect(b.planChanges[0].text).toContain('peso estancado')
    expect(b.notes).toEqual([{ date: '2026-10-25', note: 'Empieza a entrenar' }])
  })
  it('names the current phase and the review when it is about to end', () => {
    const b = buildConsultationBrief(input({ phases: [phase('1', 'Definición', '2026-10-10', '2026-11-05'), phase('2', 'Mantenimiento', '2026-11-06', '2026-12-01')] }))
    expect(b.phase).toMatchObject({ name: 'Definición', position: 1, total: 2, daysLeft: 2 })
    expect(b.phaseReviewText).toContain('Mantenimiento')
    expect(b.talkingPoints.some(p => p.includes('termina en 2 días'))).toBe(true)
  })
})

describe('talking points', () => {
  it('flags a client who wants to lose weight and has not', () => {
    const b = buildConsultationBrief(input({ weights: [{ date: '2026-10-10', weightKg: 80 }, { date: '2026-11-03', weightKg: 80.6 }], checkins: days('2026-10-14', TODAY) }))
    expect(b.talkingPoints[0]).toContain('no ha bajado (+0,6 kg)')
  })
  it('flags a very fast loss', () => {
    const b = buildConsultationBrief(input({ weights: [{ date: '2026-10-10', weightKg: 85 }, { date: '2026-11-03', weightKg: 80 }], checkins: days('2026-10-14', TODAY) }))
    expect(b.talkingPoints.join(' ')).toContain('perdiendo rápido')
  })
  it('flags no check-ins at all, low adherence, week alerts and new labs', () => {
    const b = buildConsultationBrief(input({
      alerts: [{ kind: 'high_hunger', priority: 'week', label: 'Hambre alta (4,2/5)' }, { kind: 'goal_reached', priority: 'info', label: 'Objetivo alcanzado' }],
      bloodMarkers: [{ id: '3', client_id: 'c1', date: '2026-10-30', marker_key: 'colesterol_total', value: 260, created_at: '' }],
    }))
    const text = b.talkingPoints.join(' | ')
    expect(text).toContain('ningún check-in')
    expect(text).toContain('Aviso: Hambre alta (4,2/5).')
    expect(text).not.toContain('Objetivo alcanzado')
    expect(text).toContain('Analítica nueva')
  })
  it('celebrates a smaller waist with a steady weight', () => {
    const b = buildConsultationBrief(input({
      weights: [{ date: '2026-10-10', weightKg: 80 }, { date: '2026-11-03', weightKg: 80.2 }], checkins: days('2026-10-14', TODAY),
      metricDefs: [{ id: 'a', key: 'waist_cm', name: 'Cintura', unit: 'cm', clientVisible: true, sortOrder: 0 }],
      metricValues: [{ metricId: 'a', date: '2026-10-01', value: 90 }, { metricId: 'a', date: '2026-11-01', value: 87 }],
      client: { goal: 'mantener', goalWeightKg: null, createdAt: ms('2026-08-01') },
    }))
    expect(b.talkingPoints.join(' ')).toContain('peso está estable pero cintura −3 cm')
  })
  it('is quiet when everything is fine', () => {
    const b = buildConsultationBrief(input({ weights: [{ date: '2026-10-10', weightKg: 82 }, { date: '2026-11-03', weightKg: 80.8 }], checkins: days('2026-10-14', TODAY) }))
    expect(b.talkingPoints).toEqual([])
  })
})
