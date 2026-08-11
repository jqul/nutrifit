import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { Upload, AlertTriangle } from 'lucide-react'

interface ParsedClient {
  name: string; surname: string; phone: string; email: string
  goal: string; heightCm: string; gender: string; birthDate: string; allergies: string
}

// Alias de cabeceras aceptadas (en minúsculas, sin acentos) por cada campo — para
// admitir plantillas en español o inglés sin obligar a un formato exacto.
const HEADER_ALIASES: Record<keyof ParsedClient, string[]> = {
  name: ['nombre', 'name', 'first name', 'firstname'],
  surname: ['apellidos', 'apellido', 'surname', 'last name', 'lastname'],
  phone: ['telefono', 'teléfono', 'phone', 'movil', 'móvil'],
  email: ['email', 'correo', 'e-mail'],
  goal: ['objetivo', 'goal'],
  heightCm: ['altura', 'height', 'altura (cm)', 'height (cm)'],
  gender: ['genero', 'género', 'gender', 'sexo'],
  birthDate: ['nacimiento', 'fecha de nacimiento', 'birth date', 'birthdate', 'dob'],
  allergies: ['alergias', 'allergies', 'alergias / intolerancias'],
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function detectColumns(headers: string[]): Partial<Record<keyof ParsedClient, number>> {
  const normalized = headers.map(h => stripAccents(h.trim().toLowerCase()))
  const map: Partial<Record<keyof ParsedClient, number>> = {}
  ;(Object.keys(HEADER_ALIASES) as (keyof ParsedClient)[]).forEach(field => {
    const idx = normalized.findIndex(h => HEADER_ALIASES[field].some(alias => stripAccents(alias) === h))
    if (idx !== -1) map[field] = idx
  })
  return map
}

function rowsToClients(rows: string[][]): ParsedClient[] {
  if (rows.length === 0) return []
  const [header, ...dataRows] = rows
  const cols = detectColumns(header)
  return dataRows
    .filter(r => r.some(cell => (cell || '').trim() !== ''))
    .map(r => ({
      name: cols.name != null ? (r[cols.name] || '').trim() : '',
      surname: cols.surname != null ? (r[cols.surname] || '').trim() : '',
      phone: cols.phone != null ? (r[cols.phone] || '').trim() : '',
      email: cols.email != null ? (r[cols.email] || '').trim() : '',
      goal: cols.goal != null ? (r[cols.goal] || '').trim() : '',
      heightCm: cols.heightCm != null ? (r[cols.heightCm] || '').trim() : '',
      gender: cols.gender != null ? (r[cols.gender] || '').trim() : '',
      birthDate: cols.birthDate != null ? (r[cols.birthDate] || '').trim() : '',
      allergies: cols.allergies != null ? (r[cols.allergies] || '').trim() : '',
    }))
}

/** Parser CSV sencillo con soporte de campos entre comillas (RFC4180 básico). */
function parseCSV(text: string): string[][] {
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
    else if (c === ',' || c === ';') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* ignore */ }
    else field += c
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.length > 0)
}

async function parseXLSX(file: File): Promise<string[][]> {
  // Import diferido: solo se descarga el parser de Excel si el nutricionista
  // sube un .xlsx, para no engordar el bundle principal con algo que la
  // mayoría no usará (la mayoría exporta CSV desde su hoja de cálculo).
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  return rows.map(r => r.map(cell => String(cell ?? '')))
}

export function ImportClientsModal({ open, onClose, nutricionistaId, demoMode, onImported }: {
  open: boolean
  onClose: () => void
  nutricionistaId: string
  demoMode?: boolean
  onImported: () => void
}) {
  const [parsed, setParsed] = useState<ParsedClient[]>([])
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [parseError, setParseError] = useState('')

  const reset = () => { setParsed([]); setFileName(''); setParseError('') }

  const handleFile = async (file: File) => {
    setParsing(true); setParseError(''); setFileName(file.name)
    try {
      const isExcel = /\.xlsx?$/i.test(file.name)
      const rows = isExcel ? await parseXLSX(file) : parseCSV(await file.text())
      const clients = rowsToClients(rows)
      if (clients.length === 0) { setParseError('No se ha encontrado ninguna fila con datos.'); setParsed([]); return }
      if (!clients.some(c => c.name)) {
        setParseError('No se ha reconocido una columna de "Nombre" — revisa las cabeceras del archivo.')
      }
      setParsed(clients)
    } catch (e) {
      setParseError('No se ha podido leer el archivo. Prueba a exportarlo de nuevo como CSV o .xlsx.')
      console.error(e)
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    const valid = parsed.filter(c => c.name)
    if (valid.length === 0) { toast('No hay clientes válidos que importar', 'warn'); return }
    if (demoMode) { toast(`Modo demo: se importarían ${valid.length} clientes (no se guarda)`, 'ok'); onClose(); reset(); return }
    setImporting(true)
    const rows = valid.map(c => ({
      nutricionista_id: nutricionistaId,
      token: Math.random().toString(36).slice(2, 14),
      name: c.name, surname: c.surname, phone: c.phone, email: c.email || null,
      goal: c.goal || null, height_cm: c.heightCm ? parseFloat(c.heightCm) : null,
      gender: c.gender || null, birth_date: c.birthDate || null,
      allergies: c.allergies, notes: '', created_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('clientes').insert(rows)
    setImporting(false)
    if (error) { toast('Error al importar: ' + error.message, 'warn'); return }
    toast(`${valid.length} cliente${valid.length === 1 ? '' : 's'} importado${valid.length === 1 ? '' : 's'} ✓`, 'ok')
    onImported()
    onClose()
    reset()
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Importar clientes desde CSV o Excel">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Sube un archivo .csv o .xlsx con tus clientes. Reconocemos columnas como Nombre, Apellidos, Teléfono, Email,
          Objetivo, Altura, Género, Nacimiento y Alergias (en cualquier orden).
        </p>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-8 cursor-pointer hover:border-accent/40 hover:bg-bg-alt transition-colors">
          <Upload className="w-6 h-6 text-muted" />
          <span className="text-sm font-medium">{fileName || 'Selecciona un archivo .csv o .xlsx'}</span>
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </label>

        {parsing && <p className="text-sm text-muted">Leyendo archivo...</p>}
        {parseError && (
          <p className="text-sm text-warn flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {parseError}</p>
        )}

        {parsed.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Vista previa — {parsed.filter(c => c.name).length} de {parsed.length} fila{parsed.length === 1 ? '' : 's'} con nombre válido
            </p>
            <div className="max-h-56 overflow-y-auto border border-border rounded-xl divide-y divide-border">
              {parsed.slice(0, 50).map((c, i) => (
                <div key={i} className={`px-3 py-2 text-xs flex items-center justify-between gap-2 ${!c.name ? 'text-muted line-through' : ''}`}>
                  <span className="font-medium">{c.name || '(sin nombre)'} {c.surname}</span>
                  <span className="text-muted flex-shrink-0">{c.phone || c.email || '—'}</span>
                </div>
              ))}
            </div>
            {parsed.length > 50 && <p className="text-xs text-muted">Mostrando las primeras 50 de {parsed.length} filas.</p>}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleImport} loading={importing} disabled={parsed.filter(c => c.name).length === 0}>
            Importar {parsed.filter(c => c.name).length > 0 ? `${parsed.filter(c => c.name).length} clientes` : ''}
          </Button>
          <Button variant="ghost" onClick={() => { onClose(); reset() }}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
