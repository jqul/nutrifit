import { describe, it, expect } from 'vitest'
import { Food } from '../types'
import { blankFoodDraft, draftToColumns, foodToDraft, normalizeFoodName, parseNum, validateFoodDraft, FoodDraft } from './foodDraft'

const catalog = [{ id: 's1', name: 'Pechuga de pollo' }, { id: 's2', name: 'Plátano' }, { id: 'm1', name: 'Mi bizcocho' }]
const good = (over: Partial<FoodDraft> = {}): FoodDraft => ({
  ...blankFoodDraft('Hummus casero'), category: 'Legumbre', kcal: '230', proteinG: '8', carbsG: '14', fatG: '17', ...over,
})
const check = (over: Partial<FoodDraft> = {}, editingId: string | null = null) => validateFoodDraft(good(over), catalog, editingId)

describe('parseNum', () => {
  it('accepts comma and dot decimals, and rejects blanks and junk', () => {
    expect(parseNum('1,5')).toBe(1.5)
    expect(parseNum(' 2.25 ')).toBe(2.25)
    expect(parseNum('0')).toBe(0)
    expect(parseNum('')).toBeNull()
    expect(parseNum('abc')).toBeNull()
    expect(parseNum('Infinity')).toBeNull()
  })
})

describe('validateFoodDraft — nombre', () => {
  it('accepts a normal food with no warnings', () => {
    expect(check()).toEqual({ errors: [], warnings: [] })
  })

  it('needs a name', () => {
    expect(check({ name: '   ' }).errors).toContain('Ponle un nombre al alimento.')
  })

  it('refuses a name that already exists, ignoring case, accents and spaces', () => {
    for (const name of ['pechuga de pollo', 'PLATANO', ' Plátano  ', 'Pechuga  de   pollo']) {
      expect(check({ name }).errors.join(' ')).toContain('Ya existe un alimento llamado')
    }
  })

  it('lets you keep your own name when editing, but not take someone else\'s', () => {
    expect(check({ name: 'Mi bizcocho' }, 'm1').errors).toEqual([])
    expect(check({ name: 'Plátano' }, 'm1').errors.join(' ')).toContain('Ya existe')
  })

  it('refuses a name that is too long', () => {
    expect(check({ name: 'x'.repeat(101) }).errors.join(' ')).toContain('demasiado largo')
  })
})

describe('validateFoodDraft — valores', () => {
  it('requires kcal and the three macros, but accepts 0 (water, oil…)', () => {
    expect(check({ kcal: '' }).errors).toContain('Kcal: obligatorio (pon 0 si no tiene).')
    expect(check({ fatG: '' }).errors).toContain('Grasa: obligatorio (pon 0 si no tiene).')
    expect(check({ kcal: '0', proteinG: '0', carbsG: '0', fatG: '0' }).errors).toEqual([])
  })

  it('rejects negatives and non-numbers', () => {
    expect(check({ proteinG: '-3' }).errors).toContain('Proteína: no puede ser negativo.')
    expect(check({ carbsG: 'mucho' }).errors).toContain('Carbohidratos: obligatorio (pon 0 si no tiene).')
  })

  it('rejects impossible values per 100 g', () => {
    expect(check({ kcal: '5000' }).errors.join(' ')).toContain('máximo 950 kcal')
    expect(check({ proteinG: '150', carbsG: '0', fatG: '0' }).errors.join(' ')).toContain('máximo 100 g')
  })

  it('rejects macros that add up to more than 100 g in 100 g of food', () => {
    expect(check({ proteinG: '50', carbsG: '40', fatG: '30', kcal: '600' }).errors.join(' ')).toContain('no pueden sumar más de 100 g')
  })

  it('accepts decimal commas', () => {
    expect(check({ proteinG: '8,5', carbsG: '13,5' }).errors).toEqual([])
  })

  it('validates optional fields only when filled', () => {
    expect(check({ fiberG: '', sodiumMg: '' }).errors).toEqual([])
    expect(check({ sodiumMg: '-1' }).errors.join(' ')).toContain('Sodio')
    expect(check({ calciumMg: 'x' }).errors.join(' ')).toContain('Calcio')
  })

  it('warns, without blocking, when kcal do not match the macros', () => {
    const r = check({ kcal: '600' })   // los macros suman ~217
    expect(r.errors).toEqual([])
    expect(r.warnings.join(' ')).toContain('no cuadran')
  })

  it('does not warn for rounding-sized differences or for high-fibre/alcohol-free normal foods', () => {
    expect(check({ kcal: '215' }).warnings).toEqual([])   // 8*4+14*4+17*9 = 241: dentro del margen
  })

  it('warns when sugars, fibre or saturated fat exceed their parent total', () => {
    expect(check({ sugarG: '20' }).warnings.join(' ')).toContain('azúcares')
    expect(check({ fiberG: '20' }).warnings.join(' ')).toContain('fibra')
    expect(check({ saturatedFatG: '30' }).warnings.join(' ')).toContain('saturadas')
  })

  it('does not stack warnings on top of errors', () => {
    expect(check({ proteinG: '', sugarG: '99' }).warnings).toEqual([])
  })
})

describe('draftToColumns / foodToDraft', () => {
  it('turns the draft into table columns, with nulls for blank optionals', () => {
    const c = draftToColumns(good({ name: '  Hummus   casero ', fiberG: '6,5' }))
    expect(c).toMatchObject({ name: 'Hummus casero', category: 'Legumbre', kcal: 230, protein_g: 8, carbs_g: 14, fat_g: 17, fiber_g: 6.5, sugar_g: null, zinc_mg: null })
  })

  it('round-trips a food through the form', () => {
    const food: Food = { id: 'x', name: 'Hummus', category: 'Legumbre', kcal: 230, proteinG: 8, carbsG: 14, fatG: 17, fiberG: 6, sugarG: null, sodiumMg: 300, nutricionistaId: 'n' }
    const d = foodToDraft(food)
    expect(d.fiberG).toBe('6')
    expect(d.sugarG).toBe('')
    const c = draftToColumns(d)
    expect(c).toMatchObject({ name: 'Hummus', kcal: 230, fiber_g: 6, sugar_g: null, sodium_mg: 300 })
  })
})

describe('normalizeFoodName', () => {
  it('ignores case, accents and repeated spaces', () => {
    expect(normalizeFoodName('  PLÁTANO  maduro ')).toBe('platano maduro')
  })
})
