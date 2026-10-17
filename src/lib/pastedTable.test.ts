import { describe, expect, it } from 'vitest'
import { parsePastedHistory, parsePastedTable } from './pastedTable'
import { parseWeightHistory } from './weightHistoryImport'
import { rowsToClients, hasNameColumn } from './clientImport'

describe('parsePastedTable', () => {
  it('reads what Excel or Google Sheets copy (tabs), keeping decimal commas', () => {
    expect(parsePastedTable('Nombre\tPeso\nAna\t65,5\nLuis\t80')).toEqual([['Nombre', 'Peso'], ['Ana', '65,5'], ['Luis', '80']])
  })
  it('reads a CSV pasted as text, with semicolons or commas', () => {
    expect(parsePastedTable('Nombre;Peso\nAna;65,5')).toEqual([['Nombre', 'Peso'], ['Ana', '65,5']])
    expect(parsePastedTable('Nombre,Email\nAna,ana@x.es')).toEqual([['Nombre', 'Email'], ['Ana', 'ana@x.es']])
  })
  it('splits the columns of a table copied from a PDF by their spacing, without breaking names', () => {
    expect(parsePastedTable('Nombre   Apellidos   Peso\nAna María   Pérez Gil   65,5')).toEqual([['Nombre', 'Apellidos', 'Peso'], ['Ana María', 'Pérez Gil', '65,5']])
  })
  it('ignores blank lines and Windows line endings, and is empty for nothing', () => {
    expect(parsePastedTable('a;b\r\n\r\n1;2\r\n')).toEqual([['a', 'b'], ['1', '2']])
    expect(parsePastedTable('  \n ')).toEqual([])
  })
})

describe('parsePastedHistory', () => {
  const expected = [['Cliente', 'Fecha', 'Peso (kg)'], ['Laura Gómez', '01/09/2026', '70,5'], ['Laura Gómez', '15/09/2026', '69,8']]
  it('keeps a table that already has its headers', () => {
    expect(parsePastedHistory('Cliente\tFecha\tPeso\nLaura Gómez\t01/09/2026\t70,5')).toEqual([['Cliente', 'Fecha', 'Peso'], ['Laura Gómez', '01/09/2026', '70,5']])
  })
  it('understands one line per weigh-in without headers, as a PDF often gives it', () => {
    expect(parsePastedHistory('Laura Gómez 01/09/2026 70,5 kg\nLaura Gómez 15/09/2026 69,8 kg')).toEqual(expected)
    expect(parsePastedHistory('Laura Gómez   01/09/2026   70,5\nLaura Gómez   15/09/2026   69,8')).toEqual(expected)
  })
  it('understands each piece of data on its own line (name, date, weight)', () => {
    const text = 'Laura Gómez\n01/09/2026\n70,5\n15/09/2026\n69,8\nCarlos Ruiz\n01/09/2026\n80 kg'
    expect(parsePastedHistory(text)).toEqual([...expected, ['Carlos Ruiz', '01/09/2026', '80']])
  })
  it('gives back something importable: the result goes straight into the history reader', () => {
    const clients = [{ id: 'c1', name: 'Laura', surname: 'Gómez', email: '', phone: '' }]
    const r = parseWeightHistory(parsePastedHistory('Laura Gómez 01/09/2026 70,5 kg\nLaura Gómez 15/09/2026 69,8 kg'), clients, new Date(2026, 9, 17))
    expect(r.problems).toEqual([])
    expect(r.entries.map(e => e.weightKg)).toEqual([70.5, 69.8])
  })
  it('returns the plain table when it cannot make sense of it, so the screen can say which columns are missing', () => {
    expect(parsePastedHistory('esto no es\nuna tabla')).toEqual([['esto no es'], ['una tabla']])
    expect(parsePastedHistory('')).toEqual([])
  })
})

describe('clients pasted', () => {
  it('a pasted table with a Nombre column becomes clients', () => {
    const table = parsePastedTable('Nombre\tApellidos\tPeso\nAna\tPérez\t65,5')
    expect(hasNameColumn(table)).toBe(true)
    expect(rowsToClients(table)[0]).toMatchObject({ name: 'Ana', surname: 'Pérez', weightKg: '65,5' })
  })
})
