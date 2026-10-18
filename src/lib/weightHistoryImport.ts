// Importar el historial de peso que un cliente ya tenía antes de usar NutriFit (una hoja de cálculo del nutricionista),
// para poder seguir su evolución y su objetivo desde el primer día. Reconoce las columnas por su nombre y empareja cada
// fila con un cliente existente por email, teléfono o nombre.
import { detectColumns } from './spreadsheet'
import { CLIENT_ID_ALIASES, ImportClient, matchClient } from './clientMatch'
import { parseWeightKg } from './weightInput'

export type { ImportClient } from './clientMatch'
export interface HistoryEntry { clientId: string; clientName: string; date: string; weightKg: number }
export interface HistoryProblem { /** Número de fila en el archivo (la primera de datos es la 2). */ row: number; reason: string }
export interface HistoryParse {
  entries: HistoryEntry[]
  problems: HistoryProblem[]
  /** Qué falta en el archivo para poder leerlo (vacío si se ha reconocido todo). */
  missingColumns: string[]
  clientsMatched: number
  /** Filas del archivo que repetían un cliente y una fecha (se queda la última). */
  duplicatesInFile: number
}

const ALIASES = {
  ...CLIENT_ID_ALIASES,
  date: ['fecha', 'date', 'dia'],
  weight: ['peso', 'peso (kg)', 'kg', 'weight', 'weight (kg)'],
}


const pad = (n: number) => String(n).padStart(2, '0')
function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** "2026-10-03", "3/10/2026", "03-10-26" (el día va primero, como en España) o un número de fecha de Excel → "2026-10-03". */
export function parseDateCell(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(t)
  if (m) return isRealDate(+m[1], +m[2], +m[3]) ? `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` : null
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t)
  if (m) {
    const year = m[3].length === 2 ? (+m[3] < 70 ? 2000 + +m[3] : 1900 + +m[3]) : +m[3]
    return isRealDate(year, +m[2], +m[1]) ? `${year}-${pad(+m[2])}-${pad(+m[1])}` : null
  }
  // Excel guarda las fechas como días desde el 30-dic-1899.
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const serial = Math.floor(parseFloat(t))
    if (serial < 20000 || serial > 80000) return null
    const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
  }
  return null
}

/** Convierte la tabla del archivo (primera fila = cabeceras) en pesajes listos para guardar, con lo que no se ha podido leer. */
export function parseWeightHistory(rows: string[][], clients: ImportClient[], today: Date = new Date()): HistoryParse {
  const result: HistoryParse = { entries: [], problems: [], missingColumns: [], clientsMatched: 0, duplicatesInFile: 0 }
  if (rows.length === 0) { result.missingColumns = ['cabeceras']; return result }
  const cols = detectColumns(rows[0], ALIASES)
  if (cols.date == null) result.missingColumns.push('Fecha')
  if (cols.weight == null) result.missingColumns.push('Peso')
  if (cols.client == null && cols.email == null && cols.phone == null) result.missingColumns.push('Cliente (nombre, email o teléfono)')
  if (result.missingColumns.length > 0) return result

  const cell = (r: string[], i: number | undefined) => (i == null ? '' : (r[i] ?? '')).toString().trim()
  const tomorrow = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const byKey = new Map<string, HistoryEntry>()

  rows.slice(1).forEach((r, i) => {
    if (!r.some(c => (c ?? '').toString().trim() !== '')) return
    const row = i + 2
    const date = parseDateCell(cell(r, cols.date))
    if (!date) { result.problems.push({ row, reason: `Fecha no válida («${cell(r, cols.date)}»)` }); return }
    const [y, mo, d] = date.split('-').map(Number)
    if (Date.UTC(y, mo - 1, d) > tomorrow) { result.problems.push({ row, reason: `La fecha ${date} es futura` }); return }
    if (y < 1990) { result.problems.push({ row, reason: `La fecha ${date} es demasiado antigua` }); return }
    const w = parseWeightKg(cell(r, cols.weight))
    if (w.status !== 'ok') {
      result.problems.push({ row, reason: w.status === 'empty' ? 'Falta el peso' : `Peso no válido («${cell(r, cols.weight)}»: entre 20 y 400 kg)` })
      return
    }
    const match = matchClient({ client: cell(r, cols.client), surname: cell(r, cols.surname), email: cell(r, cols.email), phone: cell(r, cols.phone) }, clients)
    if (!match.ok) { result.problems.push({ row, reason: match.reason }); return }
    const key = `${match.client.id}|${date}`
    if (byKey.has(key)) result.duplicatesInFile++
    byKey.set(key, { clientId: match.client.id, clientName: `${match.client.name} ${match.client.surname}`.trim(), date, weightKg: w.kg })
  })

  result.entries = [...byKey.values()].sort((a, b) => a.clientName.localeCompare(b.clientName, 'es') || a.date.localeCompare(b.date))
  result.clientsMatched = new Set(result.entries.map(e => e.clientId)).size
  return result
}
