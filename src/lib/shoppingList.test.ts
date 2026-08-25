import { describe, it, expect } from 'vitest'
import { groupShoppingItemsByAisle, ShoppingItem } from './shoppingList'

function item(foodName: string): ShoppingItem {
  return { key: foodName.toLowerCase(), foodName, unit: 'g', totalQty: 100, parts: ['100'], fiberG: 0 }
}

describe('groupShoppingItemsByAisle', () => {
  const foods = [
    { name: 'Manzana', category: 'Fruta' },
    { name: 'Pechuga de pollo', category: 'Proteína' },
    { name: 'Yogur natural', category: 'Lácteo' },
  ]

  it('groups items by the aisle mapped from their food category', () => {
    const aisles = groupShoppingItemsByAisle([item('Manzana'), item('Pechuga de pollo'), item('Yogur natural')], foods)
    expect(aisles.map(a => a.label)).toEqual(['Frutas y verduras', 'Carnes y pescados', 'Lácteos'])
    expect(aisles[0].items.map(i => i.foodName)).toEqual(['Manzana'])
  })

  it('matches food names case-insensitively', () => {
    const aisles = groupShoppingItemsByAisle([item('manzana')], foods)
    expect(aisles[0].label).toBe('Frutas y verduras')
  })

  it('falls back to "Otros" for ingredients not found in the catalog', () => {
    const aisles = groupShoppingItemsByAisle([item('Alimento inventado')], foods)
    expect(aisles).toEqual([{ label: 'Otros', icon: '🛒', items: [item('Alimento inventado')] }])
  })

  it('matches around parentheses and extra words the trainer typed by hand', () => {
    const catalogWithParens = [{ name: 'Boniato (asado)', category: 'Carbohidrato' }, { name: 'Yogur natural', category: 'Lácteo' }]
    expect(groupShoppingItemsByAisle([item('Boniato asado')], catalogWithParens)[0].label).toBe('Despensa y cereales')
    expect(groupShoppingItemsByAisle([item('Yogur natural sin lactosa')], catalogWithParens)[0].label).toBe('Lácteos')
  })

  it('keeps aisles in a stable, sensible order regardless of input order', () => {
    const aisles = groupShoppingItemsByAisle([item('Yogur natural'), item('Manzana')], foods)
    expect(aisles.map(a => a.label)).toEqual(['Frutas y verduras', 'Lácteos'])
  })
})
