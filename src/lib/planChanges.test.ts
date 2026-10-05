import { describe, it, expect } from 'vitest'
import { diffPlanTargets, formatPlanChange, targetsFromForm, PlanTargets } from './planChanges'

const base: PlanTargets = { kcal_target: 2100, protein_g: 150, carbs_g: 220, fat_g: 70, fiber_g: 28, advice: 'Bebe agua' }

describe('diffPlanTargets', () => {
  it('lists only what changed, from → to', () => {
    const d = diffPlanTargets(base, { ...base, kcal_target: 1950, protein_g: 155 })
    expect(d).toEqual([
      { field: 'kcal_target', from: 2100, to: 1950 },
      { field: 'protein_g', from: 150, to: 155 },
    ])
  })

  it('detects an advice change', () => {
    expect(diffPlanTargets(base, { ...base, advice: 'Otro' })).toEqual([{ field: 'advice', from: 'Bebe agua', to: 'Otro' }])
  })

  it('returns nothing when nothing changed', () => {
    expect(diffPlanTargets(base, { ...base })).toEqual([])
  })

  it('does not count the first definition of an empty plan as a change', () => {
    const empty: PlanTargets = { kcal_target: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, advice: '' }
    expect(diffPlanTargets(empty, base)).toEqual([])
  })

  it('has nothing to compare against when there is no saved plan', () => {
    expect(diffPlanTargets(null, base)).toEqual([])
  })
})

describe('formatPlanChange', () => {
  it('shows kcal without a unit and macros in grams', () => {
    expect(formatPlanChange({ field: 'kcal_target', from: 2100, to: 1950 })).toBe('Kcal: 2100 → 1950')
    expect(formatPlanChange({ field: 'protein_g', from: 150, to: 155 })).toBe('Proteína: 150 → 155 g')
    expect(formatPlanChange({ field: 'fat_g', from: 70, to: 62.5 })).toBe('Grasas: 70 → 62,5 g')
  })
  it('does not dump the advice text', () => {
    expect(formatPlanChange({ field: 'advice', from: 'a', to: 'b' })).toBe('Consejo modificado')
  })
})

describe('targetsFromForm', () => {
  it('parses the text fields like the save does, with 0 for blanks', () => {
    expect(targetsFromForm({ kcal: '1950', protein: '', carbs: 'abc', fat: '70.5', fiber: '28', advice: 'x' }))
      .toEqual({ kcal_target: 1950, protein_g: 0, carbs_g: 0, fat_g: 70.5, fiber_g: 28, advice: 'x' })
  })
})
