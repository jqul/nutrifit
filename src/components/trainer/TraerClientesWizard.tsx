import { useMemo, useState } from 'react'
import { Upload, AlertTriangle, Download, CheckCircle2, Copy, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { generateClientToken } from '../../lib/token'
import { toLocalISODate } from '../../lib/date'
import { readTable } from '../../lib/spreadsheet'
import { parseWeightKg } from '../../lib/weightInput'
import { parseWeightHistory, ImportClient } from '../../lib/weightHistoryImport'
import { CLIENT_TEMPLATE, HISTORY_TEMPLATE, ClientRowReview, hasNameColumn, reviewClientRows, rowsToClients } from '../../lib/clientImport'

const BATCH = 500
type Step = 'clientes' | 'historial' | 'confirmar' | 'hecho'

interface Result {
  created: number
  alreadyExisted: number
  weightsInserted: number
  weightsAlreadyThere: number
  links: { name: string; url: string }[]
  weightError?: string
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
    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-6 cursor-pointer hover:border-accent/40 hover:bg-bg-alt transition-colors">
      <Upload className="w-5 h-5 text-muted" />
      <span className="text-sm font-medium">{fileName || 'Elige un archivo .csv o .xlsx'}</span>
      <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
    </label>
  )
}

const STEP_INDEX: Record<Step, number> = { clientes: 1, historial: 2, confirmar: 3, hecho: 3 }

/**
 * "Traer clientes": un solo recorrido para pasar a NutriFit a quien ya llevabas en una hoja de cálculo.
 * 1) sus fichas, 2) su historial de peso (opcional), 3) comprobar y confirmar. Se puede traer solo lo uno o solo lo otro.
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
  const [historyFile, setHistoryFile] = useState('')
  const [historyTable, setHistoryTable] = useState<string[][] | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [working, setWorking] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const reset = () => {
    setStep('clientes'); setClientsFile(''); setClientRows(null); setClientsError('')
    setHistoryFile(''); setHistoryTable(null); setHistoryError(''); setResult(null); setWorking(false)
  }
  const close = () => { onClose(); reset() }

  const toCreate = useMemo(() => (clientRows ?? []).filter(r => r.status === 'new').map(r => r.row), [clientRows])
  const alreadyExisting = (clientRows ?? []).filter(r => r.status === 'exists').length
  const ignoredNoName = (clientRows ?? []).filter(r => r.status === 'no-name').length

  // El historial se empareja con los clientes que ya existen y con los que se van a crear ahora.
  const history = useMemo(() => {
    if (!historyTable) return null
    const pool: ImportClient[] = [
      ...existingClients,
      ...toCreate.map((c, i) => ({ id: `new-${i}`, name: c.name, surname: c.surname, email: c.email, phone: c.phone })),
    ]
    return parseWeightHistory(historyTable, pool)
  }, [historyTable, existingClients, toCreate])

  const handleClientsFile = async (file: File) => {
    setClientsError(''); setClientRows(null); setClientsFile(file.name)
    try {
      const table = await readTable(file)
      if (!hasNameColumn(table)) { setClientsError('No encuentro la columna «Nombre» en la primera fila. Revisa las cabeceras o usa la plantilla.'); return }
      const parsed = rowsToClients(table)
      if (parsed.length === 0) { setClientsError('No hay ninguna fila con datos.'); return }
      setClientRows(reviewClientRows(parsed, existingClients))
    } catch (e) {
      console.error(e); setClientsError('No he podido leer el archivo. Prueba a guardarlo de nuevo como CSV o .xlsx.')
    }
  }

  const handleHistoryFile = async (file: File) => {
    setHistoryError(''); setHistoryTable(null); setHistoryFile(file.name)
    try { setHistoryTable(await readTable(file)) }
    catch (e) { console.error(e); setHistoryError('No he podido leer el archivo. Prueba a guardarlo de nuevo como CSV o .xlsx.') }
  }

  const historyReady = !!history && history.missingColumns.length === 0
  const entries = historyReady ? history!.entries : []

  const run = async () => {
    setWorking(true)
    const origin = window.location.origin
    const today = toLocalISODate(new Date())
    try {
      // 1) Los clientes nuevos (si hay), con su enlace de acceso ya generado.
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
            gender: c.gender || null, birth_date: c.birthDate || null, allergies: c.allergies, notes: '',
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

      // 2) Sus pesos: el peso actual de la hoja (con la fecha de hoy) y el historial; lo que ya existe no se pisa.
      const idOfNew = (i: number) => created[i]?.id
      const weightRows: { client_id: string; date: string; weight_kg: number; note: string }[] = []
      toCreate.forEach((c, i) => {
        const w = parseWeightKg(c.weightKg), id = idOfNew(i)
        if (w.status === 'ok' && id) weightRows.push({ client_id: id, date: today, weight_kg: w.kg, note: '' })
      })
      for (const e of entries) {
        const id = e.clientId.startsWith('new-') ? idOfNew(Number(e.clientId.slice(4))) : e.clientId
        if (id) weightRows.push({ client_id: id, date: e.date, weight_kg: e.weightKg, note: '' })
      }
      let inserted = 0
      let weightError: string | undefined
      if (demoMode) inserted = weightRows.length
      else {
        for (let i = 0; i < weightRows.length; i += BATCH) {
          const { data, error } = await supabase.from('weight_logs')
            .upsert(weightRows.slice(i, i + BATCH), { onConflict: 'client_id,date', ignoreDuplicates: true }).select('id')
          if (error) { weightError = error.message; break }
          inserted += data?.length ?? 0
        }
      }

      setResult({
        created: created.length, alreadyExisted: alreadyExisting,
        weightsInserted: inserted, weightsAlreadyThere: weightError ? 0 : weightRows.length - inserted,
        links: created.map(c => ({ name: c.name, url: `${origin}/?c=${c.token}` })), weightError,
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

  const nothingToDo = toCreate.length === 0 && entries.length === 0
  const canSkipClients = existingClients.length > 0

  return (
    <Modal open={open} onClose={close} title="Traer clientes">
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
              Apellidos, Teléfono, Email, Objetivo, Altura, Género, Nacimiento, Alergias, Peso y Peso objetivo.
            </p>
            <button type="button" onClick={() => downloadCsv('plantilla-clientes.csv', CLIENT_TEMPLATE)} className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <Download className="w-4 h-4" /> Descargar plantilla de ejemplo
            </button>
            <FileDrop fileName={clientsFile} onFile={handleClientsFile} />
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
              {canSkipClients && <Button variant="outline" onClick={() => { setClientRows(null); setClientsFile(''); setStep('historial') }}>Ya los tengo creados: solo quiero el historial</Button>}
              <Button variant="ghost" onClick={close}>Cancelar</Button>
            </div>
          </div>
        )}

        {step === 'historial' && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              <strong className="text-ink">Opcional.</strong> Si tienes el historial de peso de tus clientes, súbelo para ver su evolución desde el principio. Una fila por pesaje, con
              <strong className="text-ink"> Cliente</strong> (nombre y apellidos, email o teléfono), <strong className="text-ink">Fecha</strong> y <strong className="text-ink">Peso (kg)</strong>.
              Por ahora NutriFit importa el peso; medidas, fotos y check-ins se registran desde la propia app.
            </p>
            <button type="button" onClick={() => downloadCsv('plantilla-historial-de-peso.csv', HISTORY_TEMPLATE)} className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <Download className="w-4 h-4" /> Descargar plantilla de ejemplo
            </button>
            <FileDrop fileName={historyFile} onFile={handleHistoryFile} />
            {historyError && <p className="text-sm text-warn flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {historyError}</p>}
            {history && history.missingColumns.length > 0 && (
              <p className="text-sm text-warn flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>No encuentro estas columnas en la primera fila: <strong>{history.missingColumns.join(', ')}</strong>.</span></p>
            )}
            {historyReady && (
              <div className="space-y-2">
                <p className="text-sm flex items-center gap-1.5">
                  <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${entries.length > 0 ? 'text-ok' : 'text-muted'}`} />
                  <span><strong>{entries.length}</strong> pesaje{entries.length === 1 ? '' : 's'} de <strong>{history!.clientsMatched}</strong> cliente{history!.clientsMatched === 1 ? '' : 's'}
                    {history!.duplicatesInFile > 0 && <span className="text-muted"> · {history!.duplicatesInFile} repetido{history!.duplicatesInFile === 1 ? '' : 's'} en el archivo (me quedo con el último)</span>}</span>
                </p>
                {history!.problems.length > 0 && (
                  <div className="rounded-xl bg-warn/10 px-3 py-2.5 space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-warn">{history!.problems.length} fila{history!.problems.length === 1 ? '' : 's'} sin importar</p>
                    <ul className="text-xs space-y-0.5 max-h-28 overflow-y-auto">
                      {history!.problems.slice(0, 15).map((p, i) => <li key={i}><span className="font-semibold">Fila {p.row}:</span> {p.reason}</li>)}
                    </ul>
                    {history!.problems.length > 15 && <p className="text-xs text-muted">… y {history!.problems.length - 15} más.</p>}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setStep('clientes')}><ArrowLeft className="w-4 h-4" /> Atrás</Button>
              <Button onClick={() => setStep('confirmar')} disabled={!!historyFile && !historyReady}>{historyReady ? 'Siguiente' : 'Saltar este paso'}</Button>
            </div>
          </div>
        )}

        {step === 'confirmar' && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Esto es lo que se va a guardar:</p>
            <ul className="text-sm space-y-1.5">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-ok flex-shrink-0 mt-0.5" />
                <span><strong>{toCreate.length}</strong> cliente{toCreate.length === 1 ? '' : 's'} nuevo{toCreate.length === 1 ? '' : 's'}{alreadyExisting > 0 && <span className="text-muted"> ({alreadyExisting} que ya {alreadyExisting === 1 ? 'existía se omite' : 'existían se omiten'})</span>}</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-ok flex-shrink-0 mt-0.5" />
                <span><strong>{entries.length}</strong> pesaje{entries.length === 1 ? '' : 's'} de su historial{toCreate.some(c => parseWeightKg(c.weightKg).status === 'ok') && <span className="text-muted"> + el peso actual de la hoja</span>}</span></li>
              {history && history.problems.length > 0 && (
                <li className="flex items-start gap-2 text-warn"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{history.problems.length} fila{history.problems.length === 1 ? '' : 's'} del historial no se {history.problems.length === 1 ? 'puede leer y no se importará' : 'pueden leer y no se importarán'} (las demás sí)</span></li>
              )}
            </ul>
            <p className="text-xs text-muted rounded-xl bg-bg-alt px-3 py-2.5">
              Los clientes quedan guardados en NutriFit, pero <strong className="text-ink">no tendrán acceso a su app hasta que les envíes su enlace</strong>. Al terminar te lo dejo a mano para copiarlo.
              Los pesajes que ya existían no se pisan.
            </p>
            {nothingToDo && <p className="text-sm text-warn">No hay nada que importar: ningún cliente nuevo ni pesajes válidos.</p>}
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
              <li><strong>{result.created}</strong> cliente{result.created === 1 ? '' : 's'} creado{result.created === 1 ? '' : 's'}{result.alreadyExisted > 0 && <span className="text-muted"> · {result.alreadyExisted} ya existía{result.alreadyExisted === 1 ? '' : 'n'}</span>}</li>
              <li><strong>{result.weightsInserted}</strong> pesaje{result.weightsInserted === 1 ? '' : 's'} guardado{result.weightsInserted === 1 ? '' : 's'}{result.weightsAlreadyThere > 0 && <span className="text-muted"> · {result.weightsAlreadyThere} ya estaban y se han respetado</span>}</li>
            </ul>
            {result.weightError && (
              <p className="text-sm text-warn flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Los clientes se han creado, pero los pesos no se han podido guardar ({result.weightError}). Vuelve a abrir «Traer clientes», salta el primer paso y sube solo el historial.</span></p>
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
