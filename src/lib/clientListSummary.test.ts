import { describe, it, expect } from 'vitest'
import { summarizeWeight, weightDeltaTone, sortByAttention, formatKg, formatWeightDelta } from './clientListSummary'

const today = new Date('2026-10-04T12:00:00')
const d = (daysAgo: number) => {
  const x = new Date(today); x.setDate(x.getDate() - daysAgo)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

describe('summarizeWeight', () => {
  it('returns null with no entries', () => {
    expect(summarizeWeight([], today)).toBeNull()
  })

  it('gives the latest weight and no delta with a single entry', () => {
    expect(summarizeWeight([{ date: d(1), weightKg: 70 }], today)).toEqual({ latestKg: 70, deltaKg: null })
  })

  it('computes the change against the first entry inside the window', () => {
    const r = summarizeWeight([{ date: d(27), weightKg: 69 }, { date: d(10), weightKg: 68.5 }, { date: d(1), weightKg: 68.4 }], today)
    expect(r).toEqual({ latestKg: 68.4, deltaKg: -0.6 })
  })

  it('ignores entries older than the window for the delta', () => {
    const r = summarizeWeight([{ date: d(90), weightKg: 80 }, { date: d(2), weightKg: 70 }], today)
    expect(r).toEqual({ latestKg: 70, deltaKg: null })
  })

  it('does not depend on input order', () => {
    const r = summarizeWeight([{ date: d(1), weightKg: 68.4 }, { date: d(20), weightKg: 69 }], today)
    expect(r?.latestKg).toBe(68.4)
    expect(r?.deltaKg).toBe(-0.6)
  })
})

describe('weightDeltaTone', () => {
  it('is good when losing and the goal is to lose', () => {
    expect(weightDeltaTone('perder_peso', -0.6)).toBe('good')
    expect(weightDeltaTone('perder_peso', 0.4)).toBe('bad')
  })
  it('is good when gaining and the goal is to gain', () => {
    expect(weightDeltaTone('ganar_masa', 0.4)).toBe('good')
    expect(weightDeltaTone('ganar_masa', -0.4)).toBe('bad')
  })
  it('is neutral for other goals, no change or no data', () => {
    expect(weightDeltaTone('mantenimiento', 1)).toBe('neutral')
    expect(weightDeltaTone('perder_peso', 0)).toBe('neutral')
    expect(weightDeltaTone('perder_peso', null)).toBe('neutral')
    expect(weightDeltaTone(null, -1)).toBe('neutral')
  })
})

describe('sortByAttention', () => {
  it('puts attention first, then billing, then the rest, alphabetically within each group', () => {
    const list = [
      { name: 'Ana', surname: 'Z', healthStatus: 'active' as const },
      { name: 'Beto', surname: 'Y', healthStatus: 'attention' as const },
      { name: 'Carla', surname: 'X', healthStatus: 'billing' as const },
      { name: 'Alba', surname: 'W', healthStatus: 'attention' as const },
      { name: 'Dani', surname: 'V', healthStatus: 'streak' as const },
    ]
    expect(sortByAttention(list).map(c => c.name)).toEqual(['Alba', 'Beto', 'Carla', 'Ana', 'Dani'])
  })

  it('does not mutate the input', () => {
    const list = [{ name: 'B', surname: '', healthStatus: 'active' as const }, { name: 'A', surname: '', healthStatus: 'attention' as const }]
    sortByAttention(list)
    expect(list[0].name).toBe('B')
  })
})

describe('formatKg / formatWeightDelta', () => {
  it('formats with a decimal comma and one decimal', () => {
    expect(formatKg(68.4)).toBe('68,4')
    expect(formatKg(70)).toBe('70,0')
  })
  it('shows direction arrows with the absolute value', () => {
    expect(formatWeightDelta(-0.6)).toBe('↓ 0,6 kg')
    expect(formatWeightDelta(1.5)).toBe('↑ 1,5 kg')
    expect(formatWeightDelta(0)).toBe('= 0,0 kg')
  })
  it('says there is no variation when there is no data', () => {
    expect(formatWeightDelta(null)).toBe('sin variación')
    expect(formatWeightDelta(undefined)).toBe('sin variación')
  })
})
