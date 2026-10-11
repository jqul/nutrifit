import { useState } from 'react'
import { Upload, AlertTriangle, Download, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { readTable } from '../../lib/spreadsheet'
import { parseWeightHistory, HistoryParse, ImportClient } from '../../lib/weightHistoryImport'

const BATCH = 500

const TEMPLATE = 'Cliente;Fecha;Peso (kg)\nLaura Gómez;01/09/2026;70,5\nLaura Gómez;15/09/2026;69,8\nCarlos Ruiz;01/09/2026;80\n'

function downloadTemplate() {
  // BOM para que Excel en español abra bien las tildes.
  const blob = new Blob(['﻿' + TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'plantilla-historial-de-peso.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Para los clientes que ya tenían un seguimiento antes de NutriFit: sube su historial de peso (CSV o Excel) y queda en
 * su ficha y en su gráfica, para seguir su evolución hacia el objetivo desde el principio. Los pesajes que ya existen no se pisan.
 */
export function ImportWeightHistoryModal({ open, onClose, clients, demoMode, onImported }: {
  open: boolean
  onClose: () => void
  clients: ImportClient[]
  demoMode?: boolean
  onImported: () => void
}) {
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<HistoryParse | null>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  const reset = () => { setFileName(''); setResult(null); setError('') }
  const close = () => { onClose(); reset() }

  const handleFile = async (file: File) => {
    setError(''); setResult(null); setFileName(file.name)
    try {
      setResult(parseWeightHistory(await readTable(file), clients))
    } catch (e) {
      console.error(e)
      setError('No se ha podido leer el archivo. Prueba a exportarlo de nuevo como CSV o .xlsx.')
    }
  }

  const handleImport = async () => {
    if (!result || result.entries.length === 0) return
    if (demoMode) { toast(`Modo demo: se importarían ${result.entries.length} pesajes (no se guarda)`, 'ok'); close(); return }
    setImporting(true)
    let inserted = 0
    for (let i = 0; i < result.entries.length; i += BATCH) {
      const rows = result.entries.slice(i, i + BATCH).map(e => ({ client_id: e.clientId, date: e.date, weight_kg: e.weightKg, note: '' }))
      // Sin pisar lo que ya hay: si un cliente ya tiene un pesaje ese día, se respeta el suyo.
      const { data, error: err } = await supabase.from('weight_logs').upsert(rows, { onConflict: 'client_id,date', ignoreDuplicates: true }).select('id')
      if (err) {
        setImporting(false)
        toast(`Error al importar: ${err.message}${inserted > 0 ? ` (ya se habían guardado ${inserted})` : ''}`, 'warn')
        return
      }
      inserted += data?.length ?? 0
    }
    setImporting(false)
    const skipped = result.entries.length - inserted
    toast(`${inserted} pesaje${inserted === 1 ? '' : 's'} importado${inserted === 1 ? '' : 's'} ✓${skipped > 0 ? ` (${skipped} ya existían y se han respetado)` : ''}`, 'ok')
    onImported()
    close()
  }

  const ready = result && result.missingColumns.length === 0 && result.entries.length > 0

  return (
    <Modal open={open} onClose={close} title="Importar historial de peso">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Para clientes que ya tenías antes de NutriFit: sube un archivo .csv o .xlsx con una fila por pesaje, con las columnas
          <strong className="text-ink"> Cliente</strong> (nombre y apellidos, o email, o teléfono), <strong className="text-ink">Fecha</strong> y
          <strong className="text-ink"> Peso (kg)</strong>. Los clientes tienen que estar ya creados.
        </p>
        <button type="button" onClick={downloadTemplate} className="flex items-center gap-1.5 text-sm font-semibold text-accent">
          <Download className="w-4 h-4" /> Descargar plantilla de ejemplo
        </button>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-8 cursor-pointer hover:border-accent/40 hover:bg-bg-alt transition-colors">
          <Upload className="w-6 h-6 text-muted" />
          <span className="text-sm font-medium">{fileName || 'Selecciona un archivo .csv o .xlsx'}</span>
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </label>

        {error && <p className="text-sm text-warn flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {error}</p>}

        {result && result.missingColumns.length > 0 && (
          <p className="text-sm text-warn flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>No encuentro estas columnas en la primera fila: <strong>{result.missingColumns.join(', ')}</strong>. Revisa las cabeceras o usa la plantilla.</span>
          </p>
        )}

        {result && result.missingColumns.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm flex items-center gap-1.5">
              <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${result.entries.length > 0 ? 'text-ok' : 'text-muted'}`} />
              <span><strong>{result.entries.length}</strong> pesaje{result.entries.length === 1 ? '' : 's'} de <strong>{result.clientsMatched}</strong> cliente{result.clientsMatched === 1 ? '' : 's'} listos para importar
                {result.duplicatesInFile > 0 && <span className="text-muted"> · {result.duplicatesInFile} repetido{result.duplicatesInFile === 1 ? '' : 's'} en el archivo (me quedo con el último)</span>}.</span>
            </p>
            {result.entries.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                {result.entries.slice(0, 30).map((e, i) => (
                  <div key={i} className="px-3 py-1.5 text-xs flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{e.clientName}</span>
                    <span className="text-muted flex-shrink-0">{new Date(e.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })} · {String(e.weightKg).replace('.', ',')} kg</span>
                  </div>
                ))}
              </div>
            )}
            {result.entries.length > 30 && <p className="text-xs text-muted">Mostrando los primeros 30 de {result.entries.length}.</p>}
            {result.problems.length > 0 && (
              <div className="rounded-xl bg-warn/10 px-3 py-2.5 space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-warn">{result.problems.length} fila{result.problems.length === 1 ? '' : 's'} sin importar</p>
                <ul className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
                  {result.problems.slice(0, 20).map((p, i) => <li key={i}><span className="font-semibold">Fila {p.row}:</span> {p.reason}</li>)}
                </ul>
                {result.problems.length > 20 && <p className="text-xs text-muted">… y {result.problems.length - 20} más.</p>}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleImport} loading={importing} disabled={!ready}>
            {ready ? `Importar ${result!.entries.length} pesajes` : 'Importar'}
          </Button>
          <Button variant="ghost" onClick={close}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
