import { describe, it, expect } from 'vitest'
import {
  ALLERGY_HIDDEN_NOTICE, ALLERGY_LIMITATION, ALLERGY_NOTICE_CLIENT, ALLERGY_NOTICE_PRO, allergyCoverage, coverageLine,
} from './allergyCoverage'
import { ALLERGEN_IDS } from './allergens'

const only = (text: string) => {
  const c = allergyCoverage(text)
  expect(c.items, `«${text}» debería dar un solo elemento`).toHaveLength(1)
  return c.items[0]
}

describe('allergyCoverage: los tres estados', () => {
  it('gluten y pescado: categoría reconocida (con detección limitada)', () => {
    expect(only('Gluten').status).toBe('reconocida')
    expect(only('Pescado').status).toBe('reconocida')
    expect(only('Gluten').categories).toEqual(['gluten'])
    expect(only('Pescado').categories).toEqual(['pescado'])
  })
  it('sésamo y apio: categoría no reconocida', () => {
    expect(only('Sésamo').status).toBe('no_reconocida')
    expect(only('Apio').status).toBe('no_reconocida')
    expect(only('Sésamo').label).toBe('Sésamo')
  })
  it('«Me sienta mal la comida»: información ambigua', () => {
    const i = only('Me sienta mal la comida')
    expect(i.status).toBe('ambigua')
    expect(i.label).toBe('Me sienta mal la comida')
  })
  it('«alergia» a secas, o un texto largo sin alérgeno, es ambiguo', () => {
    expect(only('alergia').status).toBe('ambigua')
    expect(only('tengo varias cosas que no me sientan bien').status).toBe('ambigua')
    expect(only('no sé qué me sienta mal pero algo de la comida del restaurante de siempre').status).toBe('ambigua')
  })
  it('un alimento concreto que el detector no conoce es «no reconocida», no ambigua', () => {
    expect(only('alergia al kiwi').status).toBe('no_reconocida')
    expect(only('alergia al kiwi').label).toBe('Kiwi')
    expect(only('intolerancia a la fructosa').status).toBe('no_reconocida')
  })
})

describe('allergyCoverage: la etiqueta se enseña sin «alergia a…» ni artículos', () => {
  it.each([
    ['Intolerancia a la lactosa', 'Lactosa'],
    ['alergia a los frutos secos', 'Frutos secos'],
    ['alergia al pescado', 'Pescado'],
    ['alérgico a las nueces', 'Nueces'],
    ['no tolera el gluten', 'Gluten'],
    ['alergia a la fresa', 'Fresa'],
    ['Gluten', 'Gluten'],
  ])('«%s» → «%s»', (text, label) => {
    expect(only(text).label).toBe(label)
  })
})

describe('allergyCoverage: reconoce con las mismas palabras que el detector', () => {
  it.each([
    ['lactosa', 'lactosa'], ['intolerancia a la lactosa', 'lactosa'], ['frutos secos', 'frutos_secos'], ['almendra', 'frutos_secos'],
    ['gluten', 'gluten'], ['celíaco', 'gluten'], ['celiaco', 'gluten'], ['trigo', 'gluten'], ['huevo', 'huevo'],
    ['marisco', 'marisco'], ['crustáceos', 'marisco'], ['pescado', 'pescado'], ['soja', 'soja'],
  ])('«%s» → %s', (text, id) => {
    expect(only(text).categories).toContain(id)
    expect(ALLERGEN_IDS).toContain(id)
  })
  it('el cacahuete se reconoce, pero se comprueba como «frutos secos» y la línea lo dice', () => {
    const i = only('alergia al cacahuete')
    expect(i.status).toBe('reconocida')
    expect(coverageLine(i, 'pro')).toContain('se comprueba como: frutos secos')
  })
})

describe('allergyCoverage: lo que no reconoce el detector, aunque sea un alérgeno conocido', () => {
  it.each(['sésamo', 'apio', 'mostaza', 'sulfitos', 'dióxido de azufre', 'altramuces', 'moluscos', 'mejillones', 'calamar'])('«%s»', text => {
    expect(only(`alergia a ${text}`).status).toBe('no_reconocida')
  })
  it('«celiaquía» no se reconoce y el profesional recibe una pista; el cliente no', () => {
    const i = only('celiaquía')
    expect(i.status).toBe('no_reconocida')
    expect(coverageLine(i, 'pro')).toContain('«celíaco», «gluten» o «trigo»')
    expect(coverageLine(i, 'client')).not.toContain('«celíaco»')
  })
})

describe('allergyCoverage: varias alergias en un texto', () => {
  it('separa por comas, «y», punto y coma y saltos de línea', () => {
    const c = allergyCoverage('Alergia a los frutos secos y al sésamo, intolerancia a la lactosa; kiwi\nme sienta mal la comida')
    expect(c.items.map(i => i.status)).toEqual(['reconocida', 'no_reconocida', 'reconocida', 'no_reconocida', 'ambigua'])
    expect(c.hasRecognized && c.hasUnrecognized && c.hasAmbiguous).toBe(true)
  })
  it('un paréntesis no rompe el reconocimiento', () => {
    expect(allergyCoverage('frutos secos (almendra)').items.every(i => i.status === 'reconocida')).toBe(true)
  })
})

describe('allergyCoverage: lo que no es una alergia', () => {
  it.each(['', '   ', null, undefined, 'ninguna', 'Ninguna conocida', 'no', 'No tiene', 'sin alergias', '-', 'n/a', 'nada'])('«%s» no da elementos', text => {
    const c = allergyCoverage(text as string)
    expect(c.items).toEqual([])
    expect(c.hasRecognized || c.hasUnrecognized || c.hasAmbiguous).toBe(false)
  })
})

describe('textos: nunca suenan a garantía', () => {
  const FORBIDDEN = /cubiert|garantiz|certific|libre de|es segur|son segur|apto|sin riesgo/i
  const lines = () => {
    const c = allergyCoverage('gluten, sésamo, me sienta mal la comida, celiaquía, pescado')
    return (['pro', 'client'] as const).flatMap(a => c.items.map(i => coverageLine(i, a)))
  }
  it('las líneas de cobertura no usan palabras de garantía', () => {
    for (const l of lines()) expect(l, l).not.toMatch(FORBIDDEN)
  })
  it('una categoría reconocida dice que la detección es limitada y qué no se comprueba', () => {
    const l = coverageLine(only('gluten'), 'client')
    expect(l).toContain('categoría reconocida, detección limitada')
    expect(l).toContain('no se comprueban todos los ingredientes ni los alérgenos ocultos en productos compuestos')
    expect(l).toContain('no significa que los alimentos estén verificados')
    expect(l).toContain(ALLERGY_LIMITATION)
  })
  it('una categoría no reconocida pide revisar a mano; una ambigua pide concretarla', () => {
    expect(coverageLine(only('sésamo'), 'client')).toContain('categoría no reconocida')
    expect(coverageLine(only('sésamo'), 'client')).toContain('revisa a mano todos los alimentos')
    expect(coverageLine(only('me sienta mal la comida'), 'client')).toContain('información ambigua')
    expect(coverageLine(only('me sienta mal la comida'), 'client')).toContain('conviene concretarla')
  })
  it('los avisos generales dicen que es orientativo y que no sustituye la etiqueta o el criterio', () => {
    expect(ALLERGY_NOTICE_CLIENT).toContain('orientativa y puede estar incompleta')
    expect(ALLERGY_NOTICE_CLIENT).toContain('no lo consideres apto hasta verificarlo')
    expect(ALLERGY_NOTICE_PRO).toContain('orientativa, limitada y puede estar incompleta')
    expect(ALLERGY_NOTICE_PRO).toContain('no significa que sea seguro')
    expect(ALLERGY_HIDDEN_NOTICE).toContain('La detección es limitada y puede no identificar todos los alérgenos')
    expect(ALLERGY_HIDDEN_NOTICE).toContain('no están verificados como seguros')
  })
})
