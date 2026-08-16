import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { foodFromRow } from '../../lib/mappers'
import { Food } from '../../types'
import { FlaskConical } from 'lucide-react'

type Mineral = 'calciumMg' | 'ironMg' | 'zincMg'

const MINERALS: { key: Mineral; label: string; unit: string }[] = [
  { key: 'calciumMg', label: 'Calcio', unit: 'mg' },
  { key: 'ironMg', label: 'Hierro', unit: 'mg' },
  { key: 'zincMg', label: 'Zinc', unit: 'mg' },
]

/** Nivel relativo (bajo/medio/alto) de un valor dentro del rango de todos los
 * alimentos que sí tienen dato para ese mineral — para el código de colores. */
function levelClass(value: number | null | undefined, min: number, max: number): string {
  if (value == null) return 'text-muted'
  if (max === min) return 'text-ink'
  const pct = (value - min) / (max - min)
  if (pct >= 0.66) return 'text-ok font-bold'
  if (pct >= 0.33) return 'text-warn font-semibold'
  return 'text-muted'
}

export function MicronutrientesTab() {
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState('Todos')
  const [highlight, setHighlight] = useState<Mineral>('calciumMg')

  useEffect(() => {
    supabase.from('foods').select('*').order('name').then(({ data }) => {
      setFoods((data || []).map(foodFromRow))
      setLoading(false)
    })
  }, [])

  const groups = useMemo(() => ['Todos', ...Array.from(new Set(foods.map(f => f.category))).sort()], [foods])

  const filtered = useMemo(() => {
    const list = group === 'Todos' ? foods : foods.filter(f => f.category === group)
    return [...list].sort((a, b) => {
      const av = a[highlight] ?? -1, bv = b[highlight] ?? -1
      return (bv as number) - (av as number)
    })
  }, [foods, group, highlight])

  const range = useMemo(() => {
    const values = foods.map(f => f[highlight]).filter((v): v is number => v != null)
    return { min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0 }
  }, [foods, highlight])

  const highlightMeta = MINERALS.find(m => m.key === highlight)!

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="w-5 h-5 text-accent" />
          <h1 className="text-2xl font-serif font-bold">Micronutrientes</h1>
        </div>
        <p className="text-sm text-muted">
          Consulta qué alimentos son más ricos en calcio, hierro o zinc — filtra por grupo y ordena por el mineral que te interese.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Grupo de alimento</label>
            <select value={group} onChange={e => setGroup(e.target.value)}
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent">
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Micronutriente a resaltar</label>
            <div className="flex gap-1.5">
              {MINERALS.map(m => (
                <button key={m.key} onClick={() => setHighlight(m.key)}
                  className={`flex-1 px-2 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                    highlight === m.key ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-accent'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted pt-1">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ok inline-block" /> Rico en {highlightMeta.label.toLowerCase()}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warn inline-block" /> Moderado</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-border inline-block" /> Bajo o sin dato</span>
        </div>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted border-b border-border">
                <th className="py-2 pr-3">Alimento</th>
                <th className="py-2 pr-3">Grupo</th>
                {MINERALS.map(m => (
                  <th key={m.key} className={`py-2 pr-3 text-right ${m.key === highlight ? 'text-ink' : ''}`}>{m.label} ({m.unit})</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(f => (
                <tr key={f.id}>
                  <td className="py-2 pr-3 font-medium">{f.name}</td>
                  <td className="py-2 pr-3 text-muted">{f.category}</td>
                  {MINERALS.map(m => (
                    <td key={m.key}
                      className={`py-2 pr-3 text-right ${m.key === highlight ? levelClass(f[m.key], range.min, range.max) : 'text-muted'}`}>
                      {f[m.key] != null ? f[m.key] : '—'}
                    </td>
                  ))}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted">Sin alimentos en este grupo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted">Valores aproximados por 100g. Colores relativos al rango de {highlightMeta.label.toLowerCase()} entre todos los alimentos del catálogo.</p>
      </div>
    </div>
  )
}
