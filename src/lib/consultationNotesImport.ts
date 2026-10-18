// Importar las notas de consulta que el nutricionista ya tenía de un cliente (una hoja con cliente, fecha y nota).
// Van a las **notas privadas** de su ficha (la pestaña Notas), que el cliente nunca ve, una línea por consulta con su fecha.
import { detectColumns } from './spreadsheet'
import { CLIENT_ID_ALIASES, ImportClient, matchClient } from './clientMatch'
import { parseDateCell } from './weightHistoryImport'

export interface NoteEntry { clientId: string; clientName: string; date: string; text: string }
export interface NotesParse {
  entries: NoteEntry[]
  problems: { row: number; reason: string }[]
  missingColumns: string[]
  clientsMatched: number
}

const ALIASES = {
  ...CLIENT_ID_ALIASES,
  date: ['fecha', 'date', 'dia'],
  note: ['nota', 'notas', 'observaciones', 'observacion', 'consulta', 'comentario', 'comentarios', 'anotacion', 'evolucion', 'note', 'notes'],
}

const MAX_NOTE = 5000

export function parseConsultationNotes(rows: string[][], clients: ImportClient[], today: Date = new Date()): NotesParse {
  const result: NotesParse = { entries: [], problems: [], missingColumns: [], clientsMatched: 0 }
  if (rows.length === 0) { result.missingColumns = ['cabeceras']; return result }
  const cols = detectColumns(rows[0], ALIASES)
  if (cols.date == null) result.missingColumns.push('Fecha')
  if (cols.note == null) result.missingColumns.push('Nota')
  if (cols.client == null && cols.email == null && cols.phone == null) result.missingColumns.push('Cliente (nombre, email o teléfono)')
  if (result.missingColumns.length > 0) return result

  const cell = (r: string[], i: number | undefined) => (i == null ? '' : (r[i] ?? '')).toString().trim()
  const tomorrow = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1)

  rows.slice(1).forEach((r, i) => {
    if (!r.some(c => (c ?? '').toString().trim() !== '')) return
    const row = i + 2
    const date = parseDateCell(cell(r, cols.date))
    if (!date) { result.problems.push({ row, reason: `Fecha no válida («${cell(r, cols.date)}»)` }); return }
    const [y, m, d] = date.split('-').map(Number)
    if (Date.UTC(y, m - 1, d) > tomorrow) { result.problems.push({ row, reason: `La fecha ${date} es futura` }); return }
    const text = cell(r, cols.note).replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
    if (!text) { result.problems.push({ row, reason: 'Falta la nota' }); return }
    if (text.length > MAX_NOTE) { result.problems.push({ row, reason: `La nota es demasiado larga (más de ${MAX_NOTE} caracteres)` }); return }
    const match = matchClient({ client: cell(r, cols.client), surname: cell(r, cols.surname), email: cell(r, cols.email), phone: cell(r, cols.phone) }, clients)
    if (!match.ok) { result.problems.push({ row, reason: match.reason }); return }
    result.entries.push({ clientId: match.client.id, clientName: `${match.client.name} ${match.client.surname}`.trim(), date, text })
  })

  result.entries.sort((a, b) => a.clientName.localeCompare(b.clientName, 'es') || a.date.localeCompare(b.date))
  result.clientsMatched = new Set(result.entries.map(e => e.clientId)).size
  return result
}

export const NOTES_HEADER = '— Historial anterior (importado) —'

const dmy = (iso: string) => iso.split('-').reverse().join('/')

/** La línea que se escribe en las notas de la ficha: «[01/09/2026] texto». */
export const noteLine = (e: { date: string; text: string }) => `[${dmy(e.date)}] ${e.text}`

/**
 * Añade a las notas que ya tiene la ficha las consultas importadas, por fecha, sin repetir las que ya estaban (así se puede
 * importar dos veces el mismo archivo sin duplicar) y sin tocar nada de lo que ya había escrito.
 */
export function mergeConsultationNotes(existing: string, entries: { date: string; text: string }[]): { text: string; added: number } {
  const current = existing.trimEnd()
  const fresh = [...entries].sort((a, b) => a.date.localeCompare(b.date)).map(noteLine).filter(line => !current.includes(line))
  if (fresh.length === 0) return { text: existing, added: 0 }
  const header = current.includes(NOTES_HEADER) ? '' : `${NOTES_HEADER}\n`
  const block = `${header}${fresh.join('\n')}`
  return { text: current ? `${current}\n\n${block}` : block, added: fresh.length }
}
