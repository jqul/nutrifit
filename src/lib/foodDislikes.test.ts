import { describe, it, expect } from 'vitest'
import { dislikeMatch, parseDislikes } from './foodDislikes'

describe('parseDislikes', () => {
  it('splits on commas, semicolons and new lines, without accents, repeats or empties', () => {
    expect(parseDislikes(' Pescado, coliflor;  Setas\nCoLiFlor ,, a')).toEqual(['pescado', 'coliflor', 'setas'])
    expect(parseDislikes('Hígado')).toEqual(['higado'])
  })
  it('copes with nothing', () => {
    expect(parseDislikes('')).toEqual([])
    expect(parseDislikes(null)).toEqual([])
    expect(parseDislikes(undefined)).toEqual([])
  })
})

describe('dislikeMatch', () => {
  it('matches a word at the start of any word of the name, ignoring case and accents', () => {
    expect(dislikeMatch('pescado, coliflor', 'Coliflor al vapor')).toBe('coliflor')
    expect(dislikeMatch('higado', 'Hígado de ternera')).toBe('higado')
    expect(dislikeMatch('pan', 'Tostada de pan integral')).toBe('pan')
  })
  it('does not match in the middle of an unrelated word', () => {
    expect(dislikeMatch('pan', 'Campana de cocina')).toBeNull()
    expect(dislikeMatch('arroz', 'Cazuela de pasta')).toBeNull()
    expect(dislikeMatch('ajo', 'Tomate frito')).toBeNull()
  })
  it('matches singular and plural either way', () => {
    expect(dislikeMatch('setas', 'Seta a la plancha')).toBe('setas')
    expect(dislikeMatch('huevos', 'Huevo cocido')).toBe('huevos')
    expect(dislikeMatch('seta', 'Setas salteadas')).toBe('seta')
  })
  it('accepts an already parsed list, and returns null with nothing to match', () => {
    expect(dislikeMatch(['pescado'], 'Pescado blanco')).toBe('pescado')
    expect(dislikeMatch('', 'Pescado blanco')).toBeNull()
    expect(dislikeMatch('pescado', '')).toBeNull()
  })
  it('is not fooled by characters that mean something in a regular expression', () => {
    expect(dislikeMatch('a(b', 'Plato a(b')).toBe('a(b')
    expect(dislikeMatch('.*', 'Cualquier cosa')).toBeNull()
  })
})
