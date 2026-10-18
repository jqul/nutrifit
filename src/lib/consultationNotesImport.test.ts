import { describe, expect, it } from 'vitest'
import { NOTES_HEADER, mergeConsultationNotes, noteLine, parseConsultationNotes } from './consultationNotesImport'

const clients = [
  { id: 'c1', name: 'Laura', surname: 'Gómez', email: 'laura@correo.es', phone: '' },
  { id: 'c2', name: 'Carlos', surname: 'Ruiz', email: '', phone: '611333444' },
]
const TODAY = new Date(2026, 9, 18)

describe('parseConsultationNotes', () => {
  it('reads a client, a date and a note, matching the client by name, email or phone', () => {
    const r = parseConsultationNotes([
      ['Cliente', 'Fecha', 'Nota'],
      ['Laura Gómez', '01/09/2026', 'Primera consulta. Intolerancia a la lactosa.'],
      ['laura@correo.es', '15/09/2026', 'Mejor energía.'],
    ], clients, TODAY)
    expect(r.problems).toEqual([])
    expect(r.entries.map(e => [e.clientId, e.date])).toEqual([['c1', '2026-09-01'], ['c1', '2026-09-15']])
    expect(r.clientsMatched).toBe(1)
  })
  it('accepts the usual names for the note column and joins multi-line notes', () => {
    const r = parseConsultationNotes([['Paciente', 'Fecha', 'Observaciones'], ['Carlos Ruiz', '1/9/2026', 'Línea uno\n  línea dos']], clients, TODAY)
    expect(r.entries[0].text).toBe('Línea uno línea dos')
  })
  it('explains the rows it cannot use and keeps the others', () => {
    const r = parseConsultationNotes([
      ['Cliente', 'Fecha', 'Nota'],
      ['Laura Gómez', '1/9/2026', 'ok'],
      ['Laura Gómez', 'ayer', 'x'],
      ['Laura Gómez', '2/9/2026', ''],
      ['Nadie', '2/9/2026', 'x'],
      ['Laura Gómez', '2027-01-01', 'x'],
    ], clients, TODAY)
    expect(r.entries).toHaveLength(1)
    expect(r.problems.map(p => p.row)).toEqual([3, 4, 5, 6])
  })
  it('says which columns are missing', () => {
    expect(parseConsultationNotes([['Cliente', 'Fecha']], clients, TODAY).missingColumns).toEqual(['Nota'])
  })
})

describe('mergeConsultationNotes', () => {
  const entries = [{ date: '2026-09-15', text: 'Mejor energía.' }, { date: '2026-09-01', text: 'Primera consulta.' }]
  it('adds the consultations after what was already written, in date order, under a header', () => {
    const r = mergeConsultationNotes('Prefiere comer fuera los viernes.', entries)
    expect(r.added).toBe(2)
    expect(r.text).toBe(`Prefiere comer fuera los viernes.\n\n${NOTES_HEADER}\n[01/09/2026] Primera consulta.\n[15/09/2026] Mejor energía.`)
  })
  it('works on an empty note', () => {
    expect(mergeConsultationNotes('', entries).text.startsWith(NOTES_HEADER)).toBe(true)
  })
  it('does not repeat what is already there, so importing the same file twice changes nothing', () => {
    const once = mergeConsultationNotes('x', entries).text
    const twice = mergeConsultationNotes(once, entries)
    expect(twice.added).toBe(0)
    expect(twice.text).toBe(once)
  })
  it('adds only the new consultation, without repeating the header', () => {
    const once = mergeConsultationNotes('', entries).text
    const more = mergeConsultationNotes(once, [...entries, { date: '2026-10-01', text: 'Revisión.' }])
    expect(more.added).toBe(1)
    expect(more.text.split(NOTES_HEADER)).toHaveLength(2)
    expect(more.text.endsWith(noteLine({ date: '2026-10-01', text: 'Revisión.' }))).toBe(true)
  })
})
