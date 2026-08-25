import { describe, it, expect } from 'vitest'
import { groupMealsByOption, mealsForDay, resolveTodaysMeals } from './planMeals'
import { DietMeal } from '../types'

function meal(overrides: Partial<DietMeal> & { id: string }): DietMeal {
  return { name: 'Comida', time: '13:00', kcalTarget: null, items: [], ...overrides }
}

describe('groupMealsByOption', () => {
  it('treats meals without optionGroup as singleton groups', () => {
    const meals = [meal({ id: 'a' }), meal({ id: 'b' })]
    expect(groupMealsByOption(meals)).toEqual([[meals[0]], [meals[1]]])
  })

  it('groups meals sharing an optionGroup together, in order of first appearance', () => {
    const a = meal({ id: 'a', optionGroup: 'g1' })
    const b = meal({ id: 'b' })
    const c = meal({ id: 'c', optionGroup: 'g1' })
    expect(groupMealsByOption([a, b, c])).toEqual([[a, c], [b]])
  })
})

describe('mealsForDay', () => {
  const monday = meal({ id: 'mon', dayOfWeek: 0 })
  const everyDay = meal({ id: 'every', dayOfWeek: null })
  const onDay = meal({ id: 'on', dayType: 'on' })
  const offDay = meal({ id: 'off', dayType: 'off' })

  it('includes meals with a matching dayOfWeek and meals with none', () => {
    const result = mealsForDay([monday, everyDay], 0, 'on')
    expect(result.map(m => m.id)).toEqual(['mon', 'every'])
  })

  it('excludes meals assigned to a different dayOfWeek', () => {
    const result = mealsForDay([monday, everyDay], 2, 'on')
    expect(result.map(m => m.id)).toEqual(['every'])
  })

  it('filters by dayType, keeping type-less meals regardless of selection', () => {
    expect(mealsForDay([onDay, offDay, everyDay], 0, 'on').map(m => m.id)).toEqual(['on', 'every'])
    expect(mealsForDay([onDay, offDay, everyDay], 0, 'off').map(m => m.id)).toEqual(['off', 'every'])
  })
})

describe('resolveTodaysMeals', () => {
  it('picks the chosen option within a group, defaulting to the first when unchosen', () => {
    const a = meal({ id: 'a', optionGroup: 'g1' })
    const b = meal({ id: 'b', optionGroup: 'g1' })
    expect(resolveTodaysMeals([a, b], 0, 'on', {}).map(m => m.id)).toEqual(['a'])
    expect(resolveTodaysMeals([a, b], 0, 'on', { g1: 'b' }).map(m => m.id)).toEqual(['b'])
  })

  it('composes day-of-week, day-type, and option-group filtering together', () => {
    const monOn = meal({ id: 'monOn', dayOfWeek: 0, dayType: 'on' })
    const monOff = meal({ id: 'monOff', dayOfWeek: 0, dayType: 'off' })
    const tue = meal({ id: 'tue', dayOfWeek: 1 })
    const always = meal({ id: 'always' })
    const result = resolveTodaysMeals([monOn, monOff, tue, always], 0, 'off', {})
    expect(result.map(m => m.id).sort()).toEqual(['always', 'monOff'])
  })
})
