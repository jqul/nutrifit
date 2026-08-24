import { describe, it, expect } from 'vitest'
import { computeClientHealth } from './clientHealth'

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
})
