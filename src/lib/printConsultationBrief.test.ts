import { describe, it, expect } from 'vitest'
import { buildConsultationBriefHtml, briefDate, briefPeriodLabel } from './printConsultationBrief'
import { buildConsultationBrief } from './consultationBrief'

const brief = (over = {}) => buildConsultationBrief({
  client: { goal: 'perder_peso', goalWeightKg: 70, createdAt: new Date('2026-08-01T12:00:00Z').getTime() },
  todayISO: '2026-11-04', lastConsultationISO: '2026-10-14',
  weights: [{ date: '2026-10-10', weightKg: 82 }, { date: '2026-11-03', weightKg: 80 }],
  checkins: [], bloodMarkers: [], metricDefs: [], metricValues: [], planChanges: [], clinicalNotes: [], phases: [], alerts: [],
  ...over,
})

describe('briefDate / briefPeriodLabel', () => {
  it('writes short dates and the period', () => {
    expect(briefDate('2026-10-14')).toBe('14 oct')
    expect(briefPeriodLabel(brief())).toBe('desde la última consulta (14 oct, hace 21 días)')
    expect(briefPeriodLabel(brief({ lastConsultationISO: null }))).toBe('últimas 4 semanas (no hay una consulta anterior registrada)')
  })
})

describe('buildConsultationBriefHtml', () => {
  it('builds a page with the client name, the weight and the talking points', () => {
    const html = buildConsultationBriefHtml({ name: 'María', surname: 'Torres' }, brief(), undefined, '4 de noviembre de 2026')
    expect(html).toContain('María Torres')
    expect(html).toContain('82 → 80 kg')
    expect(html).toContain('Para hablar')
    expect(html).toContain('desde la última consulta (14 oct, hace 21 días)')
    expect(html).toContain('ningún check-in')
  })
  it('escapes anything typed by a person (names, notes, plan reasons)', () => {
    const html = buildConsultationBriefHtml({ name: '<img src=x onerror=1>', surname: 'Z' }, brief({ clinicalNotes: [{ date: '2026-10-20', note: '<script>alert(1)</script>' }] }))
    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })
  it('only uses a valid hex accent colour', () => {
    expect(buildConsultationBriefHtml({ name: 'A', surname: 'B' }, brief(), { accentColor: 'red;}</style><script>' })).not.toContain('<script>')
    expect(buildConsultationBriefHtml({ name: 'A', surname: 'B' }, brief(), { accentColor: '#123abc' })).toContain('#123abc')
  })
  it('says so when there is nothing to highlight', () => {
    const quiet = brief({ checkins: Array.from({ length: 22 }, (_, i) => ({ id: `${i}`, clientId: 'c1', date: new Date(Date.UTC(2026, 9, 14 + i)).toISOString().slice(0, 10), followedPlan: 'si' as const, hunger: 3, energy: 3, mood: 3, waterL: 2, notes: '' })), weights: [{ date: '2026-10-10', weightKg: 82 }, { date: '2026-11-03', weightKg: 80.8 }] })
    expect(buildConsultationBriefHtml({ name: 'A', surname: 'B' }, quiet)).toContain('Nada especial que destacar')
  })
})
