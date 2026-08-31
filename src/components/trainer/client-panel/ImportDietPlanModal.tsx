import { useState } from 'react'
import { Food } from '../../../types'
import { computeMacros } from '../../../lib/foodConversion'
import { Modal } from '../../shared/Modal'
import { Button } from '../../shared/Button'
import { toast } from '../../shared/Toast'
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { EditableItem, EditableMeal } from './PlanDietaTab'

interface ParsedRow {
  meal: string; time: string; food: string; quantity: string; unit: string
  kcal: string; proteinG: string; carbsG: string; fatG: string
}

// Mismo enfoque que ImportClientsModal: alias de cabeceras en español o
// inglés, en cualquier orden, para no exigirle a nadie una plantilla exacta.
const HEADER_ALIASES: Record<keyof ParsedRow, string[]> = {
  meal: ['comida', 'meal', 'nombre comida', 'meal name'],
  time: ['hora', 'time'],
  food: ['alimento', 'ingrediente', 'food', 'ingredient'],
  quantity: ['cantidad', 'cant', 'cant.', 'quantity', 'qty'],
  unit: ['unidad', 'unit'],
  kcal: ['kcal', 'calorias', 'calorías', 'calories'],
  proteinG: ['proteina', 'proteína', 'protein', 'proteina (g)', 'proteína (g)', 'protein (g)'],
  carbsG: ['carbohidratos', 'carbos', 'carbs', 'carbohydrates', 'carbohidratos (g)', 'carbs (g)'],
  fatG: ['grasas', 'grasa', 'fat', 'fats', 'grasas (g)', 'fat (g)'],
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function detectColumns(headers: string[]): Partial<Record<keyof ParsedRow, number>> {
  const normalized = headers.map(h => stripAccents(h.trim().toLowerCase()))
  const map: Partial<Record<keyof ParsedRow, number>> = {}
  ;(Object.keys(HEADER_ALIASES) as (keyof ParsedRow)[]).forEach(field => {
    const idx = normalized.findIndex(h => HEADER_ALIASES[field].some(alias => stripAccents(alias) === h))
    if (idx !== -1) map[field] = idx
  })
  return map
}

function rowsToParsed(rows: string[][]): ParsedRow[] {
  if (rows.length === 0) return []
  const [header, ...dataRows] = rows
  const cols = detectColumns(header)
  const get = (r: string[], key: keyof ParsedRow) => cols[key] != null ? (r[cols[key]!] || '').trim() : ''
  return dataRows
    .filter(r => r.some(cell => (cell || '').trim() !== ''))
    .map(r => ({
      meal: get(r, 'meal'), time: get(r, 'time'), food: get(r, 'food'),
      quantity: get(r, 'quantity'), unit: get(r, 'unit') || 'g',
      kcal: get(r, 'kcal'), proteinG: get(r, 'proteinG'), carbsG: get(r, 'carbsG'), fatG: get(r, 'fatG'),
    }))
    .filter(r => r.meal || r.food)
}

/** Parser CSV sencillo con soporte de campos entre comillas (RFC4180 básico) — igual que ImportClientsModal. */
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
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  return rows.map(r => r.map(cell => String(cell ?? '')))
}

function normalizeFoodName(s: string): string {
  return stripAccents(s.trim().toLowerCase())
}

/** Agrupa las filas por comida (en el orden en que aparece cada nombre por
 * primera vez) y, para las que no traían kcal/macros ya calculados, busca el
 * alimento por nombre en el catálogo para rellenarlos solo — mismo motor
 * (computeMacros) que ya usa el resto del editor de plan. */
function rowsToMeals(rows: ParsedRow[], foods: Food[]): { meals: EditableMeal[]; unmatched: string[] } {
  const mealOrder: string[] = []
  const byMeal = new Map<string, ParsedRow[]>()
  for (const r of rows) {
    const name = r.meal || 'Comida'
    if (!byMeal.has(name)) { byMeal.set(name, []); mealOrder.push(name) }
    byMeal.get(name)!.push(r)
  }

  const unmatched = new Set<string>()
  const meals: EditableMeal[] = mealOrder.map(name => {
    const mealRows = byMeal.get(name)!
    const items: EditableItem[] = mealRows.filter(r => r.food).map(r => {
      let kcal = r.kcal, proteinG = r.proteinG, carbsG = r.carbsG, fatG = r.fatG
      if (!kcal && !proteinG && !carbsG && !fatG) {
        const match = foods.find(f => normalizeFoodName(f.name) === normalizeFoodName(r.food))
        if (match) {
          const qty = parseFloat(r.quantity) || 0
          const computed = qty > 0 ? computeMacros(match, qty, r.unit) : null
          if (computed) {
            kcal = String(computed.kcal); proteinG = String(computed.proteinG)
            carbsG = String(computed.carbsG); fatG = String(computed.fatG)
          }
        } else {
          unmatched.add(r.food)
        }
      }
      return {
        id: crypto.randomUUID(), foodName: r.food, quantity: r.quantity || '1', unit: r.unit,
        kcal, proteinG, carbsG, fatG,
        fiberG: '', sugarG: '', sodiumMg: '', saturatedFatG: '', calciumMg: '', ironMg: '', zincMg: '',
      }
    })
    return {
      id: crypto.randomUUID(), name, time: mealRows[0]?.time || '', kcalTarget: '', dayOfWeek: null,
      optionGroup: null, optionLabel: null, dayType: null, items,
    }
  })

  return { meals, unmatched: Array.from(unmatched) }
}

export function ImportDietPlanModal({ open, onClose, foods, onImport }: {
  open: boolean
  onClose: () => void
  foods: Food[]
  onImport: (meals: EditableMeal[]) => void
}) {
  const [meals, setMeals] = useState<EditableMeal[]>([])
  const [unmatched, setUnmatched] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')

  const reset = () => { setMeals([]); setUnmatched([]); setFileName(''); setParseError('') }

  const handleFile = async (file: File) => {
    setParsing(true); setParseError(''); setFileName(file.name)
    try {
      const isExcel = /\.xlsx?$/i.test(file.name)
      const rows = isExcel ? await parseXLSX(file) : parseCSV(await file.text())
      const parsed = rowsToParsed(rows)
      if (parsed.length === 0) { setParseError('No se ha encontrado ninguna fila con datos.'); setMeals([]); return }
      const { meals: built, unmatched: notFound } = rowsToMeals(parsed, foods)
      setMeals(built)
      setUnmatched(notFound)
    } catch (e) {
      setParseError('No se ha podido leer el archivo. Prueba a exportarlo de nuevo como CSV o .xlsx.')
      console.error(e)
    } finally {
      setParsing(false)
    }
  }

  const totalItems = meals.reduce((n, m) => n + m.items.length, 0)

  const handleImport = () => {
    onImport(meals)
    toast(`${meals.length} comida${meals.length === 1 ? '' : 's'} importada${meals.length === 1 ? '' : 's'} — revísalas antes de guardar el plan`, 'ok')
    onClose()
    reset()
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset() }} title="Importar plan desde CSV o Excel">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Sube un archivo .csv o .xlsx con las comidas de este plan. Reconocemos columnas como Comida, Hora, Alimento,
          Cantidad y Unidad (en cualquier orden) — si además incluye Kcal/Proteína/Carbos/Grasas ya calculados, los
          usamos tal cual; si no, buscamos cada alimento en tu catálogo para calcularlos solos.
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

        {unmatched.length > 0 && (
          <p className="text-xs text-warn flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            No hemos encontrado en tu catálogo: {unmatched.join(', ')} — se importan sin kcal/macros, añádelos a mano o créalos como alimento nuevo.
          </p>
        )}

        {meals.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> Vista previa — {meals.length} comidas, {totalItems} alimentos
            </p>
            <div className="max-h-64 overflow-y-auto border border-border rounded-xl divide-y divide-border">
              {meals.map(m => (
                <div key={m.id} className="px-3 py-2.5">
                  <p className="text-xs font-bold">{m.name}{m.time ? ` · ${m.time}` : ''}</p>
                  {m.items.map(i => (
                    <p key={i.id} className="text-xs text-muted flex justify-between gap-2">
                      <span>{i.foodName} — {i.quantity}{i.unit}</span>
                      <span className="flex-shrink-0">{i.kcal ? `${i.kcal} kcal` : 'sin macros'}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleImport} disabled={meals.length === 0}>
            Añadir al plan {meals.length > 0 ? `(${meals.length} comidas)` : ''}
          </Button>
          <Button variant="ghost" onClick={() => { onClose(); reset() }}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  )
}
