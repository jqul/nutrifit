// Línea base del detector de alérgenos ANTES de corregirlo (Fase 1 de contención).
//
// Esto NO es una validación de seguridad. Las pruebas fijan lo que el detector hace HOY para que cualquier cambio (a mejor o a
// peor) se note y se decida a propósito. Los falsos negativos y positivos de abajo son LIMITACIONES CONOCIDAS PENDIENTES DE
// CORREGIR con el modelo estructurado de alérgenos (Fase 2): que aquí estén fijados no significa que el resultado sea correcto,
// y el sistema no debe tratarlos como alimentos seguros. Cada caso lleva el resultado que se DEBERÍA dar.
//
// Si una prueba de limitaciones falla porque se ha mejorado el detector: es una buena noticia; hay que moverla de grupo a
// propósito (de «limitación» a «comportamiento correcto»), no borrarla.
import { describe, it, expect } from 'vitest'
import { allergenTagConflicts, detectAllergenConflict as detect } from './allergens'

type Known = { allergy: string; food: string; current: string | null; ideal: string | null; why: string }

// ── 1. Comportamientos actuales que deben conservarse ────────────────────────────────────────────
describe('1. comportamientos actuales que deben conservarse', () => {
  const keep: [string, string, string | null][] = [
    ['intolerancia a la lactosa', 'Yogur natural', 'lactosa'],
    ['alergia a la leche', 'Queso fresco', 'lactosa'],
    ['celíaco', 'Pan de centeno', 'gluten'],
    ['gluten', 'Pasta (cocida)', 'gluten'],
    ['gluten', 'Cuscús (cocido)', 'gluten'],
    ['alergia al pescado', 'Salmón', 'pescado'],
    ['alergia al pescado', 'Atún en lata', 'pescado'],
    ['alergia al marisco', 'Gambas', 'marisco'],
    ['alergia al marisco', 'Mejillones', 'marisco'],
    ['alergia al huevo', 'Clara de huevo', 'huevo'],
    ['alergia a la soja', 'Tofu', 'soja'],
    ['alergia a la soja', 'Salsa de soja', 'soja'],
    ['alergia a la almendra', 'Almendras', 'frutos_secos'],
    ['alergia a frutos secos', 'Leche de almendra', 'frutos_secos'],
    ['ALERGIA A FRUTOS SECOS', 'PISTACHOS', 'frutos_secos'],
    // Lo que no debe avisar:
    ['intolerancia a la lactosa', 'Leche de avena', null],
    ['intolerancia a la lactosa', 'Mantequilla de cacahuete', null],
    ['intolerancia a la lactosa', 'Queso sin lactosa', null],
    ['gluten', 'Pan sin gluten', null],
    ['alergia al pescado', 'Pechuga de pollo', null],
    ['alergia a frutos secos', 'Champiñones', null],
    ['', 'Yogur natural', null],
    ['   ', 'Yogur natural', null],
    ['alergia a la lactosa', '', null],
  ]
  it.each(keep)('«%s» + «%s» → %s', (allergy, food, expected) => {
    expect(detect(allergy, food)).toBe(expected)
  })
  it('devuelve solo la primera categoría que choca', () => {
    expect(detect('lactosa y gluten', 'Pasta con queso')).toBe('lactosa')
  })
})

// ── 2. Falsos positivos conocidos ────────────────────────────────────────────────────────────────
describe('2. LIMITACIÓN CONOCIDA: falsos positivos (avisa sin que haya el alérgeno)', () => {
  const cases: Known[] = [
    { allergy: 'gluten', food: 'Panceta', current: 'gluten', ideal: null, why: 'coincide «pan» dentro de «panceta»' },
    { allergy: 'gluten', food: 'Panela', current: 'gluten', ideal: null, why: 'coincide «pan» dentro de «panela» (azúcar de caña)' },
    { allergy: 'celíaco', food: 'Harina de arroz', current: 'gluten', ideal: null, why: 'toda «harina» se toma por trigo' },
    { allergy: 'celíaco', food: 'Pasta de arroz', current: 'gluten', ideal: null, why: 'toda «pasta» se toma por trigo' },
    { allergy: 'gluten', food: 'Pasta de sésamo', current: 'gluten', ideal: null, why: 'toda «pasta» se toma por trigo' },
    { allergy: 'gluten', food: 'Pan gluten free', current: 'gluten', ideal: null, why: 'solo reconoce «sin gluten», no «gluten free»' },
    { allergy: 'intolerancia a la lactosa', food: 'Yogur de soja', current: 'lactosa', ideal: null, why: 'toda palabra «yogur» se toma por lácteo' },
    { allergy: 'intolerancia a la lactosa', food: 'Queso vegano', current: 'lactosa', ideal: null, why: 'toda palabra «queso» se toma por lácteo' },
    { allergy: 'intolerancia a la lactosa', food: 'Nata vegetal', current: 'lactosa', ideal: null, why: 'toda palabra «nata» se toma por lácteo' },
    { allergy: 'alergia a frutos secos', food: 'Nuez moscada', current: 'frutos_secos', ideal: null, why: 'la nuez moscada es una especia, no un fruto seco' },
  ]
  it.each(cases)('(limitación) «$allergy» + «$food»: hoy $current; debería ser $ideal ($why)', ({ allergy, food, current }) => {
    expect(detect(allergy, food)).toBe(current)
  })
})

// ── 3. Falsos negativos conocidos ────────────────────────────────────────────────────────────────
describe('3. LIMITACIÓN CONOCIDA: falsos negativos (NO avisa aunque lleve el alérgeno)', () => {
  const cases: Known[] = [
    // Gluten
    { allergy: 'celíaco', food: 'Seitán', current: null, ideal: 'gluten', why: 'es gluten de trigo' },
    { allergy: 'gluten', food: 'Seitán', current: null, ideal: 'gluten', why: 'es gluten de trigo' },
    { allergy: 'celíaco', food: 'Avena', current: null, ideal: 'gluten', why: 'contaminación cruzada habitual; exige criterio específico' },
    { allergy: 'celíaco', food: 'Cerveza', current: null, ideal: 'gluten', why: 'lleva cebada' },
    { allergy: 'celíaco', food: 'Galletas', current: null, ideal: 'gluten', why: 'suelen llevar trigo' },
    { allergy: 'celíaco', food: 'Fideos', current: null, ideal: 'gluten', why: 'son de trigo' },
    { allergy: 'celíaco', food: 'Salsa de soja', current: null, ideal: 'gluten', why: 'suele llevar trigo (sí avisa de soja)' },
    // Pescado
    { allergy: 'alergia al pescado', food: 'Caballa', current: null, ideal: 'pescado', why: 'solo conoce algunos pescados' },
    { allergy: 'alergia al pescado', food: 'Dorada', current: null, ideal: 'pescado', why: 'solo conoce algunos pescados' },
    { allergy: 'alergia al pescado', food: 'Lubina', current: null, ideal: 'pescado', why: 'solo conoce algunos pescados' },
    { allergy: 'alergia al pescado', food: 'Sardinas (en lata, al natural)', current: null, ideal: 'pescado', why: 'solo conoce algunos pescados' },
    { allergy: 'alergia al pescado', food: 'Anchoas', current: null, ideal: 'pescado', why: 'solo conoce algunos pescados' },
    { allergy: 'alergia al pescado', food: 'Surimi', current: null, ideal: 'pescado', why: 'lleva pescado' },
    { allergy: 'alergia al pescado', food: 'Pescadilla', current: null, ideal: 'pescado', why: 'no contiene la palabra «pescado»' },
    // Marisco (crustáceos y moluscos)
    { allergy: 'alergia al marisco', food: 'Calamar', current: null, ideal: 'marisco', why: 'molusco' },
    { allergy: 'alergia al marisco', food: 'Pulpo (cocido)', current: null, ideal: 'marisco', why: 'molusco' },
    { allergy: 'alergia al marisco', food: 'Almejas', current: null, ideal: 'marisco', why: 'molusco' },
    { allergy: 'alergia al marisco', food: 'Langosta', current: null, ideal: 'marisco', why: 'crustáceo' },
    // Frutos secos
    { allergy: 'alergia a frutos secos', food: 'Piñones', current: null, ideal: 'frutos_secos', why: 'no está en la lista' },
    { allergy: 'alergia a frutos secos', food: 'Turrón', current: null, ideal: 'frutos_secos', why: 'producto compuesto con almendra' },
    { allergy: 'alergia a la almendra', food: 'Mazapán', current: null, ideal: 'frutos_secos', why: 'producto compuesto con almendra' },
    { allergy: 'alergia a frutos secos', food: 'Pesto', current: null, ideal: 'frutos_secos', why: 'suele llevar piñones o frutos secos' },
    // Lácteos y huevo en productos compuestos
    { allergy: 'intolerancia a la lactosa', food: 'Helado', current: null, ideal: 'lactosa', why: 'producto compuesto' },
    { allergy: 'intolerancia a la lactosa', food: 'Natillas', current: null, ideal: 'lactosa', why: 'producto compuesto' },
    { allergy: 'intolerancia a la lactosa', food: 'Bechamel', current: null, ideal: 'lactosa', why: 'producto compuesto' },
    { allergy: 'alergia al huevo', food: 'Mayonesa', current: null, ideal: 'huevo', why: 'producto compuesto' },
    { allergy: 'alergia al huevo', food: 'Tortilla', current: null, ideal: 'huevo', why: 'es huevo' },
  ]
  it.each(cases)('(limitación) «$allergy» + «$food»: hoy $current; debería ser $ideal ($why)', ({ allergy, food, current }) => {
    expect(detect(allergy, food)).toBe(current)
  })
  it('ningún falso negativo conocido está ya corregido por casualidad (si falla: moverlo de grupo a propósito)', () => {
    const fixed = cases.filter(c => detect(c.allergy, c.food) === c.ideal)
    expect(fixed).toEqual([])
  })
  // Registro visible de lo pendiente: aparece como «todo» en el informe de pruebas hasta que se corrija.
  for (const c of cases) it.todo(`PENDIENTE: «${c.allergy}» + «${c.food}» debería dar ${c.ideal}`)
})

// ── 4. Categorías de alergia no reconocidas ──────────────────────────────────────────────────────
describe('4. LIMITACIÓN CONOCIDA: categorías de alergia que el detector no tiene', () => {
  const cases: [string, string][] = [
    ['alergia al sésamo', 'Tahini (crema de sésamo)'],
    ['alergia al apio', 'Apio'],
    ['alergia a la mostaza', 'Mostaza'],
    ['alergia a los sulfitos', 'Vino blanco'],
    ['alergia a los altramuces', 'Harina de altramuz'],
    ['alergia a los moluscos', 'Calamar'],
    ['alergia al kiwi', 'Kiwi'],
    ['alergia a la fresa', 'Fresas'],
  ]
  it.each(cases)('«%s» + «%s» → sin aviso (la categoría no existe)', (allergy, food) => {
    expect(detect(allergy, food)).toBeNull()
  })
  it('«celiaquía» y «celiaquia» no se reconocen (solo «celíaco», «celiaco», «gluten» y «trigo»)', () => {
    expect(detect('celiaquía', 'Pan de centeno')).toBeNull()
    expect(detect('celiaquia', 'Pan de centeno')).toBeNull()
    expect(detect('celíaco', 'Pan de centeno')).toBe('gluten')
  })
  it('el cacahuete se comprueba como «frutos secos» (es una legumbre; pendiente de separar)', () => {
    expect(detect('alergia al cacahuete', 'Crema de cacahuete')).toBe('frutos_secos')
  })
})

// ── 5. Ingredientes compuestos y etiquetas manuales ──────────────────────────────────────────────
describe('5. ingredientes compuestos y etiquetas manuales', () => {
  it('LIMITACIÓN CONOCIDA: un producto compuesto no avisa aunque pueda llevar el alérgeno (solo se mira el nombre)', () => {
    for (const food of ['Crema de verduras', 'Salsa de tomate', 'Caldo', 'Embutido', 'Rebozado', 'Croquetas']) {
      expect(detect('intolerancia a la lactosa', food), `lactosa + ${food}`).toBeNull()
      expect(detect('celíaco', food), `celíaco + ${food}`).toBeNull()
      expect(detect('alergia al huevo', food), `huevo + ${food}`).toBeNull()
    }
  })
  it('etiquetas manuales de una receta: cruzan con lo que dice el cliente, con las mismas palabras', () => {
    expect(allergenTagConflicts('alergia a los frutos secos', ['frutos_secos', 'gluten'])).toEqual(['frutos_secos'])
    expect(allergenTagConflicts('celíaco', ['gluten'])).toEqual(['gluten'])
    expect(allergenTagConflicts('lactosa y huevo', ['lactosa', 'huevo', 'pescado'])).toEqual(['lactosa', 'huevo'])
  })
  it('etiquetas manuales: ids desconocidos o vacíos se ignoran', () => {
    expect(allergenTagConflicts('lactosa', ['no_existe'])).toEqual([])
    expect(allergenTagConflicts('lactosa', [])).toEqual([])
    expect(allergenTagConflicts('lactosa', null)).toEqual([])
    expect(allergenTagConflicts('', ['lactosa'])).toEqual([])
  })
  it('LIMITACIÓN CONOCIDA: las etiquetas dependen de que el profesional las marque, y de cómo escriba la alergia', () => {
    expect(allergenTagConflicts('celiaquía', ['gluten'])).toEqual([])
    expect(allergenTagConflicts('alergia al sésamo', ['gluten', 'huevo'])).toEqual([])
  })
})

// ── 6. Coincidencias parciales de texto ──────────────────────────────────────────────────────────
describe('6. coincidencias parciales de texto', () => {
  it('no deben avisar y hoy no avisan', () => {
    expect(detect('alergia a frutos secos', 'Champiñones')).toBeNull()
    expect(detect('intolerancia a la lactosa', 'Naranja')).toBeNull()
    expect(detect('intolerancia a la lactosa', 'Patata (cocida)')).toBeNull()
    expect(detect('gluten', 'Compota de manzana')).toBeNull()
    expect(detect('alergia al huevo', 'Huevos de codorniz')).toBe('huevo')
  })
  it('LIMITACIÓN CONOCIDA: avisan sin motivo por coincidir una palabra dentro de otra (ver grupo 2)', () => {
    expect(detect('gluten', 'Panceta')).toBe('gluten')
    expect(detect('gluten', 'Panela')).toBe('gluten')
    expect(detect('alergia a frutos secos', 'Nuez moscada')).toBe('frutos_secos')
  })
  it('las mayúsculas y las tildes de la variante escrita no cambian el resultado en las palabras que ya conoce', () => {
    expect(detect('CELÍACO', 'PAN DE CENTENO')).toBe('gluten')
    expect(detect('celiaco', 'pan de centeno')).toBe('gluten')
    expect(detect('Alergia al pescado', 'SALMON')).toBe('pescado')
    expect(detect('Alergia al pescado', 'Salmón')).toBe('pescado')
  })
})
