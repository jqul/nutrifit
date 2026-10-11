import { describe, expect, it } from 'vitest'
import { parseWeightKg } from './weightInput'

describe('parseWeightKg', () => {
  it('reads kilos with a comma or a dot, rounded to one decimal', () => {
    expect(parseWeightKg('72,5')).toEqual({ status: 'ok', kg: 72.5 })
    expect(parseWeightKg(' 72.46 ')).toEqual({ status: 'ok', kg: 72.5 })
    expect(parseWeightKg('80')).toEqual({ status: 'ok', kg: 80 })
  })
  it('treats an empty field as "not given", not as an error', () => {
    expect(parseWeightKg('')).toEqual({ status: 'empty' })
    expect(parseWeightKg('   ')).toEqual({ status: 'empty' })
  })
  it('rejects text, negatives and impossible weights', () => {
    for (const bad of ['abc', '-70', '7a', '1,2,3', '12', '19.9', '401', '0']) expect(parseWeightKg(bad), bad).toEqual({ status: 'invalid' })
  })
})
