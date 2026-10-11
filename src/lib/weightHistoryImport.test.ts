import { describe, expect, it } from 'vitest'
import { parseDateCell, parseWeightHistory } from './weightHistoryImport'

const clients = [
  { id: 'c1', name: 'Laura', surname: 'Gómez', email: 'laura@correo.es', phone: '600 111 222' },
  { id: 'c2', name: 'Carlos', surname: 'Ruiz', email: '', phone: '+34 611 333 444' },
  { id: 'c3', name: 'Ana', surname: 'Pérez', email: '', phone: '' },
  { id: 'c4', name: 'Ana', surname: 'López', email: '', phone: '' },
]
const TODAY = new Date(2026, 9, 8)

describe('parseDateCell', () => {
  it('reads ISO dates, Spanish day-first dates and Excel serial numbers', () => {
    expect(parseDateCell('2026-10-03')).toBe('2026-10-03')
    expect(parseDateCell('2026-10-03T10:00:00')).toBe('2026-10-03')
    expect(parseDateCell('3/10/2026')).toBe('2026-10-03')
    expect(parseDateCell('03-10-26')).toBe('2026-10-03')
    expect(parseDateCell('3.10.2026')).toBe('2026-10-03')
    expect(parseDateCell('46298')).toBe('2026-10-03')
  })
  it('rejects things that are not a real date', () => {
    for (const bad of ['', 'ayer', '31/02/2026', '2026-13-01', '99999999', '12']) expect(parseDateCell(bad), bad).toBeNull()
  })
})

describe('parseWeightHistory', () => {
  const run = (rows: string[][]) => parseWeightHistory(rows, clients, TODAY)

  it('reads a long table and matches each row to a client by name', () => {
    const r = run([['Cliente', 'Fecha', 'Peso'], ['Laura Gómez', '01/09/2026', '70,5'], ['laura gomez', '2026-09-15', '69.8'], ['Carlos Ruiz', '1/9/2026', '80']])
    expect(r.problems).toEqual([])
    expect(r.clientsMatched).toBe(2)
    expect(r.entries).toEqual([
      { clientId: 'c2', clientName: 'Carlos Ruiz', date: '2026-09-01', weightKg: 80 },
      { clientId: 'c1', clientName: 'Laura Gómez', date: '2026-09-01', weightKg: 70.5 },
      { clientId: 'c1', clientName: 'Laura Gómez', date: '2026-09-15', weightKg: 69.8 },
    ])
  })
  it('matches by email or phone before the name, whatever the format of the phone', () => {
    const r = run([['Email', 'Teléfono', 'Fecha', 'Peso (kg)'], ['LAURA@correo.es', '', '1/9/2026', '70'], ['', '611333444', '1/9/2026', '80']])
    expect(r.entries.map(e => e.clientId).sort()).toEqual(['c1', 'c2'])
  })
  it('accepts separate Nombre and Apellidos columns', () => {
    const r = run([['Nombre', 'Apellidos', 'Fecha', 'Peso'], ['Ana', 'López', '1/9/2026', '60']])
    expect(r.entries[0].clientId).toBe('c4')
  })
  it('does not guess when a first name is shared by several clients, and asks for more', () => {
    const r = run([['Cliente', 'Fecha', 'Peso'], ['Ana', '1/9/2026', '60']])
    expect(r.entries).toEqual([])
    expect(r.problems[0]).toMatchObject({ row: 2 })
    expect(r.problems[0].reason).toMatch(/varios clientes/)
  })
  it('accepts a first name alone when it is unique', () => {
    expect(run([['Cliente', 'Fecha', 'Peso'], ['Carlos', '1/9/2026', '80']]).entries[0].clientId).toBe('c2')
  })
  it('lists every row it cannot use with the reason and its row number, and keeps the good ones', () => {
    const r = run([
      ['Cliente', 'Fecha', 'Peso'],
      ['Laura Gómez', '1/9/2026', '70'],
      ['Laura Gómez', 'ayer', '70'],
      ['Laura Gómez', '2/9/2026', 'mucho'],
      ['Laura Gómez', '3/9/2026', ''],
      ['Nadie Conocido', '3/9/2026', '70'],
      ['Laura Gómez', '2027-01-01', '70'],
    ])
    expect(r.entries).toHaveLength(1)
    expect(r.problems.map(p => p.row)).toEqual([3, 4, 5, 6, 7])
    expect(r.problems.map(p => p.reason).join('|')).toMatch(/Fecha no válida.*Peso no válido.*Falta el peso.*No hay ningún cliente.*futura/)
  })
  it('keeps the last value when the same client and day appear twice', () => {
    const r = run([['Cliente', 'Fecha', 'Peso'], ['Laura Gómez', '1/9/2026', '70'], ['Laura Gómez', '1/9/2026', '71']])
    expect(r.entries).toEqual([{ clientId: 'c1', clientName: 'Laura Gómez', date: '2026-09-01', weightKg: 71 }])
    expect(r.duplicatesInFile).toBe(1)
  })
  it('says which columns are missing instead of failing silently', () => {
    expect(run([['Cliente', 'Fecha']]).missingColumns).toEqual(['Peso'])
    expect(run([['Peso', 'Fecha']]).missingColumns).toEqual(['Cliente (nombre, email o teléfono)'])
    expect(run([]).missingColumns).toEqual(['cabeceras'])
  })
  it('skips blank rows without counting them as errors', () => {
    const r = run([['Cliente', 'Fecha', 'Peso'], ['', '', ''], ['Laura Gómez', '1/9/2026', '70']])
    expect(r.problems).toEqual([])
    expect(r.entries).toHaveLength(1)
  })
})
