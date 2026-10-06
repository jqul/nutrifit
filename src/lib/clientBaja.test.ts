import { describe, it, expect } from 'vitest'
import { BAJA_REASONS, bajaReasonLabel, churnMetrics, formatTenure, isBajaReason, isDeBaja } from './clientBaja'

const TODAY = new Date(2026, 9, 15, 12)   // 15 oct 2026
const DAY = 86400000
const ago = (days: number) => TODAY.getTime() - days * DAY
const baja = (daysAgoLeft: number, over: Record<string, unknown> = {}) => ({
  createdAt: ago(daysAgoLeft + 120), monthlyPrice: 50 as number | null, bajaAt: ago(daysAgoLeft) as number | null, bajaReason: 'precio' as string | null, ...over,
})

describe('motivos', () => {
  it('knows its reasons and labels them', () => {
    expect(BAJA_REASONS.map(r => r.id)).toEqual(['objetivo_logrado', 'precio', 'resultados', 'falta_tiempo', 'otro'])
    expect(bajaReasonLabel('resultados')).toBe('No veía resultados')
    expect(bajaReasonLabel(null)).toBe('Sin motivo')
    expect(bajaReasonLabel('algo raro')).toBe('Sin motivo')
    expect(isBajaReason('precio')).toBe(true)
    expect(isBajaReason('toString')).toBe(false)
  })

  it('tells a client who left from one who is active', () => {
    expect(isDeBaja({ bajaAt: ago(3) })).toBe(true)
    expect(isDeBaja({ bajaAt: null })).toBe(false)
    expect(isDeBaja({})).toBe(false)
  })
})

describe('churnMetrics', () => {
  it('has nothing to report when nobody left', () => {
    const m = churnMetrics([], 10, TODAY)
    expect(m).toMatchObject({ bajas: 0, bajasThisMonth: 0, churnPct: 0, lostMonthly: 0, avgTenureDays: null, byReason: [] })
  })

  it('has no percentage when there are no clients at all', () => {
    expect(churnMetrics([], 0, TODAY).churnPct).toBeNull()
  })

  it('counts only the bajas inside the window', () => {
    const m = churnMetrics([baja(10), baja(80), baja(120), baja(400)], 6, TODAY)
    expect(m.bajas).toBe(2)
    // 2 de los 8 clientes que has tenido en la ventana (6 activos + 2 bajas)
    expect(m.churnPct).toBe(25)
  })

  it('adds up the monthly fees lost, ignoring clients without a price', () => {
    const m = churnMetrics([baja(5, { monthlyPrice: 60 }), baja(9, { monthlyPrice: 40 }), baja(12, { monthlyPrice: null })], 5, TODAY)
    expect(m.lostMonthly).toBe(100)
  })

  it('averages how long they stayed', () => {
    const m = churnMetrics([baja(5, { createdAt: ago(5 + 100) }), baja(9, { createdAt: ago(9 + 50) })], 5, TODAY)
    expect(m.avgTenureDays).toBe(75)
  })

  it('counts the calendar month separately from the window', () => {
    const m = churnMetrics([baja(2), baja(10), baja(30)], 5, TODAY)   // 13 oct, 5 oct y 15 sept
    expect(m.bajasThisMonth).toBe(2)
    expect(m.bajas).toBe(3)
  })

  it('ranks the reasons, grouping missing or unknown ones as "sin motivo"', () => {
    const m = churnMetrics([
      baja(5, { bajaReason: 'precio' }), baja(6, { bajaReason: 'precio' }), baja(7, { bajaReason: 'resultados' }),
      baja(8, { bajaReason: null }), baja(9, { bajaReason: 'inventado' }),
    ], 5, TODAY)
    expect(m.byReason.map(r => [r.label, r.count])).toEqual([['Precio', 2], ['Sin motivo', 2], ['No veía resultados', 1]])
  })

  it('ignores a baja date in the future (a clock or data glitch)', () => {
    expect(churnMetrics([baja(-3)], 4, TODAY).bajas).toBe(0)
  })

  it('supports another window', () => {
    expect(churnMetrics([baja(10), baja(40)], 5, TODAY, 30).bajas).toBe(1)
  })
})

describe('formatTenure', () => {
  it('writes it in the unit that reads best', () => {
    expect(formatTenure(1)).toBe('1 día')
    expect(formatTenure(9)).toBe('9 días')
    expect(formatTenure(35)).toBe('5 semanas')
    expect(formatTenure(100)).toBe('3 meses')
  })
})
