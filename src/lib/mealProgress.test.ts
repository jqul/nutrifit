import { describe, it, expect } from 'vitest'
import { MealLog } from '../types'
import { publishMealLogs, subscribeMealLogs, getMealLogsSnapshot, mealLogsOf, isMealDone, countMealsDone, macroEnergySplit } from './mealProgress'

const log = (mealName: string): MealLog => ({ id: mealName, clientId: 'c1', date: '2026-10-04', mealName, photoUrl: null, note: '', createdAt: 0 })

describe('isMealDone / countMealsDone', () => {
  const logs = [log('Desayuno'), log('Comida')]
  it('matches meals by name', () => {
    expect(isMealDone('Desayuno', logs)).toBe(true)
    expect(isMealDone('Cena', logs)).toBe(false)
  })
  it('counts only the planned meals that have a log', () => {
    expect(countMealsDone(['Desayuno', 'Comida', 'Cena'], logs)).toBe(2)
    expect(countMealsDone(['Cena'], logs)).toBe(0)
    expect(countMealsDone([], logs)).toBe(0)
  })
})

describe('meal logs store', () => {
  it('notifies subscribers and exposes the logs of the published client only', () => {
    let calls = 0
    const off = subscribeMealLogs(() => { calls++ })
    publishMealLogs('c1', [log('Desayuno')])
    expect(calls).toBe(1)
    expect(mealLogsOf(getMealLogsSnapshot(), 'c1')).toHaveLength(1)
    expect(mealLogsOf(getMealLogsSnapshot(), 'otro')).toEqual([])
    off()
    publishMealLogs('c1', [])
    expect(calls).toBe(1)
  })
})

describe('macroEnergySplit', () => {
  it('splits energy by 4/4/9 kcal per gram and always sums 100', () => {
    // 150 P (600) + 250 C (1000) + 70 F (630) = 2230 kcal
    const s = macroEnergySplit(150, 250, 70)!
    expect(s).toEqual({ proteinPct: 27, carbsPct: 45, fatPct: 28 })
    expect(s.proteinPct + s.carbsPct + s.fatPct).toBe(100)
  })
  it('returns null when there is no energy to split', () => {
    expect(macroEnergySplit(0, 0, 0)).toBeNull()
    expect(macroEnergySplit(NaN, 0, 0)).toBeNull()
  })
  it('handles a single macro', () => {
    expect(macroEnergySplit(100, 0, 0)).toEqual({ proteinPct: 100, carbsPct: 0, fatPct: 0 })
  })
})
