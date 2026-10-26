import { useState } from 'react'
import { BottomSheet } from '../shared/BottomSheet'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { supabase } from '../../lib/supabase'
import { toLocalISODate } from '../../lib/date'
import { computeMacros } from '../../lib/foodConversion'
import { Food } from '../../types'
import { ListPlus, Trash2 } from 'lucide-react'

interface Row { id: string; query: string; food: Food | null; gramsText: string }

const comma = (n: number) => String(n).replace('.', ',')
const r1 = (n: number) => Math.round(n * 10) / 10
const newId = () => crypto.randomUUID()
const blankRow = (): Row => ({ id: newId(), query: '', food: null, gramsText: '100' })

/**
 * "Varios alimentos a la vez": lo que no tiene un único código de barras (una comida con varios ingredientes, un
 * plato casero hecho con cosas del catálogo). Cada fila se resuelve contra el catálogo de alimentos (el mismo que
 * usa el editor de dietas) con autocompletado, igual que RecipeEditorPanel — nada se inventa: si un alimento no
 * está en el catálogo, esa fila no suma hasta que se elige uno real. Ver replica/architecture.md.
 */
export function ExtrasQuickLogSheet({ clientId, foods, demoMode, dayKcal, kcalTarget, onClose }: {
  clientId: string; foods: Food[]; demoMode?: boolean; dayKcal?: number; kcalTarget?: number; onClose: () => void
}) {
  const [rows, setRows] = useState<Row[]>([blankRow()])
  const [suggestFor, setSuggestFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const updateRow = (id: string, updates: Partial<Row>) => setRows(rows.map(r => (r.id === id ? { ...r, ...updates } : r)))
  const removeRow = (id: string) => setRows(rows.length > 1 ? rows.filter(r => r.id !== id) : rows)

  const macrosOf = (row: Row) => {
    if (!row.food) return null
    const grams = parseFloat(row.gramsText.replace(',', '.'))
    if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) return null
    const m = computeMacros(row.food, grams, 'g')
    return m ? { grams, kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG } : null
  }

  const resolvedRows = rows.flatMap(row => { const m = macrosOf(row); return m ? [{ row, m }] : [] })
  const total = resolvedRows.reduce((s, { m }) => ({ kcal: s.kcal + m.kcal, proteinG: r1(s.proteinG + m.proteinG), carbsG: r1(s.carbsG + m.carbsG), fatG: r1(s.fatG + m.fatG) }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  const unresolvedCount = rows.filter(r => r.query.trim() && !macrosOf(r)).length

  const save = async () => {
    if (resolvedRows.length === 0) return
    setSaving(true)
    const name = resolvedRows.length === 1 ? resolvedRows[0].row.food!.name : `${resolvedRows[0].row.food!.name} y ${resolvedRows.length - 1} más`
    const date = toLocalISODate(new Date())
    const note = `${total.kcal} kcal · P ${comma(total.proteinG)} g · C ${comma(total.carbsG)} g · G ${comma(total.fatG)} g (varios alimentos)`

    if (demoMode) { toast(kcalTarget ? `+${total.kcal} kcal añadidas (modo demo: no se guarda de verdad)` : 'Añadido a "Extras de hoy" (modo demo: no se guarda de verdad)', 'ok'); setSaving(false); onClose(); return }

    const { data: logRow, error: logError } = await supabase.from('meal_logs')
      .insert({ client_id: clientId, date, meal_name: name, note }).select().single()
    if (logError || !logRow) { setSaving(false); toast('No se pudo añadir al diario: ' + (logError?.message ?? ''), 'warn'); return }

    const { error: itemsError } = await supabase.from('extra_log_items').insert(resolvedRows.map(({ row, m }) => ({
      meal_log_id: logRow.id, client_id: clientId, food_id: row.food!.id, name: row.food!.name, grams: m.grams,
      kcal: m.kcal, protein_g: m.proteinG, carbs_g: m.carbsG, fat_g: m.fatG, source: 'catalog', is_estimate: false,
    })))
    setSaving(false)
    if (itemsError) { toast('No se pudo guardar el desglose: ' + itemsError.message, 'warn'); return }

    toast(kcalTarget ? `+${total.kcal} kcal añadidas · llevas ${(dayKcal ?? 0) + total.kcal} de ${kcalTarget}` : `+${total.kcal} kcal añadidas a Extras de hoy`, 'ok')
    window.dispatchEvent(new Event('nutrifit:meal-logged'))
    onClose()
  }

  return (
    <BottomSheet open onClose={onClose} title="Añadir varios alimentos">
      <div className="space-y-3">
        <div className="space-y-1.5">
          {rows.map(row => {
            const suggestions = suggestFor === row.id && row.query.trim().length > 0 && !row.food
              ? foods.filter(f => f.name.toLowerCase().includes(row.query.toLowerCase())).slice(0, 6)
              : []
            return (
              <div key={row.id} className="relative flex items-center gap-1.5">
                <input value={row.query}
                  onChange={e => updateRow(row.id, { query: e.target.value, food: null })}
                  onFocus={() => setSuggestFor(row.id)} onBlur={() => setTimeout(() => setSuggestFor(null), 150)}
                  placeholder="Busca un alimento..."
                  className={`flex-1 px-2.5 py-2 bg-bg border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20 ${row.food ? 'border-ok/40' : 'border-border'}`} />
                <input value={row.gramsText} onChange={e => updateRow(row.id, { gramsText: e.target.value })}
                  inputMode="decimal" placeholder="g" aria-label={`Gramos de ${row.query || 'este alimento'}`}
                  className="w-16 px-2.5 py-2 bg-bg border border-border rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-accent/20" />
                <button type="button" onClick={() => removeRow(row.id)} aria-label="Quitar fila" className="p-1.5 text-muted hover:text-warn flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
                {suggestions.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-10 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {suggestions.map(f => (
                      <button key={f.id} type="button"
                        onMouseDown={() => { updateRow(row.id, { query: f.name, food: f }); setSuggestFor(null) }}
                        className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent/10 hover:text-accent transition-colors flex items-center justify-between gap-2">
                        <span>{f.name}</span>
                        <span className="text-muted flex-shrink-0">{f.kcal} kcal/100g</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button type="button" onClick={() => setRows([...rows, blankRow()])}
          className="flex items-center gap-1 text-xs text-muted hover:text-accent">
          <ListPlus className="w-3.5 h-3.5" /> Añadir otro alimento
        </button>

        {unresolvedCount > 0 && (
          <p className="text-xs text-warn">
            {unresolvedCount === 1 ? 'Un alimento no está en el catálogo' : `${unresolvedCount} alimentos no están en el catálogo`} — elige uno de la lista para que cuente.
          </p>
        )}

        {resolvedRows.length > 0 && (
          <div className="grid grid-cols-4 gap-2" aria-live="polite">
            {[['Kcal', total.kcal, ''], ['Prot.', total.proteinG, 'g'], ['Carbos', total.carbsG, 'g'], ['Grasas', total.fatG, 'g']].map(([label, value, suffix]) => (
              <div key={label as string} className="bg-card border border-border rounded-xl px-2 py-3 text-center">
                <p className="text-lg font-serif font-bold">{String(value).replace('.', ',')}{suffix}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
        )}

        <Button className="w-full" onClick={save} loading={saving} disabled={resolvedRows.length === 0}>Añadir a mi diario de hoy</Button>
        <p className="text-xs text-muted">Valores por 100 g según el catálogo de alimentos. Si falta alguno, pídele a tu nutricionista que lo añada, o usa el escáner si tiene código de barras.</p>
      </div>
    </BottomSheet>
  )
}
