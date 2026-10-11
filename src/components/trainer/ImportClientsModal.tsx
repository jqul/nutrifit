import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { Upload, AlertTriangle } from 'lucide-react'
import { generateClientToken } from '../../lib/token'
import { detectColumns, readTable } from '../../lib/spreadsheet'
import { parseWeightKg } from '../../lib/weightInput'
import { toLocalISODate } from '../../lib/date'

interface ParsedClient {
  name: string; surname: string; phone: string; email: string
  goal: string; heightCm: string; gender: string; birthDate: string; allergies: string
  weightKg: string; goalWeightKg: string
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
  weightKg: ['peso', 'peso actual', 'peso (kg)', 'peso actual (kg)', 'weight', 'weight (kg)'],
  goalWeightKg: ['peso objetivo', 'peso objetivo (kg)', 'peso meta', 'objetivo de peso', 'goal weight'],
}

function rowsToClients(rows: string[][]): ParsedClient[] {
  if (rows.length === 0) return []
  const [header, ...dataRows] = rows
  const cols = detectColumns(header, HEADER_ALIASES)
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
      weightKg: cols.weightKg != null ? (r[cols.weightKg] || '').trim() : '',
      goalWeightKg: cols.goalWeightKg != null ? (r[cols.goalWeightKg] || '').trim() : '',
    }))
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
      const rows = await readTable(file)
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
    const weights = valid.map(c => parseWeightKg(c.weightKg))
    const goals = valid.map(c => parseWeightKg(c.goalWeightKg))
    const ignoredWeights = [...weights, ...goals].filter(w => w.status === 'invalid').length
    const rows = valid.map((c, i) => ({
      nutricionista_id: nutricionistaId,
      token: generateClientToken(),
      name: c.name, surname: c.surname, phone: c.phone, email: c.email || null,
      goal: c.goal || null, height_cm: c.heightCm ? parseFloat(c.heightCm) : null,
      gender: c.gender || null, birth_date: c.birthDate || null,
      allergies: c.allergies, notes: '', created_at: new Date().toISOString(),
      goal_weight_kg: goals[i].status === 'ok' ? goals[i].kg : null,
    }))
    const { data: created, error } = await supabase.from('clientes').insert(rows).select('id')
    if (error) { setImporting(false); toast('Error al importar: ' + error.message, 'warn'); return }
    // El peso de la hoja es su primer pesaje (con la fecha de hoy); para el historial hay otra importación.
    const today = toLocalISODate(new Date())
    const weightRows = (created ?? []).flatMap((row, i) => {
      const w = weights[i]
      return w && w.status === 'ok' ? [{ client_id: row.id, date: today, weight_kg: w.kg, note: '' }] : []
    })
    let weightsFailed = false
    if (weightRows.length > 0) {
      const { error: wErr } = await supabase.from('weight_logs').insert(weightRows)
      weightsFailed = !!wErr
    }
    setImporting(false)
    toast(`${valid.length} cliente${valid.length === 1 ? '' : 's'} importado${valid.length === 1 ? '' : 's'} ✓${weightsFailed ? ' (no se pudo guardar su peso: añádelo desde su ficha)' : ''}${ignoredWeights > 0 ? ` · ${ignoredWeights} peso${ignoredWeights === 1 ? '' : 's'} no válido${ignoredWeights === 1 ? '' : 's'} ignorado${ignoredWeights === 1 ? '' : 's'}` : ''}`, weightsFailed || ignoredWeights > 0 ? 'warn' : 'ok')
    onImported()
    onClose()
    reset()
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Importar clientes desde CSV o Excel">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Sube un archivo .csv o .xlsx con tus clientes. Reconocemos columnas como Nombre, Apellidos, Teléfono, Email,
          Objetivo, Altura, Género, Nacimiento, Alergias, Peso y Peso objetivo (en cualquier orden). Si ya tienen historial de peso,
          impórtalo después con «Importar historial de peso».
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
