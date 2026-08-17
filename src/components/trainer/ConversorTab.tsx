import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { foodFromRow } from '../../lib/mappers'
import { Food } from '../../types'
import { convertQuantity, computeMacros, computeSubstitution, computeSubstitutionDiff, CONVERTIBLE_UNITS, MacroKey } from '../../lib/foodConversion'
import { Button } from '../shared/Button'
import { toast } from '../shared/Toast'
import { Calculator, ArrowRightLeft, Plus, X } from 'lucide-react'

const MACRO_OPTIONS: { key: MacroKey; label: string }[] = [
  { key: 'proteinG', label: 'Proteína' },
  { key: 'kcal', label: 'Kcal' },
  { key: 'carbsG', label: 'Carbohidratos' },
  { key: 'fatG', label: 'Grasas' },
]

const FOOD_CATEGORIES = ['Verdura', 'Fruta', 'Carbohidrato', 'Proteína', 'Lácteo', 'Legumbre', 'Grasa', 'Fruto seco', 'Suplemento', 'Otros']

interface NewFoodDraft {
  name: string; category: string
  kcal: string; proteinG: string; carbsG: string; fatG: string
  fiberG: string; sugarG: string; sodiumMg: string; saturatedFatG: string
  calciumMg: string; ironMg: string; zincMg: string
}
function blankFoodDraft(name = ''): NewFoodDraft {
  return { name, category: 'Otros', kcal: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', sugarG: '', sodiumMg: '', saturatedFatG: '', calciumMg: '', ironMg: '', zincMg: '' }
}

export function ConversorTab({ nutricionistaId, demoMode }: { nutricionistaId?: string; demoMode?: boolean }) {
  const [foods, setFoods] = useState<Food[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState('g')

  const [subQuery, setSubQuery] = useState('')
  const [subSelected, setSubSelected] = useState<Food | null>(null)
  const [matchBy, setMatchBy] = useState<MacroKey>('proteinG')

  const [addingFood, setAddingFood] = useState(false)
  const [newFood, setNewFood] = useState<NewFoodDraft>(blankFoodDraft())
  const [savingFood, setSavingFood] = useState(false)

  const loadFoods = useCallback(async () => {
    const { data } = await supabase.from('foods').select('*').order('name')
    setFoods((data || []).map(foodFromRow))
  }, [])

  useEffect(() => { loadFoods() }, [loadFoods])

  const openAddFood = () => { setNewFood(blankFoodDraft(query.trim())); setAddingFood(true) }
  const closeAddFood = () => setAddingFood(false)

  const saveNewFood = async () => {
    if (!newFood.name.trim()) { toast('Ponle un nombre al alimento', 'warn'); return }
    if (!newFood.kcal || !newFood.proteinG || !newFood.carbsG || !newFood.fatG) {
      toast('Rellena al menos kcal, proteína, carbohidratos y grasas', 'warn'); return
    }
    if (demoMode || !nutricionistaId) { toast('Modo demo: los cambios no se guardan', 'ok'); closeAddFood(); return }
    setSavingFood(true)
    const { data, error } = await supabase.from('foods').insert({
      nutricionista_id: nutricionistaId, name: newFood.name.trim(), category: newFood.category,
      kcal: parseFloat(newFood.kcal) || 0, protein_g: parseFloat(newFood.proteinG) || 0,
      carbs_g: parseFloat(newFood.carbsG) || 0, fat_g: parseFloat(newFood.fatG) || 0,
      fiber_g: newFood.fiberG ? parseFloat(newFood.fiberG) : null, sugar_g: newFood.sugarG ? parseFloat(newFood.sugarG) : null,
      sodium_mg: newFood.sodiumMg ? parseFloat(newFood.sodiumMg) : null, saturated_fat_g: newFood.saturatedFatG ? parseFloat(newFood.saturatedFatG) : null,
      calcium_mg: newFood.calciumMg ? parseFloat(newFood.calciumMg) : null, iron_mg: newFood.ironMg ? parseFloat(newFood.ironMg) : null,
      zinc_mg: newFood.zincMg ? parseFloat(newFood.zincMg) : null, reference: 'Añadido por ti',
    }).select().single()
    setSavingFood(false)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast(`"${newFood.name.trim()}" añadido a tu catálogo ✓`, 'ok')
    closeAddFood()
    await loadFoods()
    if (data) { setSelected(foodFromRow(data)); setQuery('') }
  }

  const suggestions = query.trim().length > 0 && !selected
    ? foods.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []
  const subSuggestions = subQuery.trim().length > 0 && !subSelected
    ? foods.filter(f => f.name.toLowerCase().includes(subQuery.toLowerCase()) && f.id !== selected?.id).slice(0, 8)
    : []

  const qtyNum = parseFloat(quantity)
  const macros = selected && !isNaN(qtyNum) ? computeMacros(selected, qtyNum, unit) : null

  const equivalents = useMemo(() => {
    if (isNaN(qtyNum)) return []
    return CONVERTIBLE_UNITS.filter(u => u !== unit).map(u => ({ unit: u, value: convertQuantity(qtyNum, unit, u) }))
  }, [qtyNum, unit])

  const substituteGrams = selected && subSelected && !isNaN(qtyNum)
    ? computeSubstitution(selected, qtyNum, unit, subSelected, matchBy)
    : null

  const substituteDiff = selected && subSelected && substituteGrams != null && !isNaN(qtyNum)
    ? computeSubstitutionDiff(selected, qtyNum, unit, subSelected, substituteGrams)
    : null

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Calculator className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-serif font-bold">Conversor de alimentos</h1>
        </div>
        <p className="text-sm text-muted mb-5">
          Elige un alimento y una cantidad para ver sus macros y la equivalencia en otras unidades caseras (g, ml, cucharada, cucharadita, taza, vaso, puñado).
        </p>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="relative">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Alimento</label>
            <input
              value={selected ? selected.name : query}
              onChange={e => { setQuery(e.target.value); setSelected(null) }}
              placeholder="Busca un alimento..."
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            {suggestions.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {suggestions.map(f => (
                  <button key={f.id} type="button" onClick={() => { setSelected(f); setQuery('') }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 hover:text-accent transition-colors flex items-center justify-between gap-2">
                    <span>{f.name}</span>
                    <span className="text-muted text-xs flex-shrink-0">{f.kcal} kcal/100g</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!addingFood ? (
            <button onClick={openAddFood} className="flex items-center gap-1 text-xs font-bold text-accent">
              <Plus className="w-3.5 h-3.5" /> ¿No está en la lista? Añade tu propio alimento
            </button>
          ) : (
            <div className="bg-bg-alt rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <input value={newFood.name} onChange={e => setNewFood({ ...newFood, name: e.target.value })} placeholder="Nombre del alimento" autoFocus
                  className="flex-1 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-accent/20" />
                <select value={newFood.category} onChange={e => setNewFood({ ...newFood, category: e.target.value })}
                  className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
                  {FOOD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={closeAddFood} className="p-1.5 text-muted hover:text-warn flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-[10px] text-muted">Todos los valores son por 100g. Kcal/proteína/carbohidratos/grasas son obligatorios, el resto es opcional.</p>
              <div className="grid grid-cols-4 gap-2">
                <FoodNumInput label="Kcal *" value={newFood.kcal} onChange={v => setNewFood({ ...newFood, kcal: v })} />
                <FoodNumInput label="Prot. (g) *" value={newFood.proteinG} onChange={v => setNewFood({ ...newFood, proteinG: v })} />
                <FoodNumInput label="Carbos (g) *" value={newFood.carbsG} onChange={v => setNewFood({ ...newFood, carbsG: v })} />
                <FoodNumInput label="Grasas (g) *" value={newFood.fatG} onChange={v => setNewFood({ ...newFood, fatG: v })} />
                <FoodNumInput label="Fibra (g)" value={newFood.fiberG} onChange={v => setNewFood({ ...newFood, fiberG: v })} />
                <FoodNumInput label="Azúcares (g)" value={newFood.sugarG} onChange={v => setNewFood({ ...newFood, sugarG: v })} />
                <FoodNumInput label="Sodio (mg)" value={newFood.sodiumMg} onChange={v => setNewFood({ ...newFood, sodiumMg: v })} />
                <FoodNumInput label="Sat. (g)" value={newFood.saturatedFatG} onChange={v => setNewFood({ ...newFood, saturatedFatG: v })} />
                <FoodNumInput label="Calcio (mg)" value={newFood.calciumMg} onChange={v => setNewFood({ ...newFood, calciumMg: v })} />
                <FoodNumInput label="Hierro (mg)" value={newFood.ironMg} onChange={v => setNewFood({ ...newFood, ironMg: v })} />
                <FoodNumInput label="Zinc (mg)" value={newFood.zincMg} onChange={v => setNewFood({ ...newFood, zincMg: v })} />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={saveNewFood} loading={savingFood}>Guardar alimento</Button>
                <Button size="sm" variant="ghost" onClick={closeAddFood}>Cancelar</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Cantidad</label>
              <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Unidad</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm">
                {CONVERTIBLE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {selected && macros && (
            <div className="pt-3 border-t border-border space-y-3">
              <div className="grid grid-cols-5 gap-2 text-center">
                <MacroBox label="Kcal" value={macros.kcal} />
                <MacroBox label="Prot." value={`${macros.proteinG}g`} />
                <MacroBox label="Carbos" value={`${macros.carbsG}g`} />
                <MacroBox label="Grasas" value={`${macros.fatG}g`} />
                <MacroBox label="Fibra" value={macros.fiberG != null ? `${macros.fiberG}g` : '—'} />
              </div>
              {(macros.sugarG != null || macros.sodiumMg != null || macros.saturatedFatG != null) && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Nutrientes ampliados</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <MacroBox label="Azúcares" value={macros.sugarG != null ? `${macros.sugarG}g` : '—'} />
                    <MacroBox label="Sodio" value={macros.sodiumMg != null ? `${macros.sodiumMg}mg` : '—'} />
                    <MacroBox label="Sat." value={macros.saturatedFatG != null ? `${macros.saturatedFatG}g` : '—'} />
                  </div>
                </div>
              )}
              {(macros.calciumMg != null || macros.ironMg != null || macros.zincMg != null) && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Minerales</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <MacroBox label="Calcio" value={macros.calciumMg != null ? `${macros.calciumMg}mg` : '—'} />
                    <MacroBox label="Hierro" value={macros.ironMg != null ? `${macros.ironMg}mg` : '—'} />
                    <MacroBox label="Zinc" value={macros.zincMg != null ? `${macros.zincMg}mg` : '—'} />
                  </div>
                </div>
              )}
              {selected.reference && (
                <p className="text-[11px] text-muted">Fuente: {selected.reference}</p>
              )}
              {equivalents.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Equivale a</p>
                  <div className="flex flex-wrap gap-1.5">
                    {equivalents.map(e => (
                      <span key={e.unit} className="px-2.5 py-1 bg-bg-alt rounded-lg text-xs">
                        {e.value != null ? Math.round(e.value * 10) / 10 : '—'} {e.unit}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {selected && !macros && (
            <p className="text-xs text-warn pt-2 border-t border-border">
              La unidad "{unit}" no tiene una equivalencia fija en gramos para este cálculo (ej. "unidad" varía según el alimento).
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <ArrowRightLeft className="w-4 h-4 text-accent" />
          <h2 className="text-lg font-serif font-bold">Sustituir por otro alimento</h2>
        </div>
        <p className="text-xs text-muted mb-3">
          {selected
            ? `¿Por cuánto alimento sustituyo ${quantity || '?'} ${unit} de ${selected.name} manteniendo los mismos macros?`
            : 'Elige un alimento de la lista desplegable de arriba (haz clic en una sugerencia) para poder sustituirlo.'}
        </p>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="relative">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Sustituir por</label>
            <input
              value={subSelected ? subSelected.name : subQuery}
              onChange={e => { setSubQuery(e.target.value); setSubSelected(null) }}
              placeholder="Busca el alimento sustituto..."
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            {subSuggestions.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {subSuggestions.map(f => (
                  <button key={f.id} type="button" onClick={() => { setSubSelected(f); setSubQuery('') }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 hover:text-accent transition-colors flex items-center justify-between gap-2">
                    <span>{f.name}</span>
                    <span className="text-muted text-xs flex-shrink-0">{f.kcal} kcal/100g</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Igualar por</label>
            <div className="flex flex-wrap gap-1.5">
              {MACRO_OPTIONS.map(m => (
                <button key={m.key} onClick={() => setMatchBy(m.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    matchBy === m.key ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {subSelected && !selected && (
            <p className="text-xs text-warn pt-2 border-t border-border">
              Falta elegir el alimento de origen: haz clic en una sugerencia de la lista de "Alimento" arriba.
            </p>
          )}
          {subSelected && selected && substituteGrams != null && (
            <div className="pt-3 border-t border-border">
              <p className="text-sm">
                <span className="font-bold text-accent">{Math.round(substituteGrams * 10) / 10}g</span> de {subSelected.name}
                {' '}≈ misma {MACRO_OPTIONS.find(m => m.key === matchBy)?.label.toLowerCase()} que {quantity} {unit} de {selected.name}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {CONVERTIBLE_UNITS.filter(u => u !== 'g').map(u => {
                  const val = convertQuantity(substituteGrams, 'g', u)
                  return val != null ? (
                    <span key={u} className="px-2.5 py-1 bg-bg-alt rounded-lg text-xs">{Math.round(val * 10) / 10} {u}</span>
                  ) : null
                })}
              </div>
              {substituteDiff && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Diferencia al cambiar (lo que ganas o pierdes en el resto de macros)
                  </p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <DiffBox label="Kcal" value={substituteDiff.kcal} matched={matchBy === 'kcal'} />
                    <DiffBox label="Prot." value={substituteDiff.proteinG} unit="g" matched={matchBy === 'proteinG'} />
                    <DiffBox label="Carbos" value={substituteDiff.carbsG} unit="g" matched={matchBy === 'carbsG'} />
                    <DiffBox label="Grasas" value={substituteDiff.fatG} unit="g" matched={matchBy === 'fatG'} />
                  </div>
                </div>
              )}
            </div>
          )}
          {subSelected && selected && substituteGrams == null && (
            <p className="text-xs text-warn pt-2 border-t border-border">
              {subSelected.name} no aporta nada de {MACRO_OPTIONS.find(m => m.key === matchBy)?.label.toLowerCase()} — prueba a igualar por otro macro.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function FoodNumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
    </div>
  )
}

function MacroBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg-alt rounded-xl py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </div>
  )
}

function DiffBox({ label, value, unit = '', matched }: { label: string; value: number; unit?: string; matched: boolean }) {
  const sign = value > 0 ? '+' : ''
  return (
    <div className={`rounded-xl py-2.5 ${matched ? 'bg-bg-alt' : value > 0 ? 'bg-warn/10' : value < 0 ? 'bg-ok/10' : 'bg-bg-alt'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${matched ? 'text-muted' : value > 0 ? 'text-warn' : value < 0 ? 'text-ok' : ''}`}>
        {matched ? '≈0' : `${sign}${value}${unit}`}
      </p>
    </div>
  )
}
