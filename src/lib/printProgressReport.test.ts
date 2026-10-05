import { describe, it, expect } from 'vitest'
import { ClientData, DailyCheckin, WeightEntry } from '../types'
import { DietPlanChangeRow } from './supabase-types'
import { buildProgressReportHtml, DEFAULT_REPORT_OPTIONS, ProgressReportData, ReportOptions } from './printProgressReport'

const today = new Date('2026-10-05T12:00:00')
const iso = (daysAgo: number) => {
  const d = new Date(today); d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const w = (daysAgo: number, weightKg: number): WeightEntry => ({ id: `w${daysAgo}`, clientId: 'c', date: iso(daysAgo), weightKg, note: '' })
const ck = (daysAgo: number, over: Partial<DailyCheckin> = {}): DailyCheckin => ({
  id: `c${daysAgo}`, clientId: 'c', date: iso(daysAgo), followedPlan: 'si', hunger: 3, energy: 3, mood: 3, waterL: null, notes: '', ...over,
})
const change = (daysAgo: number, reason: string | null): DietPlanChangeRow => ({
  id: `p${daysAgo}`, plan_id: 'pl', client_id: 'c', changed_at: new Date(today.getTime() - daysAgo * 86400000).toISOString(), changed_by: null,
  changes: [{ field: 'kcal_target', from: 1700, to: 1600 }, { field: 'protein_g', from: 120, to: 130 }], reason,
})

const client = {
  name: 'María', surname: 'Torres', goal: 'perder_peso', goalWeightKg: 62, heightCm: 165, reportNotes: 'Seguir así.',
} as unknown as ClientData

const data: ProgressReportData = {
  weights: [w(40, 68), w(20, 66), w(2, 64)],
  checkins: [0, 1, 2, 3, 4, 5, 6].map(d => ck(d, { hunger: 4, energy: 2 })),
  bloodMarkers: [],
  planChanges: [change(10, 'Peso estancado 2 semanas')],
  reviews: [{ week_start: '2026-09-28', status: 'edited', note: 'Mantener plan; revisar analítica.' }],
}

const options = (over: Partial<ReportOptions['sections']> = {}, period: ReportOptions['period'] = '30d'): ReportOptions => ({
  period, sections: { signals: true, planChanges: true, reviews: true, bloodMarkers: true, notes: true, ...over },
})
const html = (opts: ReportOptions, d = data, c = client) => buildProgressReportHtml(c, d, undefined, opts, today)

describe('buildProgressReportHtml', () => {
  it('names the client, the goal and the period', () => {
    const h = html(options())
    expect(h).toContain('María Torres')
    expect(h).toContain('Últimos 30 días')
    expect(h).toContain('6 sept 2026')
    expect(h).toContain('5 oct 2026')
  })

  it('shows the weight change inside the period', () => {
    const h = html(options())
    expect(h).toContain('−2,0 kg')          // 66 → 64
    expect(h).toContain('66 → 64 kg')
  })

  it('shows the whole history when the period is "all"', () => {
    const h = html(options({}, 'all'))
    expect(h).toContain('−4,0 kg')          // 68 → 64
    expect(h).toContain('Todo el historial')
  })

  it('includes the signals, plan changes with their reason and the nutritionist valuation when asked', () => {
    const h = html(options())
    expect(h).toContain('Hábitos y señales')
    expect(h).toContain('Hambre')
    expect(h).toContain('Cambios en el plan')
    expect(h).toContain('Kcal: 1700 → 1600')
    expect(h).toContain('Proteína: 120 → 130 g')
    expect(h).toContain('Motivo: Peso estancado 2 semanas')
    expect(h).toContain('Valoración del profesional')
    expect(h).toContain('Mantener plan; revisar analítica.')
    expect(h).toContain('Observaciones y próximos objetivos')
  })

  it('leaves out every optional section that is switched off', () => {
    const h = html(options({ signals: false, planChanges: false, reviews: false, bloodMarkers: false, notes: false }))
    for (const t of ['Hábitos y señales', 'Cambios en el plan', 'Valoración del profesional', 'Analíticas recientes', 'Observaciones y próximos objetivos']) {
      expect(h).not.toContain(t)
    }
    expect(h).toContain('Evolución del peso')
  })

  it('does not print internal material by default (the client download)', () => {
    const h = buildProgressReportHtml(client, data, undefined, DEFAULT_REPORT_OPTIONS, today)
    expect(h).not.toContain('Cambios en el plan')
    expect(h).not.toContain('Peso estancado 2 semanas')
    expect(h).not.toContain('Valoración del profesional')
    expect(h).not.toContain('Mantener plan; revisar analítica.')
  })

  it('says so when there are no plan changes in the period', () => {
    const h = html(options(), { ...data, planChanges: [change(80, 'antiguo')] })
    expect(h).toContain('No ha habido cambios en los objetivos del plan durante este periodo.')
    expect(h).not.toContain('antiguo')
  })

  it('escapes user-written text so it cannot inject HTML into the report', () => {
    const evil = '<img src=x onerror=alert(1)>'
    const h = html(options(), {
      ...data, planChanges: [change(5, evil)], reviews: [{ week_start: '2026-09-28', status: 'edited', note: evil }],
    }, { ...client, name: evil, reportNotes: evil } as unknown as ClientData)
    expect(h).not.toContain('<img src=x')
    expect(h).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})
