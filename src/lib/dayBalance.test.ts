import { describe, expect, it } from 'vitest'
import { balanceByDay, balanceOfDay, balanceStatus, dayOfWeekOf, mealMacros, plannedColumns, plannedMealsOn, plannedOf } from './dayBalance'
import { scannedExtrasOf } from './scannedLogs'
import { scannedFoodNote } from './openFoodFacts'
import type { DietMeal, MealLog } from '../types'

const item = (kcal: number | null, p: number | null = 0, c: number | null = 0, f: number | null = 0) =>
  ({ id: 'i', foodName: 'x', quantity: '1', unit: 'g', kcal, proteinG: p, carbsG: c, fatG: f })
const meal = (name: string, items: ReturnType<typeof item>[], dayOfWeek: number | null = null, id = name): DietMeal =>
  ({ id, name, time: '08:00', kcalTarget: null, dayOfWeek: dayOfWeek as DietMeal['dayOfWeek'], items })
const log = (mealName: string, date: string, note = '', id = mealName + date): MealLog =>
  ({ id, clientId: 'c', date, mealName, photoUrl: null, note, createdAt: 0 })
const food = { name: 'Galletas', kcal: 480, proteinG: 6.5, carbsG: 70, fatG: 18.2 } as Parameters<typeof scannedFoodNote>[0]

// 2026-10-07 es miércoles (índice 2)
const WED = '2026-10-07'

describe('mealMacros', () => {
  it('adds the items and treats missing data as 0', () => {
    expect(mealMacros(meal('Desayuno', [item(200, 10, 20, 5), item(null, null, null, null), item(150.4, 2.25, 30, 1)])))
      .toEqual({ kcal: 350, proteinG: 12.3, carbsG: 50, fatG: 6 })
  })
})

describe('dayOfWeekOf', () => {
  it('is 0 for Monday and 6 for Sunday', () => {
    expect(dayOfWeekOf('2026-10-05')).toBe(0)
    expect(dayOfWeekOf(WED)).toBe(2)
    expect(dayOfWeekOf('2026-10-11')).toBe(6)
  })
})

describe('plannedOf / plannedColumns', () => {
  const m = { ...meal('Comida', [item(300, 20, 30, 8), item(100, 5, 10, 2)]), optionLabel: 'Opción B' }
  it('keeps the chosen option and what it contributed', () => {
    expect(plannedOf(m)).toEqual({ optionLabel: 'Opción B', planned: { kcal: 400, proteinG: 25, carbsG: 40, fatG: 10 } })
  })
  it('uses the column names of meal_logs', () => {
    expect(plannedColumns(m)).toEqual({ option_label: 'Opción B', planned_kcal: 400, planned_protein_g: 25, planned_carbs_g: 40, planned_fat_g: 10 })
  })
  it('has no label for a fixed meal', () => expect(plannedOf(meal('Cena', [item(500)])).optionLabel).toBeNull())
})

describe('plannedMealsOn', () => {
  const plan = [meal('Desayuno', [item(300)]), meal('Comida', [item(700)], 0, 'comida-lun'), meal('Comida', [item(650)], 2, 'comida-mie')]
  it('estimates an old log with the meal of the plan that applies to that weekday', () => {
    expect(plannedMealsOn(plan, [log('Comida', WED)], WED).map(x => x.kcal)).toEqual([650])
  })
  it('uses what the client chose when the log carries it, even if the plan has changed since', () => {
    const chosen = { ...log('Comida', WED), optionLabel: 'Opción C', planned: { kcal: 480, proteinG: 30, carbsG: 40, fatG: 12 } }
    expect(plannedMealsOn(plan, [chosen], WED).map(x => x.kcal)).toEqual([480])
  })
  it('counts a meal once and ignores other days, scanned products and unknown names', () => {
    const logs = [log('Desayuno', WED, '', 'a'), log('Desayuno', WED, '', 'b'), log('Desayuno', '2026-10-06'), log('Galletas', WED)]
    expect(plannedMealsOn(plan, logs, WED).map(x => x.kcal)).toEqual([300])
  })
})

describe('balanceOfDay', () => {
  it('adds plan meals and scanned extras against the target', () => {
    const extras = scannedExtrasOf([log('Galletas', WED, scannedFoodNote(food, 25))])
    const b = balanceOfDay(WED, [mealMacros(meal('Desayuno', [item(400, 20, 40, 10)]))], extras, 2000)
    expect(b.plan.kcal).toBe(400)
    expect(b.extras.kcal).toBe(120)
    expect(b.total).toEqual({ kcal: 520, proteinG: 21.6, carbsG: 57.5, fatG: 14.6 })
    expect(b.pctOfTarget).toBe(26)
    expect(b.doneMeals).toBe(1)
    expect(b.extrasCount).toBe(1)
  })
  it('has no percentage without a target', () => {
    expect(balanceOfDay(WED, [], [], null).pctOfTarget).toBeNull()
  })
})

describe('balanceByDay', () => {
  const plan = [meal('Desayuno', [item(300)]), meal('Cena', [item(500)])]
  const logs = [
    log('Desayuno', WED), log('Cena', WED), log('Galletas', WED, scannedFoodNote(food, 50)),
    log('Desayuno', '2026-10-05'), log('Nota suelta', '2026-10-06'), log('Desayuno', '2026-09-01'),
  ]
  it('lists the days with something logged, newest first, from the given date', () => {
    const days = balanceByDay(plan, 1800, logs, '2026-10-01')
    expect(days.map(d => d.date)).toEqual([WED, '2026-10-05'])
    expect(days[0].total.kcal).toBe(300 + 500 + 240)
    expect(days[0].pctOfTarget).toBe(58)
  })
  it('is empty when nothing is logged in the period', () => expect(balanceByDay(plan, 1800, logs, '2026-11-01')).toEqual([]))
})

describe('balanceStatus', () => {
  it('is within the target between 90% and 105%', () => {
    expect(balanceStatus(1800, 2000)).toEqual({ tone: 'ok', text: 'Dentro del objetivo' })
    expect(balanceStatus(2100, 2000).tone).toBe('ok')
  })
  it('says how many kcal are missing or over', () => {
    expect(balanceStatus(1620, 2000)).toEqual({ tone: 'low', text: 'Te faltan 380 kcal para el objetivo' })
    expect(balanceStatus(2250, 2000)).toEqual({ tone: 'high', text: 'Te pasas 250 kcal del objetivo' })
  })
})
