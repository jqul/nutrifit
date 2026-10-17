import { describe, expect, it } from 'vitest'
import { findExistingClient, hasNameColumn, reviewClientRows, rowsToClients, CLIENT_TEMPLATE, HISTORY_TEMPLATE } from './clientImport'
import { parseCSV } from './spreadsheet'
import { parseWeightHistory } from './weightHistoryImport'

const existing = [
  { id: 'c1', name: 'Laura', surname: 'Gómez', email: 'laura@correo.es', phone: '600 111 222' },
  { id: 'c2', name: 'Carlos', surname: 'Ruiz', email: '', phone: '' },
]

describe('rowsToClients', () => {
  it('reads the columns by name, in any order, ignoring blank rows', () => {
    const rows = [['Peso', 'Apellidos', 'Nombre', 'Teléfono'], ['72,5', 'Pérez', 'Ana', '600'], ['', '', '', '']]
    expect(rowsToClients(rows)).toEqual([expect.objectContaining({ name: 'Ana', surname: 'Pérez', phone: '600', weightKg: '72,5', email: '', goal: '' })])
  })
  it('knows when there is no name column', () => {
    expect(hasNameColumn([['Nombre', 'Peso']])).toBe(true)
    expect(hasNameColumn([['Cliente', 'Peso']])).toBe(false)
    expect(hasNameColumn([])).toBe(false)
  })
  it('reads the template that the app offers to download', () => {
    const clients = rowsToClients(parseCSV(CLIENT_TEMPLATE))
    expect(clients.map(c => c.name)).toEqual(['Laura', 'Carlos'])
    expect(clients[0]).toMatchObject({ weightKg: '70,5', goalWeightKg: '64', heightCm: '165' })
  })
})

describe('findExistingClient', () => {
  it('matches by email, by phone in any format, or by full name', () => {
    expect(findExistingClient({ name: 'X', surname: '', email: 'LAURA@correo.es', phone: '' }, existing)?.id).toBe('c1')
    expect(findExistingClient({ name: 'X', surname: '', email: '', phone: '+34600111222' }, existing)?.id).toBe('c1')
    expect(findExistingClient({ name: 'carlos', surname: 'RUIZ', email: '', phone: '' }, existing)?.id).toBe('c2')
  })
  it('does not match a different person who shares a first name', () => {
    expect(findExistingClient({ name: 'Laura', surname: 'Martín', email: '', phone: '' }, existing)).toBeNull()
  })
})

describe('reviewClientRows', () => {
  const rows = rowsToClients([
    ['Nombre', 'Apellidos', 'Email', 'Peso'],
    ['Laura', 'Gómez', '', '70'],       // ya existe
    ['Ana', 'Pérez', 'ana@x.es', '65'], // nueva
    ['Ana', 'Pérez', 'ana@x.es', ''],   // repetida dentro del archivo
    ['', 'Sin nombre', '', ''],         // sin nombre
    ['Luis', 'Díaz', '', 'mucho'],      // peso ilegible, pero se importa
  ])
  it('says what will happen with each row', () => {
    expect(reviewClientRows(rows, existing).map(r => r.status)).toEqual(['exists', 'new', 'exists', 'no-name', 'new'])
  })
  it('warns about weights it cannot read without dropping the client', () => {
    const luis = reviewClientRows(rows, existing)[4]
    expect(luis.status).toBe('new')
    expect(luis.badWeights).toEqual(['peso'])
  })
})

describe('the two templates work together', () => {
  it('the history template matches the clients of the clients template by name', () => {
    const clients = rowsToClients(parseCSV(CLIENT_TEMPLATE)).map((c, i) => ({ id: `new-${i}`, name: c.name, surname: c.surname, email: c.email, phone: c.phone }))
    const r = parseWeightHistory(parseCSV(HISTORY_TEMPLATE), clients, new Date(2026, 9, 17))
    expect(r.problems).toEqual([])
    expect(r.entries).toHaveLength(3)
    expect(r.clientsMatched).toBe(2)
  })
})
