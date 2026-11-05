import { useState } from 'react'
import { Food } from '../../../types'
import { supabase } from '../../../lib/supabase'
import { Modal } from '../../shared/Modal'
import { Button } from '../../shared/Button'
import { toast } from '../../shared/Toast'
import { Upload, AlertTriangle, CheckCircle2, Download } from 'lucide-react'
import { readTable } from '../../../lib/spreadsheet'
import { parsePastedTable } from '../../../lib/pastedTable'
import { MAX_IMPORT_RECIPES, RECIPE_TEMPLATE, RecipeImportResult, parseRecipeTable, recipeDraftToRow } from '../../../lib/recipeImport'
import { mealTypeLabel } from '../../../lib/recipeMeta'

function downloadCsv(name: string, content: string) {
  // BOM para que Excel en español abra bien las tildes.
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Importa muchas recetas de golpe a tu recetario desde un .csv/.xlsx o pegando una tabla. Una fila por ingrediente. */
export function ImportRecipesModal({ open, onClose, nutricionistaId, foods, existingNames, demoMode, onImported }: {
  open: boolean
  onClose: () => void
  nutricionistaId: string
  foods: Food[]
  /** Nombres de las recetas propias que ya tienes (no se duplican). */
  existingNames: string[]
  demoMode?: boolean
  onImported: () => void
}) {
  const [result, setResult] = useState<RecipeImportResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reset = () => { setResult(null); setFileName(''); setPasted(''); setError('') }
  const close = () => { onClose(); reset() }

  const analyse = (rows: string[][]) => {
    const r = parseRecipeTable(rows, foods, existingNames)
    if (r.fatal) { setError(r.fatal); setResult(null); return }
    setError(''); setResult(r)
  }

  const handleFile = async (file: File) => {
    setBusy(true); setError(''); setFileName(file.name); setPasted('')
    try { analyse(await readTable(file)) }
    catch (e) { setError('No se ha podido leer el archivo. Prueba a exportarlo de nuevo como CSV o .xlsx.'); setResult(null); console.error(e) }
    finally { setBusy(false) }
  }

  const handlePaste = (text: string) => {
    setPasted(text); setFileName('')
    if (!text.trim()) { setResult(null); setError(''); return }
    analyse(parsePastedTable(text))
  }

  const handleImport = async () => {
    if (!result || result.recipes.length === 0) return
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setBusy(true)
    const rows = result.recipes.map(r => recipeDraftToRow(r, nutricionistaId))
    let saved = 0
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50)
      const { error: err } = await supabase.from('recipes').insert(chunk)
      if (err) { setBusy(false); toast(`Se guardaron ${saved} recetas; las demás no: ${err.message}`, 'warn'); if (saved > 0) onImported(); return }
      saved += chunk.length
    }
    setBusy(false)
    toast(`${saved} receta${saved === 1 ? '' : 's'} importada${saved === 1 ? '' : 's'} ✓`, 'ok')
    onImported(); close()
  }

  const n = result?.recipes.length ?? 0

  return (
    <Modal open={open} onClose={close} title="Importar recetas">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Sube un .csv o .xlsx, o pega una tabla, con <strong className="text-ink">una fila por ingrediente</strong>. Columnas: Receta y Alimento
          (obligatorias), Cantidad, Unidad, y opcionales Tipo, Etiquetas, Tiempo (min), Raciones, Dieta, Alérgenos, Pasos, Kcal, Proteína,
          Carbohidratos y Grasas. El nombre de la receta puede ir solo en su primera fila. Si un ingrediente no trae kcal ni macros, los
          calculamos con tu catálogo de alimentos. Máximo {MAX_IMPORT_RECIPES} recetas por importación; las que ya tienes con el mismo nombre no se duplican.
        </p>

        <button type="button" onClick={() => downloadCsv('plantilla-recetas.csv', RECIPE_TEMPLATE)} className="flex items-center gap-1.5 text-sm font-semibold text-accent">
          <Download className="w-4 h-4" /> Descargar plantilla de ejemplo
        </button>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-6 cursor-pointer hover:border-accent/40 hover:bg-bg-alt transition-colors">
          <Upload className="w-6 h-6 text-muted" />
          <span className="text-sm font-medium">{fileName || 'Selecciona un archivo .csv o .xlsx'}</span>
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
        </label>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">…o pega la tabla</p>
          <textarea value={pasted} onChange={e => handlePaste(e.target.value)} rows={4} placeholder="Copia las celdas desde Excel o Google Sheets (con la fila de cabeceras) y pégalas aquí"
            className="w-full text-xs font-mono rounded-xl border border-border bg-bg p-3 outline-none focus:border-accent/50" />
        </div>

        {busy && <p className="text-sm text-muted">Un momento...</p>}
        {error && <p className="text-sm text-warn flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {error}</p>}

        {result && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> {n} receta{n === 1 ? '' : 's'} lista{n === 1 ? '' : 's'} para importar
            </p>
            {n > 0 && (
              <div className="max-h-56 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                {result.recipes.map((r, i) => (
                  <div key={i} className="px-3 py-2">
                    <p className="text-xs font-bold">{r.name}{r.mealType ? ` · ${mealTypeLabel(r.mealType)}` : ''}</p>
                    <p className="text-xs text-muted">
                      {r.items.length} ingrediente{r.items.length === 1 ? '' : 's'}
                      {r.withoutMacros.length > 0 ? ` · ${r.withoutMacros.length} sin macros` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {result.skippedExisting.length > 0 && (
              <p className="text-xs text-muted">Ya las tienes y se saltan ({result.skippedExisting.length}): {result.skippedExisting.slice(0, 6).join(', ')}{result.skippedExisting.length > 6 ? '…' : ''}</p>
            )}
            {result.overLimit > 0 && (
              <p className="text-xs text-warn flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {result.overLimit} receta{result.overLimit === 1 ? '' : 's'} más no entra{result.overLimit === 1 ? '' : 'n'} (máximo {MAX_IMPORT_RECIPES}): importa el resto en otra tanda.</p>
            )}
            {result.unmatchedFoods.length > 0 && (
              <p className="text-xs text-warn flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                No están en tu catálogo: {result.unmatchedFoods.slice(0, 10).join(', ')}{result.unmatchedFoods.length > 10 ? '…' : ''} — se importan sin kcal/macros; complétalos al abrir la receta.
              </p>
            )}
            {result.problems.length > 0 && (
              <details className="text-xs text-warn">
                <summary className="cursor-pointer font-semibold">{result.problems.length} aviso{result.problems.length === 1 ? '' : 's'} sobre filas</summary>
                <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.problems.slice(0, 50).map((p, i) => <li key={i}>Fila {p.row}: {p.message}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleImport} disabled={n === 0 || busy}>Importar {n > 0 ? `${n} receta${n === 1 ? '' : 's'}` : ''}</Button>
          <Button variant="ghost" onClick={close}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
