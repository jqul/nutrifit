import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { foodFromRow } from '../../lib/mappers'
import { Food } from '../../types'
import { convertQuantity, computeMacros, computeSubstitution, CONVERTIBLE_UNITS, MacroKey } from '../../lib/foodConversion'
import { Calculator, ArrowRightLeft } from 'lucide-react'

const MACRO_OPTIONS: { key: MacroKey; label: string }[] = [
  { key: 'proteinG', label: 'Proteína' },
  { key: 'kcal', label: 'Kcal' },
  { key: 'carbsG', label: 'Carbohidratos' },
  { key: 'fatG', label: 'Grasas' },
]

export function ConversorTab() {
  const [foods, setFoods] = useState<Food[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState('g')

  const [subQuery, setSubQuery] = useState('')
  const [subSelected, setSubSelected] = useState<Food | null>(null)
  const [matchBy, setMatchBy] = useState<MacroKey>('proteinG')

  useEffect(() => {
    supabase.from('foods').select('*').order('name').then(({ data }) => setFoods((data || []).map(foodFromRow)))
  }, [])

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
              <div className="grid grid-cols-4 gap-2 text-center">
                <MacroBox label="Kcal" value={macros.kcal} />
                <MacroBox label="Prot." value={`${macros.proteinG}g`} />
                <MacroBox label="Carbos" value={`${macros.carbsG}g`} />
                <MacroBox label="Grasas" value={`${macros.fatG}g`} />
              </div>
              {(macros.fiberG != null || macros.sugarG != null || macros.sodiumMg != null || macros.saturatedFatG != null) && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Nutrientes ampliados</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <MacroBox label="Fibra" value={macros.fiberG != null ? `${macros.fiberG}g` : '—'} />
                    <MacroBox label="Azúcares" value={macros.sugarG != null ? `${macros.sugarG}g` : '—'} />
                    <MacroBox label="Sodio" value={macros.sodiumMg != null ? `${macros.sodiumMg}mg` : '—'} />
                    <MacroBox label="Sat." value={macros.saturatedFatG != null ? `${macros.saturatedFatG}g` : '—'} />
                  </div>
                </div>
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

function MacroBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-bg-alt rounded-xl py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm font-bold mt-0.5">{value}</p>
    </div>
  )
}
