import { describe, it, expect } from 'vitest'
import { parseTags, filterRecipes, allTags, mealTypeLabel, safeVideoUrl, parsePrepMinutes } from './recipeMeta'

const recipes = [
  { name: 'Tortilla de patata', meal_type: 'cena', tags: ['rápida', 'sin horno'] },
  { name: 'Bowl de avena', meal_type: 'desayuno', tags: ['rápida'] },
  { name: 'Lentejas estofadas', meal_type: 'comida', tags: ['batch cooking'] },
  { name: 'Sin clasificar', meal_type: null, tags: [] },
]

describe('parseTags', () => {
  it('splits, trims, lowercases and drops repeats and empties', () => {
    expect(parseTags(' Rápida, sin  horno ,RÁPIDA,, Batch cooking ')).toEqual(['rápida', 'sin horno', 'batch cooking'])
  })
  it('accepts semicolons and new lines, and caps the number and length of tags', () => {
    expect(parseTags('a;b\nc')).toEqual(['a', 'b', 'c'])
    expect(parseTags(Array.from({ length: 12 }, (_, i) => `t${i}`).join(','))).toHaveLength(8)
    expect(parseTags('x'.repeat(50))[0]).toHaveLength(30)
  })
})

describe('filterRecipes', () => {
  it('filters by meal type', () => {
    expect(filterRecipes(recipes, { mealType: 'desayuno' }).map(r => r.name)).toEqual(['Bowl de avena'])
  })
  it('filters by tag', () => {
    expect(filterRecipes(recipes, { tag: 'rápida' })).toHaveLength(2)
  })
  it('searches the name and the tags, ignoring case and accents', () => {
    expect(filterRecipes(recipes, { query: 'LENTEJAS' })).toHaveLength(1)
    expect(filterRecipes(recipes, { query: 'rapida' })).toHaveLength(2)
    expect(filterRecipes(recipes, { query: 'batch' })).toHaveLength(1)
  })
  it('combines the filters and returns everything with none', () => {
    expect(filterRecipes(recipes, { tag: 'rápida', mealType: 'cena' }).map(r => r.name)).toEqual(['Tortilla de patata'])
    expect(filterRecipes(recipes, {})).toHaveLength(4)
  })
  it('copes with recipes that have no tags field at all (old rows, demo data)', () => {
    expect(filterRecipes([{ name: 'Vieja' }], { query: 'vie' })).toHaveLength(1)
    expect(filterRecipes([{ name: 'Vieja' }], { tag: 'x' })).toHaveLength(0)
  })
})

describe('allTags / mealTypeLabel', () => {
  it('lists tags by frequency', () => {
    expect(allTags(recipes)).toEqual(['rápida', 'batch cooking', 'sin horno'])
  })
  it('labels meal types and tolerates unknown ones', () => {
    expect(mealTypeLabel('cena')).toBe('Cena')
    expect(mealTypeLabel(null)).toBe('')
    expect(mealTypeLabel('otra')).toBe('')
  })
})

describe('filtering by diet type', () => {
  const diet = [
    { name: 'Curry de garbanzos', diet_types: ['vegana', 'sin lactosa'] },
    { name: 'Pollo asado', diet_types: ['sin gluten'] },
    { name: 'Vieja' },
  ]
  it('keeps only the recipes that carry that diet type', () => {
    expect(filterRecipes(diet, { dietType: 'vegana' }).map(r => r.name)).toEqual(['Curry de garbanzos'])
    expect(filterRecipes(diet, { dietType: 'sin gluten' }).map(r => r.name)).toEqual(['Pollo asado'])
    expect(filterRecipes(diet, { dietType: 'vegetariana' })).toHaveLength(0)
  })
})

describe('safeVideoUrl', () => {
  it('accepts https links to YouTube and Vimeo', () => {
    expect(safeVideoUrl('https://www.youtube.com/watch?v=abc123')).toBe('https://www.youtube.com/watch?v=abc123')
    expect(safeVideoUrl('https://youtu.be/abc123')).toBe('https://youtu.be/abc123')
    expect(safeVideoUrl(' https://vimeo.com/12345 ')).toBe('https://vimeo.com/12345')
  })
  it('rejects anything else: other sites, plain http, scripts, junk and empty', () => {
    expect(safeVideoUrl('https://evil.example.com/video')).toBeNull()
    expect(safeVideoUrl('http://youtube.com/watch?v=1')).toBeNull()
    expect(safeVideoUrl('javascript:alert(1)')).toBeNull()
    expect(safeVideoUrl('https://youtube.com.evil.com/x')).toBeNull()
    expect(safeVideoUrl('no es un enlace')).toBeNull()
    expect(safeVideoUrl('')).toBeNull()
    expect(safeVideoUrl(null)).toBeNull()
  })
})

describe('parsePrepMinutes', () => {
  it('accepts whole minutes in a sensible range and rejects the rest', () => {
    expect(parsePrepMinutes('25')).toBe(25)
    expect(parsePrepMinutes(' 90 ')).toBe(90)
    expect(parsePrepMinutes('0')).toBeNull()
    expect(parsePrepMinutes('-5')).toBeNull()
    expect(parsePrepMinutes('2000')).toBeNull()
    expect(parsePrepMinutes('')).toBeNull()
    expect(parsePrepMinutes('rápido')).toBeNull()
  })
})
