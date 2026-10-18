// Importar analíticas que el nutricionista ya tenía de un cliente: una fila por resultado (cliente, fecha, marcador, valor) o
// una fila por analítica con una columna por marcador. Solo los marcadores que NutriFit conoce, y en sus unidades: si la hoja
// trae otra unidad no se convierte (sería adivinar): se avisa para que se corrija antes.
import { detectColumns, stripAccents } from './spreadsheet'
import { CLIENT_ID_ALIASES, ImportClient, matchClient } from './clientMatch'
import { parseDateCell } from './weightHistoryImport'
import { BLOOD_MARKER_MAP, BLOOD_MARKERS } from './bloodMarkers'

export interface LabEntry { clientId: string; clientName: string; date: string; markerKey: string; value: number }
export interface LabsParse {
  entries: LabEntry[]
  problems: { row: number; reason: string }[]
  missingColumns: string[]
  clientsMatched: number
  duplicatesInFile: number
}

/** Cómo se suele llamar cada marcador en una hoja (sin acentos, en minúsculas). */
export const MARKER_ALIASES: Record<string, string[]> = {
  glucosa: ['glucosa', 'glucemia', 'glucosa ayunas', 'glucosa en ayunas', 'glucose'],
  colesterol_total: ['colesterol total', 'colesterol', 'col total', 'cholesterol', 'total cholesterol'],
  ldl: ['ldl', 'colesterol ldl', 'ldl colesterol', 'ldl-c', 'ldl colesterol malo'],
  hdl: ['hdl', 'colesterol hdl', 'hdl colesterol', 'hdl-c', 'hdl colesterol bueno'],
  trigliceridos: ['trigliceridos', 'triglicerido', 'triglycerides', 'tg'],
  got_ast: ['got', 'ast', 'got ast', 'ast got', 'got/ast', 'ast/got', 'transaminasa got', 'transaminasas got'],
  gpt_alt: ['gpt', 'alt', 'gpt alt', 'alt gpt', 'gpt/alt', 'alt/gpt', 'transaminasa gpt', 'transaminasas gpt'],
  hierro: ['hierro', 'iron', 'fe', 'hierro serico'],
  vitamina_d: ['vitamina d', 'vit d', 'vit. d', '25-oh vitamina d', '25 oh vitamina d', 'vitamina d 25-oh', 'vitamin d', '25(oh)d', '25-oh d'],
  tsh: ['tsh', 'tirotropina'],
}

const norm = (s: string) => stripAccents(s).toLowerCase().replace(/\s+/g, ' ').trim()
const unitNorm = (u: string) => u.toLowerCase().replace(/[µμ]/g, 'u').replace(/\s+/g, '')

const KEY_BY_ALIAS = new Map<string, string>()
for (const [key, aliases] of Object.entries(MARKER_ALIASES)) for (const a of aliases) KEY_BY_ALIAS.set(norm(a), key)
for (const m of BLOOD_MARKERS) KEY_BY_ALIAS.set(norm(m.label), m.key)

/** El marcador de NutriFit al que corresponde un nombre de la hoja, y la unidad que traía entre paréntesis (si la traía). */
export function markerOf(label: string): { key: string; unit: string } | null {
  const unit = /\(([^)]*)\)/.exec(label)?.[1]?.trim() ?? ''
  const direct = KEY_BY_ALIAS.get(norm(label))
  if (direct) return { key: direct, unit: '' }
  const bare = KEY_BY_ALIAS.get(norm(label.replace(/\([^)]*\)/g, '')))
  return bare ? { key: bare, unit } : null
}

const unitMatches = (given: string, key: string) => !given || unitNorm(given) === unitNorm(BLOOD_MARKER_MAP[key].unit)

const ALIASES = {
  ...CLIENT_ID_ALIASES,
  date: ['fecha', 'date', 'dia'],
  marker: ['marcador', 'analisis', 'parametro', 'prueba', 'determinacion', 'marker', 'test'],
  value: ['valor', 'resultado', 'value', 'result'],
  unit: ['unidad', 'unidades', 'unit'],
}

export function parseLabResults(rows: string[][], clients: ImportClient[], today: Date = new Date()): LabsParse {
  const result: LabsParse = { entries: [], problems: [], missingColumns: [], clientsMatched: 0, duplicatesInFile: 0 }
  if (rows.length === 0) { result.missingColumns = ['cabeceras']; return result }
  const header = rows[0]
  const cols = detectColumns(header, ALIASES)
  if (cols.date == null) result.missingColumns.push('Fecha')
  if (cols.client == null && cols.email == null && cols.phone == null) result.missingColumns.push('Cliente (nombre, email o teléfono)')
  const longFormat = cols.marker != null && cols.value != null

  // Formato ancho: una columna por marcador (Glucosa, Colesterol total…).
  const idCols = new Set([cols.client, cols.surname, cols.email, cols.phone, cols.date].filter((c): c is number => c != null))
  const wideCols = header.map((h, i) => ({ i, m: idCols.has(i) ? null : markerOf(h) })).filter(c => c.m) as { i: number; m: { key: string; unit: string } }[]
  if (!longFormat && wideCols.length === 0) result.missingColumns.push('Marcador y Valor (o una columna por marcador, como Glucosa)')
  if (result.missingColumns.length > 0) return result

  const cell = (r: string[], i: number | undefined) => (i == null ? '' : (r[i] ?? '')).toString().trim()
  const tomorrow = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const byKey = new Map<string, LabEntry>()

  const add = (row: number, who: ImportClient, date: string, key: string, rawValue: string, unit: string) => {
    if (!unitMatches(unit, key)) {
      result.problems.push({ row, reason: `${BLOOD_MARKER_MAP[key].label}: la unidad «${unit}» no es la de NutriFit (${BLOOD_MARKER_MAP[key].unit}); conviértelo antes de importar` }); return
    }
    const text = rawValue.trim().replace(',', '.')
    if (text === '') return   // celda vacía: ese marcador no se midió
    const value = /^\d+(\.\d+)?$/.test(text) ? parseFloat(text) : NaN
    if (!Number.isFinite(value) || value > 100000) { result.problems.push({ row, reason: `${BLOOD_MARKER_MAP[key].label}: valor no válido («${rawValue}»)` }); return }
    const k = `${who.id}|${date}|${key}`
    if (byKey.has(k)) result.duplicatesInFile++
    byKey.set(k, { clientId: who.id, clientName: `${who.name} ${who.surname}`.trim(), date, markerKey: key, value })
  }

  rows.slice(1).forEach((r, idx) => {
    if (!r.some(c => (c ?? '').toString().trim() !== '')) return
    const row = idx + 2
    const date = parseDateCell(cell(r, cols.date))
    if (!date) { result.problems.push({ row, reason: `Fecha no válida («${cell(r, cols.date)}»)` }); return }
    const [y, m, d] = date.split('-').map(Number)
    if (Date.UTC(y, m - 1, d) > tomorrow) { result.problems.push({ row, reason: `La fecha ${date} es futura` }); return }
    const match = matchClient({ client: cell(r, cols.client), surname: cell(r, cols.surname), email: cell(r, cols.email), phone: cell(r, cols.phone) }, clients)
    if (!match.ok) { result.problems.push({ row, reason: match.reason }); return }

    if (longFormat) {
      const label = cell(r, cols.marker)
      const found = markerOf(label)
      if (!found) { result.problems.push({ row, reason: `Marcador «${label}» no admitido por NutriFit (de momento solo: ${BLOOD_MARKERS.map(b => b.label.replace(/ \(.*/, '')).join(', ')})` }); return }
      add(row, match.client, date, found.key, cell(r, cols.value), cell(r, cols.unit) || found.unit)
    } else {
      for (const c of wideCols) add(row, match.client, date, c.m.key, cell(r, c.i), c.m.unit)
    }
  })

  result.entries = [...byKey.values()].sort((a, b) => a.clientName.localeCompare(b.clientName, 'es') || a.date.localeCompare(b.date) || a.markerKey.localeCompare(b.markerKey))
  result.clientsMatched = new Set(result.entries.map(e => e.clientId)).size
  return result
}
