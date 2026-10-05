import { describe, it, expect } from 'vitest'
import { friendlyFoodError } from './ownFoods'

describe('friendlyFoodError', () => {
  it('explains a duplicate name', () => {
    expect(friendlyFoodError({ code: '23505', message: 'duplicate key value violates unique constraint "foods_custom_name_unique"' })).toContain('Ya existe un alimento con ese nombre')
  })
  it('explains impossible values', () => {
    expect(friendlyFoodError({ code: '23514', message: 'violates check constraint "foods_custom_values_sane"' })).toContain('por 100 g')
  })
  it('explains a permission problem', () => {
    expect(friendlyFoodError({ code: '42501', message: 'new row violates row-level security policy' })).toContain('No tienes permiso')
  })
  it('passes any other message through', () => {
    expect(friendlyFoodError({ message: 'network down' })).toBe('network down')
  })
})
