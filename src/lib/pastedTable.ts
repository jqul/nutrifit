// "Pegar la tabla": para cuando los datos están en un PDF, una web u otro sitio del que no se puede subir un archivo. El
// nutricionista selecciona la tabla, la copia y la pega; aquí se convierte en filas y columnas, y la pantalla de
// importación la enseña para que se compruebe antes de guardar nada.
import { parseCSV, stripAccents } from './spreadsheet'

const DATE = String.raw`\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}`
const WEIGHT = String.raw`\d{2,3}(?:[.,]\d{1,2})?`
const LINE_RE = new RegExp(String.raw`^(.+?)[\s;,|]+(${DATE})[\s;,|]+(${WEIGHT})\s*(?:kg)?$`, 'i')
const DATE_ONLY = new RegExp(`^(?:${DATE})$`)
const WEIGHT_ONLY = new RegExp(String.raw`^(?:${WEIGHT})\s*(?:kg)?$`, 'i')

const clean = (text: string) => text.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim() !== '')

/**
 * Una tabla pegada como filas de celdas. Entiende lo que sale de copiar de Excel o Google Sheets (tabuladores), de un CSV
 * (coma, punto y coma o tabulador, con la decimal en coma) y de la mayoría de PDF, donde las columnas se separan con
 * varios espacios.
 */
export function parsePastedTable(text: string): string[][] {
  const lines = clean(text)
  if (lines.length === 0) return []
  const first = lines[0]
  if (/[\t;]/.test(first)) return parseCSV(lines.join('\n'))
  if (/\S {2,}\S/.test(first)) return lines.map(l => l.trim().split(/ {2,}/))
  if (first.includes(',')) return parseCSV(lines.join('\n'))
  return lines.map(l => [l.trim()])
}

const norm = (s: string) => stripAccents(s).toLowerCase()

/**
 * El historial de peso pegado. Además de una tabla con cabeceras, acepta lo que suele salir de un PDF sin ellas: una
 * línea por pesaje («Laura Gómez 01/09/2026 70,5 kg») o cada dato en su propia línea (nombre, fecha, peso, nombre…).
 * Devuelve siempre una tabla con cabeceras Cliente, Fecha y Peso (kg) cuando ha podido entenderlo.
 */
export function parsePastedHistory(text: string): string[][] {
  const table = parsePastedTable(text)
  if (table.length === 0) return []
  const header = table[0].map(norm)
  if (header.some(h => h.includes('fecha')) && header.some(h => h.includes('peso') || h === 'kg')) return table

  const lines = clean(text)
  const rows: string[][] = []
  for (const l of lines) {
    const m = LINE_RE.exec(l.trim())
    if (m) rows.push([m[1].trim(), m[2], m[3]])
  }
  if (rows.length > 0 && rows.length >= lines.length * 0.8) return [['Cliente', 'Fecha', 'Peso (kg)'], ...rows]

  // Cada dato en su línea: un nombre, luego fechas con su peso debajo, hasta el siguiente nombre.
  const stream: string[][] = []
  let name = ''
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (DATE_ONLY.test(t)) {
      const next = (lines[i + 1] ?? '').trim()
      if (name && WEIGHT_ONLY.test(next)) { stream.push([name, t, next.replace(/\s*kg$/i, '')]); i++ }
    } else if (!WEIGHT_ONLY.test(t)) name = t
  }
  if (stream.length > 0) return [['Cliente', 'Fecha', 'Peso (kg)'], ...stream]
  return table
}
