import { describe, it, expect } from 'vitest'
import { computeClientHealth, hasUnreviewedActivity } from './clientHealth'

function dateStr(daysAgo: number, ref = new Date()): string {
  const d = new Date(ref)
  d.setDate(d.getDate() - daysAgo)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const ref = new Date('2026-06-15T00:00:00')
const oldClient = { createdAt: ref.getTime() - 200 * 86400000 }

describe('computeClientHealth', () => {
  it('flags attention when last check-in is older than the threshold', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(8, ref), monthlyPrice: 40 }, true, ref)
    expect(h.status).toBe('attention')
    expect(h.label).toBe('Sin check-in hace 8d')
  })

  it('flags attention when there are no check-ins at all, for an established client', () => {
    const h = computeClientHealth({ ...oldClient, monthlyPrice: null }, false, ref)
    expect(h.status).toBe('attention')
    expect(h.label).toBe('Sin check-ins todavía')
  })

  it('does not flag a brand-new client for lacking check-ins yet', () => {
    const h = computeClientHealth({ createdAt: ref.getTime() - 1 * 86400000, monthlyPrice: null }, false, ref)
    expect(h.status).not.toBe('attention')
  })

  it('flags billing when monthlyPrice is set and no invoice exists for the current period', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: 45 }, false, ref)
    expect(h.status).toBe('billing')
    expect(h.label).toBe('Plan por renovar')
  })

  it('does not flag billing when monthlyPrice is not set', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: null }, false, ref)
    expect(h.status).not.toBe('billing')
  })

  it('flags streak when active and on a streak of 3+ days', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: 45, streak: 5 }, true, ref)
    expect(h.status).toBe('streak')
    expect(h.label).toBe('En racha · 5d')
  })

  it('falls back to active when nothing else applies', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(1, ref), monthlyPrice: 45, streak: 1 }, true, ref)
    expect(h.status).toBe('active')
  })

  it('prioritizes attention over billing and streak', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(10, ref), monthlyPrice: 45, streak: 0 }, false, ref)
    expect(h.status).toBe('attention')
  })

  it('prioritizes billing over streak', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: 45, streak: 10 }, false, ref)
    expect(h.status).toBe('billing')
  })

  it('flags attention for a biomarker alert even when everything else looks fine', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: 45, streak: 5, hasBiomarkerAlert: true }, true, ref)
    expect(h.status).toBe('attention')
    expect(h.label).toBe('Analítica en alerta')
  })

  it('prioritizes inactivity over a biomarker alert', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(10, ref), monthlyPrice: 45, hasBiomarkerAlert: true }, true, ref)
    expect(h.label).toBe('Sin check-in hace 10d')
  })

  it('shows the biomarker alert once inactivity no longer applies', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: 45, hasBiomarkerAlert: true }, true, ref)
    expect(h.label).toBe('Analítica en alerta')
  })

  it('flags attention for unreviewed activity when nothing more urgent applies', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: 45, streak: 5, hasUnreviewedActivity: true }, true, ref)
    expect(h.status).toBe('attention')
    expect(h.label).toBe('Check-in o encuesta sin revisar')
  })

  it('prioritizes inactivity over unreviewed activity', () => {
    const h = computeClientHealth({ ...oldClient, lastCheckin: dateStr(10, ref), monthlyPrice: 45, hasUnreviewedActivity: true }, true, ref)
    expect(h.label).toBe('Sin check-in hace 10d')
  })
})

describe('hasUnreviewedActivity', () => {
  it('returns false when there is no activity at all', () => {
    expect(hasUnreviewedActivity(null, undefined, undefined)).toBe(false)
  })

  it('returns true when there is activity but it has never been reviewed', () => {
    expect(hasUnreviewedActivity(null, '2026-06-10', undefined)).toBe(true)
  })

  it('returns true when the last check-in is newer than the last review', () => {
    expect(hasUnreviewedActivity('2026-06-05T10:00:00Z', '2026-06-10', undefined)).toBe(true)
  })

  it('returns false when the last check-in is older than the last review', () => {
    expect(hasUnreviewedActivity('2026-06-15T10:00:00Z', '2026-06-10', undefined)).toBe(false)
  })

  it('treats a check-in on the same day as the review as already reviewed', () => {
    expect(hasUnreviewedActivity('2026-06-10T20:00:00', '2026-06-10', undefined)).toBe(false)
  })

  it('returns true when a survey response is newer than the last review', () => {
    expect(hasUnreviewedActivity('2026-06-05T10:00:00Z', undefined, '2026-06-10T09:00:00Z')).toBe(true)
  })

  it('returns false when both check-in and survey are older than the last review', () => {
    expect(hasUnreviewedActivity('2026-06-20T00:00:00Z', '2026-06-10', '2026-06-11T09:00:00Z')).toBe(false)
  })
})

describe('computeClientHealth reason', () => {
  it('reports why a client needs attention, so the control center can prioritise', () => {
    expect(computeClientHealth({ ...oldClient, lastCheckin: dateStr(8, ref), monthlyPrice: 40 }, true, ref).reason).toBe('inactive')
    expect(computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: 40, hasBiomarkerAlert: true }, true, ref).reason).toBe('biomarker')
    expect(computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: 40, hasUnreviewedActivity: true }, true, ref).reason).toBe('unreviewed')
  })

  it('reports billing, streak and active for the non-attention states', () => {
    expect(computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: 40 }, false, ref).reason).toBe('billing')
    expect(computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: null, streak: 5 }, false, ref).reason).toBe('streak')
    expect(computeClientHealth({ ...oldClient, lastCheckin: dateStr(0, ref), monthlyPrice: null, streak: 1 }, false, ref).reason).toBe('active')
  })
})

describe('días sin check-in a distintas horas del día', () => {
  const old = { createdAt: new Date('2026-01-01T00:00:00').getTime() }
  const at = (hhmm: string) => new Date(`2026-06-15T${hhmm}:00`)
  const threeDaysAgo = '2026-06-12'

  it('counts calendar days, not elapsed hours: the same on a morning and on a late night', () => {
    for (const h of ['00:00', '08:30', '12:00', '15:45', '23:59']) {
      const r = computeClientHealth({ ...old, lastCheckin: threeDaysAgo, monthlyPrice: null }, false, at(h))
      expect(r.status, `a las ${h}`).toBe('active')           // hace 3 días todavía no es riesgo
    }
  })

  it('flags 4 days without a check-in at any hour, with the right label', () => {
    for (const h of ['00:00', '15:45', '23:59']) {
      const r = computeClientHealth({ ...old, lastCheckin: '2026-06-11', monthlyPrice: null }, false, at(h))
      expect(r.label, `a las ${h}`).toBe('Sin check-in hace 4d')
    }
  })
})
