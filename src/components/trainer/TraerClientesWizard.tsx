import { useMemo, useState } from 'react'
import { Upload, AlertTriangle, Download, CheckCircle2, Copy, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { generateClientToken } from '../../lib/token'
import { toLocalISODate } from '../../lib/date'
import { readTable } from '../../lib/spreadsheet'
import { parsePastedTable, parsePastedHistory } from '../../lib/pastedTable'
import { parseWeightKg } from '../../lib/weightInput'
import { parseWeightHistory } from '../../lib/weightHistoryImport'
import type { ImportClient } from '../../lib/clientMatch'
import { parseConsultationNotes, mergeConsultationNotes } from '../../lib/consultationNotesImport'
import { parseLabResults } from '../../lib/labResultsImport'
import { fetchAllRowsForIds } from '../../lib/fetchAll'
import {
  CLIENT_TEMPLATE, HISTORY_TEMPLATE, NOTES_TEMPLATE, LABS_TEMPLATE, ClientRowReview, hasNameColumn, reviewClientRows, rowsToClients,
} from '../../lib/clientImport'

const BATCH = 500
type Step = 'clientes' | 'historial' | 'confirmar' | 'hecho'
type DsKey = 'peso' | 'notas' | 'analiticas'

interface DsState { file: string; table: string[][] | null; error: string }
const EMPTY_DS: DsState = { file: '', table: null, error: '' }

/** Lo que enseña cada bloque de historial una vez leído el archivo. */
interface DsSummary { missing: string[]; count: number; clients: number; problems: { row: number; reason: string }[]; note?: string }

interface Result {
  created: number
  alreadyExisted: number
  weights: { inserted: number; already: number }
  notes: { clients: number; lines: number; already: number }
  labs: { inserted: number; already: number }
  links: { name: string; url: string }[]
  /** Lo que no se ha podido guardar (el resto sí se guardó). */
  errors: string[]
}

function downloadCsv(name: string, content: string) {
  // BOM para que Excel en español abra bien las tildes.
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function FileDrop({ fileName, onFile }: { fileName: string; onFile: (f: File) => void }) {
  return (
    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-5 cursor-pointer hover:border-accent/40 hover:bg-bg-alt transition-colors">
      <Upload className="w-5 h-5 text-muted" />
      <span className="text-sm font-medium">{fileName || 'Elige un archivo .csv o .xlsx'}</span>
      <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
    </label>
  )
}

/** Para datos que están en un PDF o en otro sitio sin archivo que subir: se pega la tabla y se enseña antes de guardar nada. */
function PasteBox({ onUse, headers }: { onUse: (text: string) => void; headers: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-accent text-left">¿Está en un PDF o no tienes archivo? Pega la tabla</button>
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Abre el PDF (o la hoja), <strong className="text-ink">selecciona la tabla, cópiala y pégala aquí</strong>{headers}. Después la compruebas antes de guardar nada.</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={6} aria-label="Tabla pegada" spellCheck={false}
        className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-y" />
      <div className="flex gap-2">
        <Button onClick={() => onUse(text)} disabled={!text.trim()}>Usar esta tabla</Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setText('') }}>Cancelar</Button>
      </div>
    </div>
  )
}

/** Un tipo de historial (peso, notas, analíticas): se despliega, se sube o se pega, y enseña lo entendido y lo que no. */
function DatasetBlock({ title, hint, unit, template, pasteHeaders, parsePaste, state, summary, onFile, onTable }: {
  title: string
  hint: React.ReactNode
  unit: [string, string]
  template: { file: string; content: string }
  pasteHeaders: string
  parsePaste: (text: string) => string[][]
  state: DsState
  summary: DsSummary | null
  onFile: (f: File) => void
  onTable: (table: string[][], label: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ready = !!summary && summary.missing.length === 0
  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-alt/50 transition-colors">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block text-xs text-muted">
            {ready ? <span className="text-ok font-semibold">{summary!.count} {summary!.count === 1 ? unit[0] : unit[1]} de {summary!.clients} cliente{summary!.clients === 1 ? '' : 's'}</span> : state.file ? 'Revisa el archivo' : 'Opcional'}
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
          <p className="text-sm text-muted">{hint}</p>
          <button type="button" onClick={() => downloadCsv(template.file, template.content)} className="flex items-center gap-1.5 text-sm font-semibold text-accent">
            <Download className="w-4 h-4" /> Descargar plantilla de ejemplo
          </button>
          <FileDrop fileName={state.file} onFile={onFile} />
          <PasteBox onUse={text => onTable(parsePaste(text), 'Tabla pegada')} headers={pasteHeaders} />
          {state.error && <p className="text-sm text-warn flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {state.error}</p>}
          {summary && summary.missing.length > 0 && (
            <p className="text-sm text-warn flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>No encuentro estas columnas en la primera fila: <strong>{summary.missing.join(', ')}</strong>.</span></p>
          )}
          {ready && (
            <div className="space-y-2">
              <p className="text-sm flex items-center gap-1.5">
                <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${summary!.count > 0 ? 'text-ok' : 'text-muted'}`} />
                <span><strong>{summary!.count}</strong> {summary!.count === 1 ? unit[0] : unit[1]} de <strong>{summary!.clients}</strong> cliente{summary!.clients === 1 ? '' : 's'}
                  {summary!.note && <span className="text-muted"> · {summary!.note}</span>}</span>
              </p>
              {summary!.problems.length > 0 && (
                <div className="rounded-xl bg-warn/10 px-3 py-2.5 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-warn">{summary!.problems.length} fila{summary!.problems.length === 1 ? '' : 's'} sin importar</p>
                  <ul className="text-xs space-y-0.5 max-h-28 overflow-y-auto">
                    {summary!.problems.slice(0, 15).map((p, i) => <li key={i}><span className="font-semibold">Fila {p.row}:</span> {p.reason}</li>)}
                  </ul>
                  {summary!.problems.length > 15 && <p className="text-xs text-muted">… y {summary!.problems.length - 15} más.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const STEP_INDEX: Record<Step, number> = { clientes: 1, historial: 2, confirmar: 3, hecho: 3 }
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * "Traer clientes": un solo recorrido para pasar a NutriFit a quien ya llevabas en hojas de cálculo.
 * 1) sus fichas, 2) su historial (peso, notas de consulta y analíticas; todo opcional), 3) comprobar y confirmar.
 * Se puede traer solo los clientes o solo el historial de los que ya existen.
 */
export function TraerClientesWizard({ open, onClose, nutricionistaId, existingClients, demoMode, onImported }: {
  open: boolean
  onClose: () => void
  nutricionistaId: string
  existingClients: ImportClient[]
  demoMode?: boolean
  onImported: () => void
}) {
  const [step, setStep] = useState<Step>('clientes')
  const [clientsFile, setClientsFile] = useState('')
  const [clientRows, setClientRows] = useState<ClientRowReview[] | null>(null)
  const [clientsError, setClientsError] = useState('')
  const [ds, setDs] = useState<Record<DsKey, DsState>>({ peso: EMPTY_DS, notas: EMPTY_DS, analiticas: EMPTY_DS })
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const reset = () => {
    setStep('clientes'); setClientsFile(''); setClientRows(null); setClientsError('')
    setDs({ peso: EMPTY_DS, notas: EMPTY_DS, analiticas: EMPTY_DS }); setResult(null); setWorking(false)
  }
  const close = () => { onClose(); reset() }

  const toCreate = useMemo(() => (clientRows ?? []).filter(r => r.status === 'new').map(r => r.row), [clientRows])
  const alreadyExisting = (clientRows ?? []).filter(r => r.status === 'exists').length
  const ignoredNoName = (clientRows ?? []).filter(r => r.status === 'no-name').length

  // Cada fila del historial se empareja con los clientes que ya existen y con los que se van a crear ahora.
  const pool = useMemo<ImportClient[]>(() => [
    ...existingClients,
    ...toCreate.map((c, i) => ({ id: `new-${i}`, name: c.name, surname: c.surname, email: c.email, phone: c.phone })),
  ], [existingClients, toCreate])

  const weights = useMemo(() => (ds.peso.table ? parseWeightHistory(ds.peso.table, pool) : null), [ds.peso.table, pool])
  const notes = useMemo(() => (ds.notas.table ? parseConsultationNotes(ds.notas.table, pool) : null), [ds.notas.table, pool])
  const labs = useMemo(() => (ds.analiticas.table ? parseLabResults(ds.analiticas.table, pool) : null), [ds.analiticas.table, pool])

  const summaries: Record<DsKey, DsSummary | null> = {
    peso: weights && { missing: weights.missingColumns, count: weights.entries.length, clients: weights.clientsMatched, problems: weights.problems,
      note: weights.duplicatesInFile > 0 ? `${plural(weights.duplicatesInFile, 'repetido', 'repetidos')} en el archivo (me quedo con el último)` : undefined },
    notas: notes && { missing: notes.missingColumns, count: notes.entries.length, clients: notes.clientsMatched, problems: notes.problems,
      note: 'irán a sus notas privadas, que el cliente no ve' },
    analiticas: labs && { missing: labs.missingColumns, count: labs.entries.length, clients: labs.clientsMatched, problems: labs.problems,
      note: labs.duplicatesInFile > 0 ? `${plural(labs.duplicatesInFile, 'repetido', 'repetidos')} en el archivo (me quedo con el último)` : undefined },
  }
  const usable = (k: DsKey) => !!summaries[k] && summaries[k]!.missing.length === 0
  const entries = { peso: usable('peso') ? weights!.entries : [], notas: usable('notas') ? notes!.entries : [], analiticas: usable('analiticas') ? labs!.entries : [] }
  const initialWeights = toCreate.filter(c => parseWeightKg(c.weightKg).status === 'ok').length
  // Un archivo subido que no se puede leer bloquea «Siguiente»: es mejor corregirlo que importar a medias sin darse cuenta.
  const historyBlocked = (['peso', 'notas', 'analiticas'] as DsKey[]).some(k => !!ds[k].file && !usable(k))

  const useClientsTable = (table: string[][], label: string) => {
    setClientsError(''); setClientRows(null); setClientsFile(label)
    if (!hasNameColumn(table)) { setClientsError('No encuentro la columna «Nombre» en la primera fila. Revisa las cabeceras o usa la plantilla.'); return }
    const parsed = rowsToClients(table)
    if (parsed.length === 0) { setClientsError('No hay ninguna fila con datos.'); return }
    setClientRows(reviewClientRows(parsed, existingClients))
  }
  const handleClientsFile = async (file: File) => {
    try { useClientsTable(await readTable(file), file.name) }
    catch (e) { console.error(e); setClientsFile(file.name); setClientsError('No he podido leer el archivo. Prueba a guardarlo de nuevo como CSV o .xlsx.') }
  }

  const setDataset = (k: DsKey, patch: DsState) => setDs(prev => ({ ...prev, [k]: patch }))
  const useTable = (k: DsKey) => (table: string[][], label: string) => setDataset(k, { file: label, table, error: '' })
  const handleFile = (k: DsKey) => async (file: File) => {
    try { setDataset(k, { file: file.name, table: await readTable(file), error: '' }) }
    catch (e) { console.error(e); setDataset(k, { file: file.name, table: null, error: 'No he podido leer el archivo. Prueba a guardarlo de nuevo como CSV o .xlsx.' }) }
  }

  const run = async () => {
    setWorking(true)
    const origin = window.location.origin
    const today = toLocalISODate(new Date())
    const errors: string[] = []
    try {
      // 1) Los clientes nuevos (si hay), con su enlace de acceso ya generado. Si esto falla no se crea nada.
      const created: { id: string; token: string; name: string }[] = []
      if (toCreate.length > 0) {
        const withToken = toCreate.map(c => ({ c, token: generateClientToken() }))
        if (demoMode) {
          withToken.forEach(({ c, token }, i) => created.push({ id: `demo-${i}`, token, name: `${c.name} ${c.surname}`.trim() }))
        } else {
          const goalKg = (t: string) => { const w = parseWeightKg(t); return w.status === 'ok' ? w.kg : null }
          const { data, error } = await supabase.from('clientes').insert(withToken.map(({ c, token }) => ({
            nutricionista_id: nutricionistaId, token, name: c.name, surname: c.surname, phone: c.phone, email: c.email || null,
            goal: c.goal || null, height_cm: c.heightCm ? parseFloat(c.heightCm.replace(',', '.')) || null : null,
            gender: c.gender || null, birth_date: c.birthDate || null, allergies: c.allergies, notes: c.notes,
            goal_weight_kg: goalKg(c.goalWeightKg), created_at: new Date().toISOString(),
          }))).select('id, token')
          if (error) throw new Error(error.message)
          const idByToken = new Map((data ?? []).map(r => [r.token as string, r.id as string]))
          withToken.forEach(({ c, token }) => {
            const id = idByToken.get(token)
            if (id) created.push({ id, token, name: `${c.name} ${c.surname}`.trim() })
          })
        }
      }
      const realId = (id: string) => (id.startsWith('new-') ? created[Number(id.slice(4))]?.id : id)

      // 2) Sus pesos: el peso actual de la hoja (con la fecha de hoy) y el historial; lo que ya existe no se pisa.
      const weightRows: { client_id: string; date: string; weight_kg: number; note: string }[] = []
      toCreate.forEach((c, i) => {
        const w = parseWeightKg(c.weightKg), id = created[i]?.id
        if (w.status === 'ok' && id) weightRows.push({ client_id: id, date: today, weight_kg: w.kg, note: '' })
      })
      for (const e of entries.peso) { const id = realId(e.clientId); if (id) weightRows.push({ client_id: id, date: e.date, weight_kg: e.weightKg, note: '' }) }
      let weightsInserted = 0
      if (demoMode) weightsInserted = weightRows.length
      else {
        for (let i = 0; i < weightRows.length; i += BATCH) {
          const { data, error } = await supabase.from('weight_logs').upsert(weightRows.slice(i, i + BATCH), { onConflict: 'client_id,date', ignoreDuplicates: true }).select('id')
          if (error) { errors.push(`Pesos: ${error.message}`); break }
          weightsInserted += data?.length ?? 0
        }
      }

      // 3) Notas de consulta → notas privadas de la ficha, sin repetir lo que ya estuviera.
      const notesByClient = new Map<string, { date: string; text: string }[]>()
      for (const e of entries.notas) { const id = realId(e.clientId); if (id) notesByClient.set(id, [...(notesByClient.get(id) ?? []), { date: e.date, text: e.text }]) }
      let noteLines = 0, noteClients = 0
      const noteTotal = entries.notas.length
      if (demoMode) { noteLines = noteTotal; noteClients = notesByClient.size }
      else if (notesByClient.size > 0) {
        try {
          const ids = [...notesByClient.keys()]
          const current = new Map<string, string>(created.map((c, i) => [c.id, toCreate[i].notes]))
          const existingIds = ids.filter(id => !current.has(id))
          const rows = await fetchAllRowsForIds<{ id: string; notes: string | null }>(existingIds, (chunk, from, to) =>
            supabase.from('clientes').select('id, notes').in('id', chunk).order('id').range(from, to))
          rows.forEach(r => current.set(r.id, r.notes ?? ''))
          for (const [id, list] of notesByClient) {
            const merged = mergeConsultationNotes(current.get(id) ?? '', list)
            if (merged.added === 0) continue
            const { error } = await supabase.from('clientes').update({ notes: merged.text }).eq('id', id)
            if (error) { errors.push(`Notas: ${error.message}`); break }
            noteLines += merged.added; noteClients++
          }
        } catch (e) { errors.push(`Notas: ${e instanceof Error ? e.message : 'error desconocido'}`) }
      }

      // 4) Analíticas: solo las que no estén ya (mismo cliente, fecha y marcador).
      const labRows = entries.analiticas.flatMap(e => { const id = realId(e.clientId); return id ? [{ client_id: id, date: e.date, marker_key: e.markerKey, value: e.value }] : [] })
      let labsInserted = 0
      if (demoMode) labsInserted = labRows.length
      else if (labRows.length > 0) {
        try {
          const existingIds = [...new Set(labRows.map(r => r.client_id))].filter(id => !created.some(c => c.id === id))
          const have = new Set((await fetchAllRowsForIds<{ client_id: string; date: string; marker_key: string }>(existingIds, (chunk, from, to) =>
            supabase.from('blood_markers').select('client_id, date, marker_key').in('client_id', chunk).order('id').range(from, to)))
            .map(r => `${r.client_id}|${r.date}|${r.marker_key}`))
          const fresh = labRows.filter(r => !have.has(`${r.client_id}|${r.date}|${r.marker_key}`))
          for (let i = 0; i < fresh.length; i += BATCH) {
            const { error } = await supabase.from('blood_markers').insert(fresh.slice(i, i + BATCH))
            if (error) { errors.push(`Analíticas: ${error.message}`); break }
            labsInserted += Math.min(BATCH, fresh.length - i)
          }
        } catch (e) { errors.push(`Analíticas: ${e instanceof Error ? e.message : 'error desconocido'}`) }
      }

      setResult({
        created: created.length, alreadyExisted: alreadyExisting,
        weights: { inserted: weightsInserted, already: Math.max(0, weightRows.length - weightsInserted) },
        notes: { clients: noteClients, lines: noteLines, already: Math.max(0, noteTotal - noteLines) },
        labs: { inserted: labsInserted, already: Math.max(0, labRows.length - labsInserted) },
        links: created.map(c => ({ name: c.name, url: `${origin}/?c=${c.token}` })), errors,
      })
      setStep('hecho')
      if (!demoMode) onImported()
    } catch (e) {
      toast(`No se ha podido importar: ${e instanceof Error ? e.message : 'error desconocido'}. No se ha creado nada.`, 'warn')
    } finally {
      setWorking(false)
    }
  }

  const copy = async (text: string, ok: string) => {
    try { await navigator.clipboard.writeText(text); toast(ok, 'ok') } catch { toast('No se pudo copiar', 'warn') }
  }

  const nothingToDo = toCreate.length === 0 && entries.peso.length === 0 && entries.notas.length === 0 && entries.analiticas.length === 0
  const canSkipClients = existingClients.length > 0
  const anyHistory = entries.peso.length + entries.notas.length + entries.analiticas.length > 0
  const allProblems = (['peso', 'notas', 'analiticas'] as DsKey[]).reduce((n, k) => n + (usable(k) ? summaries[k]!.problems.length : 0), 0)

  return (
    <Modal open={open} onClose={close} title="Traer clientes" maxWidth="max-w-xl">
      <div className="space-y-4">
        {step !== 'hecho' && (
          <ol className="flex items-center gap-2 text-xs" aria-label="Pasos">
            {(['Clientes', 'Historial', 'Confirmar'] as const).map((label, i) => (
              <li key={label} className={`flex items-center gap-1.5 ${STEP_INDEX[step] === i + 1 ? 'font-bold text-ink' : 'text-muted'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${STEP_INDEX[step] === i + 1 ? 'bg-ink text-white' : 'bg-bg-alt'}`}>{i + 1}</span>{label}
              </li>
            ))}
          </ol>
        )}

        {step === 'clientes' && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Sube el archivo (.csv o .xlsx) con tus clientes. Reconozco las columnas por su nombre, en cualquier orden: <strong className="text-ink">Nombre</strong> (obligatoria),
              Apellidos, Teléfono, Email, Objetivo, Altura, Género, Nacimiento, Alergias, Peso, Peso objetivo y Notas.
            </p>
            <button type="button" onClick={() => downloadCsv('plantilla-clientes.csv', CLIENT_TEMPLATE)} className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <Download className="w-4 h-4" /> Descargar plantilla de ejemplo
            </button>
            <FileDrop fileName={clientsFile} onFile={handleClientsFile} />
            <PasteBox onUse={text => useClientsTable(parsePastedTable(text), 'Tabla pegada')} headers=", con la primera fila de cabeceras (al menos Nombre)" />
            {clientsError && <p className="text-sm text-warn flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {clientsError}</p>}
            {clientRows && (
              <div className="space-y-2">
                <p className="text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-ok flex-shrink-0" />
                  <span><strong>{toCreate.length}</strong> cliente{toCreate.length === 1 ? '' : 's'} nuevo{toCreate.length === 1 ? '' : 's'}
                    {alreadyExisting > 0 && <span className="text-muted"> · {alreadyExisting} ya existe{alreadyExisting === 1 ? '' : 'n'} en NutriFit (se omiten, no se duplican)</span>}
                    {ignoredNoName > 0 && <span className="text-warn"> · {ignoredNoName} fila{ignoredNoName === 1 ? '' : 's'} sin nombre (se ignoran)</span>}</span>
                </p>
                <div className="max-h-44 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                  {clientRows.slice(0, 40).map((r, i) => (
                    <div key={i} className={`px-3 py-1.5 text-xs flex items-center justify-between gap-2 ${r.status !== 'new' ? 'text-muted' : ''}`}>
                      <span className={`font-medium truncate ${r.status === 'no-name' ? 'line-through' : ''}`}>{r.row.name || '(sin nombre)'} {r.row.surname}</span>
                      <span className="flex-shrink-0">
                        {r.status === 'exists' ? 'Ya existe' : r.status === 'no-name' ? 'Sin nombre' : r.badWeights.length > 0 ? <span className="text-warn">Revisar {r.badWeights.join(' y ')}</span> : r.row.weightKg ? `${r.row.weightKg} kg` : 'Nuevo'}
                      </span>
                    </div>
                  ))}
                </div>
                {clientRows.length > 40 && <p className="text-xs text-muted">Mostrando 40 de {clientRows.length} filas.</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStep('historial')} disabled={!clientRows}>Siguiente</Button>
              {canSkipClients && <Button variant="outline" onClick={() => { setClientRows(null); setClientsFile(''); setStep('historial') }}>Ya los tengo creados: solo quiero su historial</Button>}
              <Button variant="ghost" onClick={close}>Cancelar</Button>
            </div>
          </div>
        )}

        {step === 'historial' && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              <strong className="text-ink">Todo opcional.</strong> Lo que ya tenías de cada cliente: así sigues su evolución y su objetivo desde el principio. Cada tipo va en su propio archivo
              (una fila por dato) y se empareja con el cliente por su nombre, email o teléfono.
            </p>
            <DatasetBlock title="Historial de peso" unit={['pesaje', 'pesajes']}
              hint={<>Columnas: <strong className="text-ink">Cliente</strong>, <strong className="text-ink">Fecha</strong> y <strong className="text-ink">Peso (kg)</strong>.</>}
              template={{ file: 'plantilla-historial-de-peso.csv', content: HISTORY_TEMPLATE }}
              pasteHeaders=", con cabeceras (Cliente, Fecha, Peso) o con una línea por pesaje: nombre, fecha y peso"
              parsePaste={parsePastedHistory} state={ds.peso} summary={summaries.peso} onFile={handleFile('peso')} onTable={useTable('peso')} />
            <DatasetBlock title="Notas de consulta" unit={['nota', 'notas']}
              hint={<>Columnas: <strong className="text-ink">Cliente</strong>, <strong className="text-ink">Fecha</strong> y <strong className="text-ink">Nota</strong>. Se añaden a las <strong className="text-ink">notas privadas</strong> de su ficha, una línea por consulta con su fecha, <strong className="text-ink">sin tocar lo que ya hubiera escrito</strong>. El cliente nunca las ve.</>}
              template={{ file: 'plantilla-notas-de-consulta.csv', content: NOTES_TEMPLATE }}
              pasteHeaders=", con cabeceras (Cliente, Fecha, Nota)"
              parsePaste={parsePastedTable} state={ds.notas} summary={summaries.notas} onFile={handleFile('notas')} onTable={useTable('notas')} />
            <DatasetBlock title="Analíticas" unit={['resultado', 'resultados']}
              hint={<>Columnas: <strong className="text-ink">Cliente</strong>, <strong className="text-ink">Fecha</strong>, <strong className="text-ink">Marcador</strong> y <strong className="text-ink">Valor</strong> (o una columna por marcador: Glucosa, Colesterol total…). De momento NutriFit lleva glucosa, colesterol total, LDL, HDL, triglicéridos, GOT, GPT, hierro, vitamina D y TSH, <strong className="text-ink">en sus unidades habituales</strong> (mg/dL…): si tu hoja usa otras, te lo digo y no las convierto a ciegas.</>}
              template={{ file: 'plantilla-analiticas.csv', content: LABS_TEMPLATE }}
              pasteHeaders=", con cabeceras (Cliente, Fecha, Marcador, Valor)"
              parsePaste={parsePastedTable} state={ds.analiticas} summary={summaries.analiticas} onFile={handleFile('analiticas')} onTable={useTable('analiticas')} />
            <p className="text-xs text-muted">
              Las <strong className="text-ink">fotos</strong> y los <strong className="text-ink">PDF originales</strong> de analíticas se suben desde la ficha de cada cliente, y el
              <strong className="text-ink"> plan de dieta</strong> que ya tenía, con «Importar» dentro de su plan.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setStep('clientes')}><ArrowLeft className="w-4 h-4" /> Atrás</Button>
              <Button onClick={() => setStep('confirmar')} disabled={historyBlocked}>{anyHistory ? 'Siguiente' : 'Saltar este paso'}</Button>
            </div>
            {historyBlocked && <p className="text-xs text-warn">Hay un archivo que no he podido leer: corrígelo o ábrelo para ver qué falta.</p>}
          </div>
        )}

        {step === 'confirmar' && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Esto es lo que se va a guardar:</p>
            <ul className="text-sm space-y-1.5">
              {(toCreate.length > 0 || clientRows) && (
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-ok flex-shrink-0 mt-0.5" />
                  <span><strong>{toCreate.length}</strong> cliente{toCreate.length === 1 ? '' : 's'} nuevo{toCreate.length === 1 ? '' : 's'}{alreadyExisting > 0 && <span className="text-muted"> ({alreadyExisting} que ya {alreadyExisting === 1 ? 'existía se omite' : 'existían se omiten'})</span>}</span></li>
              )}
              {(entries.peso.length > 0 || initialWeights > 0) && (
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-ok flex-shrink-0 mt-0.5" />
                  <span><strong>{entries.peso.length}</strong> pesaje{entries.peso.length === 1 ? '' : 's'} de su historial{initialWeights > 0 && <span className="text-muted"> + el peso actual de {plural(initialWeights, 'cliente nuevo', 'clientes nuevos')}</span>}</span></li>
              )}
              {entries.notas.length > 0 && (
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-ok flex-shrink-0 mt-0.5" />
                  <span><strong>{entries.notas.length}</strong> nota{entries.notas.length === 1 ? '' : 's'} de consulta, a sus notas privadas</span></li>
              )}
              {entries.analiticas.length > 0 && (
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-ok flex-shrink-0 mt-0.5" />
                  <span><strong>{entries.analiticas.length}</strong> resultado{entries.analiticas.length === 1 ? '' : 's'} de analíticas</span></li>
              )}
              {allProblems > 0 && (
                <li className="flex items-start gap-2 text-warn"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{allProblems} fila{allProblems === 1 ? '' : 's'} del historial no se {allProblems === 1 ? 'puede leer y no se importará' : 'pueden leer y no se importarán'} (las demás sí)</span></li>
              )}
            </ul>
            <p className="text-xs text-muted rounded-xl bg-bg-alt px-3 py-2.5">
              {toCreate.length > 0 && <>Los clientes quedan guardados en NutriFit, pero <strong className="text-ink">no tendrán acceso a su app hasta que les envíes su enlace</strong>. Al terminar te lo dejo a mano para copiarlo. </>}
              Lo que ya existía (pesajes, resultados de analíticas, líneas de notas) no se duplica ni se pisa: puedes repetir la importación sin miedo.
            </p>
            {nothingToDo && <p className="text-sm text-warn">No hay nada que importar: ningún cliente nuevo ni datos de historial válidos.</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setStep('historial')} disabled={working}><ArrowLeft className="w-4 h-4" /> Atrás</Button>
              <Button onClick={run} loading={working} disabled={nothingToDo}>Traer ahora</Button>
            </div>
          </div>
        )}

        {step === 'hecho' && result && (
          <div className="space-y-4">
            <p className="text-sm flex items-center gap-1.5 font-semibold"><CheckCircle2 className="w-5 h-5 text-ok" /> Listo{demoMode ? ' (modo demo: no se ha guardado de verdad)' : ''}</p>
            <ul className="text-sm space-y-1">
              {(result.created > 0 || result.alreadyExisted > 0) && (
                <li><strong>{result.created}</strong> cliente{result.created === 1 ? '' : 's'} creado{result.created === 1 ? '' : 's'}{result.alreadyExisted > 0 && <span className="text-muted"> · {result.alreadyExisted} ya existía{result.alreadyExisted === 1 ? '' : 'n'}</span>}</li>
              )}
              {(result.weights.inserted > 0 || result.weights.already > 0) && (
                <li><strong>{result.weights.inserted}</strong> pesaje{result.weights.inserted === 1 ? '' : 's'} guardado{result.weights.inserted === 1 ? '' : 's'}{result.weights.already > 0 && <span className="text-muted"> · {result.weights.already} ya estaban y se han respetado</span>}</li>
              )}
              {(result.notes.lines > 0 || result.notes.already > 0) && (
                <li><strong>{result.notes.lines}</strong> nota{result.notes.lines === 1 ? '' : 's'} añadida{result.notes.lines === 1 ? '' : 's'} a las notas de {plural(result.notes.clients, 'cliente', 'clientes')}{result.notes.already > 0 && <span className="text-muted"> · {result.notes.already} ya estaban</span>}</li>
              )}
              {(result.labs.inserted > 0 || result.labs.already > 0) && (
                <li><strong>{result.labs.inserted}</strong> resultado{result.labs.inserted === 1 ? '' : 's'} de analíticas guardado{result.labs.inserted === 1 ? '' : 's'}{result.labs.already > 0 && <span className="text-muted"> · {result.labs.already} ya estaban</span>}</li>
              )}
            </ul>
            {result.errors.length > 0 && (
              <div className="rounded-xl bg-warn/10 px-3 py-2.5 space-y-1">
                <p className="text-sm font-semibold text-warn flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Esto no se ha podido guardar</p>
                <ul className="text-xs space-y-0.5">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                <p className="text-xs text-muted">Lo demás sí se guardó. Vuelve a abrir «Traer clientes», salta el primer paso y repite solo eso.</p>
              </div>
            )}
            {result.links.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Ahora, envíales su acceso</p>
                <p className="text-xs text-muted">Hasta que lo reciban no pueden entrar a su app. Después, en su ficha, hazles el plan.</p>
                <div className="max-h-44 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                  {result.links.slice(0, 30).map((l, i) => (
                    <div key={i} className="px-3 py-1.5 text-xs flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{l.name}</span>
                      <button type="button" onClick={() => copy(l.url, `Enlace de ${l.name} copiado ✓`)} className="flex items-center gap-1 font-semibold text-accent flex-shrink-0"><Copy className="w-3 h-3" /> Copiar enlace</button>
                    </div>
                  ))}
                </div>
                {result.links.length > 30 && <p className="text-xs text-muted">Los demás están en su ficha (Perfil → Copiar enlace).</p>}
                <Button variant="outline" onClick={() => copy(result.links.map(l => `${l.name}: ${l.url}`).join('\n'), 'Todos los enlaces copiados ✓')}><Copy className="w-4 h-4" /> Copiar todos los enlaces</Button>
              </div>
            )}
            <Button onClick={close}>Terminar</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
