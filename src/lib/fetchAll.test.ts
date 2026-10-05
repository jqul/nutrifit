import { describe, it, expect } from 'vitest'
import { WeightEntry } from '../types'
import { fetchAllRows, fetchAllRowsForIds } from './fetchAll'
import { ActivitySummary, latestDate, weightsWithBounds } from './activitySummary'

/** Una tabla falsa que, como PostgREST, devuelve como mucho `cap` filas por petición. */
function table<T>(rows: T[], cap = 1000) {
  const calls: [number, number][] = []
  const page = async (from: number, to: number) => {
    calls.push([from, to])
    return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null }
  }
  return { page, calls }
}
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }))

describe('fetchAllRows', () => {
  it('returns every row even when there are far more than one page', async () => {
    const t = table(rows(2500))
    const all = await fetchAllRows(t.page)
    expect(all).toHaveLength(2500)
    expect(all[0]).toEqual({ id: 0 })
    expect(all[2499]).toEqual({ id: 2499 })
    expect(t.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('does not drop or repeat rows at page boundaries', async () => {
    const all = await fetchAllRows(table(rows(2000)).page)
    expect(all.map(r => r.id)).toEqual(rows(2000).map(r => r.id))
  })

  it('stops after one request when everything fits in a page', async () => {
    const t = table(rows(10))
    expect(await fetchAllRows(t.page)).toHaveLength(10)
    expect(t.calls).toHaveLength(1)
  })

  it('handles an empty table and null data', async () => {
    expect(await fetchAllRows(async () => ({ data: [], error: null }))).toEqual([])
    expect(await fetchAllRows(async () => ({ data: null, error: null }))).toEqual([])
  })

  it('throws the database error instead of returning partial data', async () => {
    let n = 0
    const failing = async () => (++n === 2 ? { data: null, error: { message: 'timeout' } } : { data: rows(3), error: null })
    await expect(fetchAllRows(failing, 3)).rejects.toThrow('timeout')
  })

  it('shows the bug it prevents: a single unpaged request would silently return only the cap', async () => {
    const t = table(rows(2500))
    const naive = await t.page(0, 9999)
    expect(naive).toHaveProperty('data')
    expect(naive.data).toHaveLength(1000)   // lo que devolvía "select * ..." sin paginar
    expect(await fetchAllRows(t.page)).toHaveLength(2500)
  })
})

describe('fetchAllRowsForIds', () => {
  it('splits long id lists and concatenates the results', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `c${i}`)
    const seen: string[][] = []
    const all = await fetchAllRowsForIds(ids, async (chunk) => { seen.push(chunk); return { data: chunk.map(id => ({ id })), error: null } })
    expect(seen.map(c => c.length)).toEqual([50, 50, 20])
    expect(all).toHaveLength(120)
  })

  it('pages inside each chunk', async () => {
    const ids = ['a', 'b']
    const all = await fetchAllRowsForIds(ids, async (chunk, from, to) => {
      const data = rows(5).filter(r => r.id >= from && r.id <= to).map(r => ({ id: `${chunk.join('')}-${r.id}` }))
      return { data, error: null }
    }, 2, 1)
    expect(all).toHaveLength(10)   // 5 filas por id, páginas de 2
  })

  it('returns nothing for no ids', async () => {
    expect(await fetchAllRowsForIds([], async () => ({ data: [{ id: 1 }], error: null }))).toEqual([])
  })
})

const w = (date: string, weightKg: number): WeightEntry => ({ id: date, clientId: 'c', date, weightKg, note: '' })
const summary = (over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  client_id: 'c', last_checkin: '2026-10-01', last_weigh_in: '2026-09-20', first_weigh_in: '2026-01-10', first_weight_kg: '90.5', last_weight_kg: 82.5, ...over,
})

describe('weightsWithBounds', () => {
  it('adds the first and last weigh-ins when they fall outside the window', () => {
    const out = weightsWithBounds('c', [w('2026-09-05', 84), w('2026-09-12', 83)], summary())
    expect(out.map(x => `${x.date}:${x.weightKg}`)).toEqual(['2026-01-10:90.5', '2026-09-05:84', '2026-09-12:83', '2026-09-20:82.5'])
  })

  it('does not duplicate a bound that is already in the window', () => {
    const out = weightsWithBounds('c', [w('2026-09-20', 82.5)], summary({ first_weigh_in: '2026-09-20', first_weight_kg: 82.5 }))
    expect(out).toHaveLength(1)
  })

  it('keeps a client that has not weighed in for months visible (nothing in the window)', () => {
    const out = weightsWithBounds('c', [], summary({ last_weigh_in: '2026-03-01', last_weight_kg: 88 }))
    expect(out.map(x => x.date)).toEqual(['2026-01-10', '2026-03-01'])
  })

  it('returns just the window when there is no summary or no weigh-ins at all', () => {
    expect(weightsWithBounds('c', [w('2026-09-05', 84)], undefined)).toHaveLength(1)
    expect(weightsWithBounds('c', [], summary({ first_weigh_in: null, first_weight_kg: null, last_weigh_in: null, last_weight_kg: null }))).toEqual([])
  })

  it('does not mutate the window it was given', () => {
    const win = [w('2026-09-05', 84)]
    weightsWithBounds('c', win, summary())
    expect(win).toHaveLength(1)
  })
})

describe('latestDate', () => {
  it('picks the most recent date, ignoring missing ones', () => {
    expect(latestDate('2026-09-01', '2026-10-01')).toBe('2026-10-01')
    expect(latestDate(undefined, '2026-10-01')).toBe('2026-10-01')
    expect(latestDate('2026-09-01', null)).toBe('2026-09-01')
    expect(latestDate(undefined, null)).toBeUndefined()
  })
})
