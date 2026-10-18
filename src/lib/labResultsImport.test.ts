import { describe, expect, it } from 'vitest'
import { markerOf, parseLabResults } from './labResultsImport'

const clients = [{ id: 'c1', name: 'Laura', surname: 'Gómez', email: '', phone: '' }]
const TODAY = new Date(2026, 9, 18)

describe('markerOf', () => {
  it('knows the usual names of each marker, with or without accents and units', () => {
    expect(markerOf('Glucosa')?.key).toBe('glucosa')
    expect(markerOf('GLUCEMIA')?.key).toBe('glucosa')
    expect(markerOf('Triglicéridos')?.key).toBe('trigliceridos')
    expect(markerOf('Colesterol HDL')?.key).toBe('hdl')
    expect(markerOf('GOT (AST)')?.key).toBe('got_ast')
    expect(markerOf('Vitamina D (ng/mL)')).toEqual({ key: 'vitamina_d', unit: 'ng/mL' })
  })
  it('returns null for what NutriFit does not track', () => {
    expect(markerOf('Hemoglobina glicosilada')).toBeNull()
    expect(markerOf('')).toBeNull()
  })
})

describe('parseLabResults (one row per result)', () => {
  it('reads client, date, marker and value, with decimal commas', () => {
    const r = parseLabResults([
      ['Cliente', 'Fecha', 'Marcador', 'Valor'],
      ['Laura Gómez', '01/09/2026', 'Glucosa', '92'],
      ['Laura Gómez', '01/09/2026', 'Colesterol total', '201,5'],
    ], clients, TODAY)
    expect(r.problems).toEqual([])
    expect(r.entries.map(e => [e.markerKey, e.value])).toEqual([['colesterol_total', 201.5], ['glucosa', 92]])
  })
  it('reports markers it does not know, bad values, and units that differ from the ones NutriFit uses', () => {
    const r = parseLabResults([
      ['Cliente', 'Fecha', 'Marcador', 'Valor', 'Unidad'],
      ['Laura Gómez', '01/09/2026', 'HbA1c', '5,4', '%'],
      ['Laura Gómez', '01/09/2026', 'Glucosa', 'alta', 'mg/dL'],
      ['Laura Gómez', '01/09/2026', 'Glucosa', '5,1', 'mmol/L'],
      ['Laura Gómez', '01/09/2026', 'Hierro', '90', 'µg/dL'],
    ], clients, TODAY)
    expect(r.entries.map(e => e.markerKey)).toEqual(['hierro'])
    expect(r.problems.map(p => p.row)).toEqual([2, 3, 4])
    expect(r.problems[0].reason).toMatch(/no admitido/)
    expect(r.problems[2].reason).toMatch(/mmol\/L.*mg\/dL/)
  })
})

describe('parseLabResults (one column per marker)', () => {
  it('reads a wide table, skipping empty cells', () => {
    const r = parseLabResults([
      ['Cliente', 'Fecha', 'Glucosa', 'Colesterol total', 'TSH'],
      ['Laura Gómez', '01/09/2026', '92', '201', ''],
      ['Laura Gómez', '01/03/2026', '95', '', '2,1'],
    ], clients, TODAY)
    expect(r.problems).toEqual([])
    expect(r.entries).toHaveLength(4)
    expect(r.entries.find(e => e.markerKey === 'tsh')?.value).toBe(2.1)
  })
  it('warns when a column states another unit in its header', () => {
    const r = parseLabResults([['Cliente', 'Fecha', 'Glucosa (mmol/L)'], ['Laura Gómez', '01/09/2026', '5,1']], clients, TODAY)
    expect(r.entries).toEqual([])
    expect(r.problems[0].reason).toMatch(/mmol\/L/)
  })
})

describe('parseLabResults (errors)', () => {
  it('says what is missing and keeps the last of a repeated result', () => {
    expect(parseLabResults([['Cliente', 'Fecha']], clients, TODAY).missingColumns[0]).toMatch(/Marcador/)
    const r = parseLabResults([['Cliente', 'Fecha', 'Marcador', 'Valor'], ['Laura Gómez', '1/9/2026', 'Glucosa', '90'], ['Laura Gómez', '1/9/2026', 'Glucosa', '95']], clients, TODAY)
    expect(r.entries.map(e => e.value)).toEqual([95])
    expect(r.duplicatesInFile).toBe(1)
  })
})
