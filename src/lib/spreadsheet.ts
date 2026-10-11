// Lectura de tablas que sube el nutricionista (CSV o Excel) para las importaciones. Todo en el navegador.

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const BOM = String.fromCharCode(0xfeff)

/**
 * Separador del archivo. El Excel en español exporta con punto y coma (porque la coma es el decimal: 72,5), el resto con
 * coma, y algunos con tabulador. Se decide por la primera línea, fuera de comillas.
 */
export function detectDelimiter(text: string): string {
  const firstLine = (text.startsWith(BOM) ? text.slice(1) : text).split(/\r?\n/, 1)[0] ?? ''
  const outside = firstLine.replace(/"[^"]*"/g, '')
  const counts = [';', '\t', ','].map(d => [d, outside.split(d).length - 1] as const)
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a))
  return best[1] > 0 ? best[0] : ','
}

/** Parser CSV sencillo con soporte de campos entre comillas (RFC4180 básico); el separador se detecta solo. */
export function parseCSV(input: string): string[][] {
  const text = input.startsWith(BOM) ? input.slice(1) : input
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === delimiter) { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* ignore */ }
    else field += c
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.length > 0)
}

export async function parseXLSX(file: File): Promise<string[][]> {
  // Import diferido: solo se descarga el parser de Excel si el nutricionista sube un .xlsx, para no engordar el
  // bundle principal con algo que la mayoría no usará (la mayoría exporta CSV desde su hoja de cálculo).
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  return rows.map(r => r.map(cell => String(cell ?? '')))
}

/** El archivo (.csv, .xlsx o .xls) como tabla de texto: la primera fila son las cabeceras. */
export async function readTable(file: File): Promise<string[][]> {
  return /\.xlsx?$/i.test(file.name) ? parseXLSX(file) : parseCSV(await file.text())
}

/** Posición de cada campo según los nombres de columna admitidos (sin acentos ni mayúsculas); ausente si no hay columna. */
export function detectColumns<K extends string>(headers: string[], aliases: Record<K, string[]>): Partial<Record<K, number>> {
  const normalized = headers.map(h => stripAccents(h.trim().toLowerCase()))
  const map: Partial<Record<K, number>> = {}
  ;(Object.keys(aliases) as K[]).forEach(field => {
    const idx = normalized.findIndex(h => aliases[field].some(alias => stripAccents(alias) === h))
    if (idx !== -1) map[field] = idx
  })
  return map
}
