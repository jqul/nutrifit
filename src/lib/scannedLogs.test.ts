import { describe, expect, it } from 'vitest'
import { parseScannedLog, scannedExtrasOf, sumExtras } from './scannedLogs'
import { scannedFoodNote } from './openFoodFacts'
import type { MealLog } from '../types'

const food = { name: 'Galletas', kcal: 480, proteinG: 6.5, carbsG: 70, fatG: 18.2 } as Parameters<typeof scannedFoodNote>[0]
const log = (note: string, id = '1'): MealLog => ({ id, clientId: 'c', date: '2026-10-07', mealName: 'x', photoUrl: null, note, createdAt: 0 })

describe('parseScannedLog', () => {
  it('reads back what scannedFoodNote writes', () => {
    const info = parseScannedLog(log(scannedFoodNote(food, 25)))
    expect(info).toEqual({ grams: 25, kcal: 120, proteinG: 1.6, carbsG: 17.5, fatG: 4.6 })
  })
  it('understands decimals written with a comma', () => {
    expect(parseScannedLog(log(scannedFoodNote(food, 12.5)))?.grams).toBe(12.5)
  })
  it('ignores ordinary meal logs and empty notes', () => {
    for (const note of ['', 'Comí fuera', '100 g · 200 kcal', 'Pollo con arroz (producto escaneado)']) expect(parseScannedLog(log(note)), note).toBeNull()
  })
})

describe('extras of today', () => {
  const logs = [log(scannedFoodNote(food, 25), 'a'), log('Cena normal', 'b'), log(scannedFoodNote(food, 50), 'c')]
  it('keeps only scanned products', () => expect(scannedExtrasOf(logs).map(e => e.log.id)).toEqual(['a', 'c']))
  it('adds them up', () => {
    expect(sumExtras(scannedExtrasOf(logs))).toEqual({ kcal: 360, proteinG: 4.9, carbsG: 52.5, fatG: 13.7 })
  })
  it('is zero without extras', () => expect(sumExtras([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }))
})
