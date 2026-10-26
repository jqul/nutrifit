import { useEffect, useState } from 'react'
import { BottomSheet } from '../shared/BottomSheet'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { supabase } from '../../lib/supabase'
import { toLocalISODate } from '../../lib/date'
import { computeMacros } from '../../lib/foodConversion'
import { getMealLogsSnapshot, mealLogsOf, publishMealLogs } from '../../lib/mealProgress'
import { Food } from '../../types'
import { History, Keyboard, ListPlus, Search, Trash2 } from 'lucide-react'

interface CatalogRow { id: string; query: string; food: Food | null; gramsText: string }
interface QuickAddRow { id: string; name: string; kcalText: string; proteinText: string; carbsText: string; fatText: string }
interface RecentChip { food: Food; grams: number }
type Macros = { grams: number; kcal: number; proteinG: number; carbsG: number; fatG: number }

const comma = (n: number) => String(n).replace('.', ',')
const r1 = (n: number) => Math.round(n * 10) / 10
const num = (s: string) => parseFloat(s.replace(',', '.'))
const newId = () => crypto.randomUUID()
const blankCatalogRow = (): CatalogRow => ({ id: newId(), query: '', food: null, gramsText: '100' })
const blankQuickAddRow = (): QuickAddRow => ({ id: newId(), name: '', kcalText: '', proteinText: '', carbsText: '', fatText: '' })

function catalogMacros(row: CatalogRow): Macros | null {
  if (!row.food) return null
  const grams = num(row.gramsText)
  if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) return null
  const m = computeMacros(row.food, grams, 'g')
  return m ? { grams, kcal: m.kcal, proteinG: m.proteinG, carbsG: m.carbsG, fatG: m.fatG } : null
}

/** Quick Add: solo exige kcal — proteína/carbohidratos/grasa se quedan en 0 si no se rellenan, igual que un
 * alimento del catálogo sin esos datos ampliados. */
function quickAddMacros(row: QuickAddRow): Macros | null {
  const kcal = num(row.kcalText)
  if (!row.name.trim() || !Number.isFinite(kcal) || kcal < 0 || kcal > 950 * 5) return null
  const toG = (s: string) => { const n = num(s); return Number.isFinite(n) && n >= 0 && n <= 500 ? n : 0 }
  return { grams: 0, kcal: Math.round(kcal), proteinG: toG(row.proteinText), carbsG: toG(row.carbsText), fatG: toG(row.fatText) }
}

function sumMacros(items: Macros[]): Omit<Macros, 'grams'> {
  return items.reduce((s, m) => ({ kcal: s.kcal + m.kcal, proteinG: r1(s.proteinG + m.proteinG), carbsG: r1(s.carbsG + m.carbsG), fatG: r1(s.fatG + m.fatG) }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })
}

/**
 * "Varios alimentos a la vez": buscar en el catálogo (con chips de los últimos alimentos para añadirlos de un
 * toque, el atajo que más usa la gente en apps parecidas) o, si algo no está en el catálogo, Quick Add — apuntar
 * solo las kcal/macros a mano, sin inventar nada por el cliente. Ver replica/architecture.md y
 * replica/architecture-myfitnesspal.md.
 */
export function ExtrasQuickLogSheet({ clientId, foods, demoMode, dayKcal, kcalTarget, onClose }: {
  clientId: string; foods: Food[]; demoMode?: boolean; dayKcal?: number; kcalTarget?: number; onClose: () => void
}) {
  const [mode, setMode] = useState<'catalog' | 'quick_add'>('catalog')
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([blankCatalogRow()])
  const [quickRows, setQuickRows] = useState<QuickAddRow[]>([])
  const [suggestFor, setSuggestFor] = useState<string | null>(null)
  const [recentChips, setRecentChips] = useState<RecentChip[]>([])
  const [saving, setSaving] = useState(false)

  // Los últimos alimentos del catálogo que el cliente ha registrado (nunca los de Quick Add: no hay nada
  // verificado que volver a añadir), para tocar y repetir sin buscar de nuevo.
  useEffect(() => {
    if (demoMode) return
    supabase.from('extra_log_items').select('food_id, grams, created_at')
      .eq('client_id', clientId).eq('source', 'catalog').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => {
        if (!data) return
        const seen = new Set<string>()
        const chips: RecentChip[] = []
        for (const row of data) {
          if (!row.food_id || seen.has(row.food_id)) continue
          const food = foods.find(f => f.id === row.food_id)
          if (!food) continue
          seen.add(row.food_id)
          chips.push({ food, grams: row.grams })
          if (chips.length >= 6) break
        }
        setRecentChips(chips)
      })
  }, [clientId, demoMode, foods])

  const addChip = (chip: RecentChip) => {
    const filled = { id: newId(), query: chip.food.name, food: chip.food, gramsText: String(chip.grams) }
    setCatalogRows(rows => (rows.length === 1 && !rows[0].query && !rows[0].food ? [filled] : [...rows, filled]))
    setMode('catalog')
  }

  const updateCatalogRow = (id: string, updates: Partial<CatalogRow>) => setCatalogRows(rows => rows.map(r => (r.id === id ? { ...r, ...updates } : r)))
  const updateQuickRow = (id: string, updates: Partial<QuickAddRow>) => setQuickRows(rows => rows.map(r => (r.id === id ? { ...r, ...updates } : r)))

  const resolvedCatalog = catalogRows.flatMap(row => { const m = catalogMacros(row); return m ? [{ row, m }] : [] })
  const resolvedQuick = quickRows.flatMap(row => { const m = quickAddMacros(row); return m ? [{ row, m }] : [] })
  const unresolvedCatalogCount = catalogRows.filter(r => r.query.trim() && !catalogMacros(r)).length
  const allItems = [...resolvedCatalog.map(r => r.m), ...resolvedQuick.map(r => r.m)]
  const total = sumMacros(allItems)

  const save = async () => {
    if (allItems.length === 0) return
    setSaving(true)
    const firstName = resolvedCatalog[0]?.row.food?.name ?? resolvedQuick[0]?.row.name
    const name = allItems.length === 1 ? firstName! : `${firstName} y ${allItems.length - 1} más`
    const date = toLocalISODate(new Date())
    const note = `${total.kcal} kcal · P ${comma(total.proteinG)} g · C ${comma(total.carbsG)} g · G ${comma(total.fatG)} g (varios alimentos)`

    if (demoMode) {
      // Igual que ScannedFoodSheet: en la demo no hay base de datos, pero sí se ve en "Extras de hoy" mientras
      // se prueba — si no, parece que guardar no hace nada.
      publishMealLogs(clientId, [...mealLogsOf(getMealLogsSnapshot(), clientId), {
        id: 'demo-' + Date.now(), clientId, date, mealName: name, note, photoUrl: null, createdAt: Date.now(),
      }])
      toast(kcalTarget ? `+${total.kcal} kcal añadidas · llevas ${(dayKcal ?? 0) + total.kcal} de ${kcalTarget} (demo: no se guarda)` : 'Añadido a "Extras de hoy" (modo demo: no se guarda de verdad)', 'ok')
      setSaving(false); onClose(); return
    }

    const { data: logRow, error: logError } = await supabase.from('meal_logs')
      .insert({ client_id: clientId, date, meal_name: name, note }).select().single()
    if (logError || !logRow) { setSaving(false); toast('No se pudo añadir al diario: ' + (logError?.message ?? ''), 'warn'); return }

    const catalogItems = resolvedCatalog.map(({ row, m }) => ({
      meal_log_id: logRow.id, client_id: clientId, food_id: row.food!.id, name: row.food!.name, grams: m.grams,
      kcal: m.kcal, protein_g: m.proteinG, carbs_g: m.carbsG, fat_g: m.fatG, source: 'catalog', is_estimate: false,
    }))
    const quickItems = resolvedQuick.map(({ row, m }) => ({
      meal_log_id: logRow.id, client_id: clientId, food_id: null, name: row.name.trim(), grams: 1,
      kcal: m.kcal, protein_g: m.proteinG, carbs_g: m.carbsG, fat_g: m.fatG, source: 'quick_add', is_estimate: true,
    }))
    const { error: itemsError } = await supabase.from('extra_log_items').insert([...catalogItems, ...quickItems])
    setSaving(false)
    if (itemsError) { toast('No se pudo guardar el desglose: ' + itemsError.message, 'warn'); return }

    toast(kcalTarget ? `+${total.kcal} kcal añadidas · llevas ${(dayKcal ?? 0) + total.kcal} de ${kcalTarget}` : `+${total.kcal} kcal añadidas a Extras de hoy`, 'ok')
    window.dispatchEvent(new Event('nutrifit:meal-logged'))
    onClose()
  }

  return (
    <BottomSheet open onClose={onClose} title="Añadir varios alimentos">
      <div className="space-y-3">
        {recentChips.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1"><History className="w-3.5 h-3.5" /> Añadir de nuevo</p>
            <div className="flex flex-wrap gap-1.5">
              {recentChips.map(chip => (
                <button key={chip.food.id} type="button" onClick={() => addChip(chip)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-bg-alt text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                  {chip.food.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-1.5" role="group" aria-label="Cómo añadir el alimento">
          <button type="button" onClick={() => setMode('catalog')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${mode === 'catalog' ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>
            <Search className="w-3.5 h-3.5" /> Buscar en el catálogo
          </button>
          <button type="button" onClick={() => setMode('quick_add')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${mode === 'quick_add' ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>
            <Keyboard className="w-3.5 h-3.5" /> Apuntar solo macros
          </button>
        </div>

        {mode === 'catalog' ? (
          <div className="space-y-1.5">
            {catalogRows.map(row => {
              const suggestions = suggestFor === row.id && row.query.trim().length > 0 && !row.food
                ? foods.filter(f => f.name.toLowerCase().includes(row.query.toLowerCase())).slice(0, 6)
                : []
              return (
                <div key={row.id} className="relative flex items-center gap-1.5">
                  <input value={row.query}
                    onChange={e => updateCatalogRow(row.id, { query: e.target.value, food: null })}
                    onFocus={() => setSuggestFor(row.id)} onBlur={() => setTimeout(() => setSuggestFor(null), 150)}
                    placeholder="Busca un alimento..."
                    className={`flex-1 px-2.5 py-2 bg-bg border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20 ${row.food ? 'border-ok/40' : 'border-border'}`} />
                  <input value={row.gramsText} onChange={e => updateCatalogRow(row.id, { gramsText: e.target.value })}
                    inputMode="decimal" placeholder="g" aria-label={`Gramos de ${row.query || 'este alimento'}`}
                    className="w-16 px-2.5 py-2 bg-bg border border-border rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-accent/20" />
                  <button type="button" onClick={() => setCatalogRows(rows => rows.length > 1 ? rows.filter(r => r.id !== row.id) : rows)}
                    aria-label="Quitar fila" className="p-1.5 text-muted hover:text-warn flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {suggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-10 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {suggestions.map(f => (
                        <button key={f.id} type="button"
                          onMouseDown={() => { updateCatalogRow(row.id, { query: f.name, food: f }); setSuggestFor(null) }}
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
            <button type="button" onClick={() => setCatalogRows(rows => [...rows, blankCatalogRow()])}
              className="flex items-center gap-1 text-xs text-muted hover:text-accent">
              <ListPlus className="w-3.5 h-3.5" /> Añadir otro alimento
            </button>
            {unresolvedCatalogCount > 0 && (
              <p className="text-xs text-warn">
                {unresolvedCatalogCount === 1 ? 'Un alimento no está en el catálogo' : `${unresolvedCatalogCount} alimentos no están en el catálogo`} — elige uno de la lista, o usa "Apuntar solo macros".
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {quickRows.length === 0 && (
              <p className="text-xs text-muted">Para lo que no está en el catálogo: pon un nombre y, al menos, las kcal. Proteína, carbohidratos y grasa son opcionales.</p>
            )}
            {quickRows.map(row => (
              <div key={row.id} className="border border-border rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input value={row.name} onChange={e => updateQuickRow(row.id, { name: e.target.value })}
                    placeholder="¿Qué has comido?"
                    className="flex-1 px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20" />
                  <button type="button" onClick={() => setQuickRows(rows => rows.filter(r => r.id !== row.id))}
                    aria-label="Quitar fila" className="p-1.5 text-muted hover:text-warn flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <input value={row.kcalText} onChange={e => updateQuickRow(row.id, { kcalText: e.target.value })} inputMode="decimal" placeholder="Kcal*"
                    className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                  <input value={row.proteinText} onChange={e => updateQuickRow(row.id, { proteinText: e.target.value })} inputMode="decimal" placeholder="Prot. g"
                    className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                  <input value={row.carbsText} onChange={e => updateQuickRow(row.id, { carbsText: e.target.value })} inputMode="decimal" placeholder="Carbos g"
                    className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                  <input value={row.fatText} onChange={e => updateQuickRow(row.id, { fatText: e.target.value })} inputMode="decimal" placeholder="Grasa g"
                    className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setQuickRows(rows => [...rows, blankQuickAddRow()])}
              className="flex items-center gap-1 text-xs text-muted hover:text-accent">
              <ListPlus className="w-3.5 h-3.5" /> Añadir otro alimento
            </button>
          </div>
        )}

        {allItems.length > 0 && (
          <div className="grid grid-cols-4 gap-2" aria-live="polite">
            {[['Kcal', total.kcal, ''], ['Prot.', total.proteinG, 'g'], ['Carbos', total.carbsG, 'g'], ['Grasas', total.fatG, 'g']].map(([label, value, suffix]) => (
              <div key={label as string} className="bg-card border border-border rounded-xl px-2 py-3 text-center">
                <p className="text-lg font-serif font-bold">{String(value).replace('.', ',')}{suffix}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
        )}

        <Button className="w-full" onClick={save} loading={saving} disabled={allItems.length === 0}>Añadir a mi diario de hoy</Button>
        <p className="text-xs text-muted">Catálogo: valores por 100 g verificados. Quick Add: los números que tecleaste, sin comprobar.</p>
      </div>
    </BottomSheet>
  )
}
