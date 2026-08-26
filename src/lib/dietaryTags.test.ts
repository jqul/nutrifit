import { describe, it, expect } from 'vitest'
import { classifyFoodTags, foodMatchesTags } from './dietaryTags'

const food = (name: string, proteinG = 5) => ({ name, category: 'Otros', proteinG })

describe('classifyFoodTags', () => {
  it('tags chicken breast as gluten-free, lactose-free, and high-protein but not vegan or low-FODMAP-irrelevant', () => {
    const tags = classifyFoodTags(food('Pechuga de pollo', 31))
    expect(tags).toContain('sin_gluten')
    expect(tags).toContain('sin_lactosa')
    expect(tags).toContain('alto_proteina')
    expect(tags).not.toContain('vegano')
  })

  it('flags bread as containing gluten', () => {
    const tags = classifyFoodTags(food('Pan integral'))
    expect(tags).not.toContain('sin_gluten')
  })

  it('respects an explicit "sin gluten" label in the name', () => {
    const tags = classifyFoodTags(food('Pan sin gluten'))
    expect(tags).toContain('sin_gluten')
  })

  it('flags dairy as containing lactose unless explicitly lactose-free or plant-based', () => {
    expect(classifyFoodTags(food('Yogur natural'))).not.toContain('sin_lactosa')
    expect(classifyFoodTags(food('Leche sin lactosa'))).toContain('sin_lactosa')
    expect(classifyFoodTags(food('Bebida vegetal de avena'))).toContain('sin_lactosa')
  })

  it('excludes meat, fish, dairy, and eggs from vegano', () => {
    expect(classifyFoodTags(food('Tofu'))).toContain('vegano')
    expect(classifyFoodTags(food('Merluza'))).not.toContain('vegano')
    expect(classifyFoodTags(food('Huevo entero'))).not.toContain('vegano')
    expect(classifyFoodTags(food('Queso fresco'))).not.toContain('vegano')
  })

  it('flags known high-FODMAP triggers like onion and garlic', () => {
    expect(classifyFoodTags(food('Cebolla'))).not.toContain('bajo_fodmap')
    expect(classifyFoodTags(food('Ajo'))).not.toContain('bajo_fodmap')
    expect(classifyFoodTags(food('Arroz blanco'))).toContain('bajo_fodmap')
  })

  it('flags high-protein foods at 15g/100g or above', () => {
    expect(classifyFoodTags(food('Alimento X', 15))).toContain('alto_proteina')
    expect(classifyFoodTags(food('Alimento Y', 14.9))).not.toContain('alto_proteina')
  })

  it('flags cured/processed/brined foods as high in sodium', () => {
    expect(classifyFoodTags(food('Jamón serrano'))).not.toContain('bajo_sodio')
    expect(classifyFoodTags(food('Aceitunas'))).not.toContain('bajo_sodio')
    expect(classifyFoodTags(food('Pechuga de pollo'))).toContain('bajo_sodio')
  })

  it('flags oily fish, nuts, and seeds as high in omega-3', () => {
    expect(classifyFoodTags(food('Salmón'))).toContain('alto_omega3')
    expect(classifyFoodTags(food('Nueces'))).toContain('alto_omega3')
    expect(classifyFoodTags(food('Semillas de chía'))).toContain('alto_omega3')
    expect(classifyFoodTags(food('Pechuga de pollo'))).not.toContain('alto_omega3')
  })
})

describe('foodMatchesTags', () => {
  it('matches everything when no filters are active', () => {
    expect(foodMatchesTags(food('Pan'), [])).toBe(true)
  })

  it('requires all active tags to match (AND, not OR)', () => {
    expect(foodMatchesTags(food('Tofu', 12), ['vegano', 'alto_proteina'])).toBe(false)
    expect(foodMatchesTags(food('Tofu', 16), ['vegano', 'alto_proteina'])).toBe(true)
  })
})
