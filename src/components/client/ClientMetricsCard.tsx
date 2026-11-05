import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Ruler, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { bodyMetricFromRow, metricDefinitionFromRow } from '../../lib/mappers'
import { DEMO_METRIC_DEFS, demoBodyMetrics } from '../../lib/demo-data'
import { toLocalISODate } from '../../lib/date'
import {
  MetricDefinition, MetricValue, clientVisibleSeries, formatMetricDelta, formatMetricValue, parseMetricInput, summarizeMetric,
} from '../../lib/bodyMetrics'
import { MetricSparkline } from '../shared/MetricSparkline'
import { toast } from '../shared/Toast'

/**
 * «Tus medidas» en el Progreso del cliente: lo que el nutricionista mide y le deja ver, y donde el propio cliente puede
 * apuntar las suyas (cintura, % de grasa…). Lo que el nutricionista oculta no llega aquí ni por la API (lo impide la base
 * de datos); en la demo se filtra además a mano para enseñar lo mismo.
 */
export function ClientMetricsCard({ clientId, demoMode }: { clientId: string; demoMode?: boolean }) {
  const today = toLocalISODate(new Date())
  const [defs, setDefs] = useState<MetricDefinition[]>(() => demoMode ? DEMO_METRIC_DEFS : [])
  const [values, setValues] = useState<MetricValue[]>(() => demoMode && clientId === 'demo-client-001' ? demoBodyMetrics(today) : [])
  const [adding, setAdding] = useState<{ metricId: string; date: string; value: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (demoMode) return
    const [d, v] = await Promise.all([
      supabase.from('metric_definitions').select('*').order('sort_order'),
      supabase.from('body_metrics').select('*').eq('client_id', clientId).order('date'),
    ])
    setDefs((d.data || []).map(metricDefinitionFromRow))
    setValues((v.data || []).map(bodyMetricFromRow))
  }, [clientId, demoMode])
  useEffect(() => { load() }, [load])

  const visibleDefs = useMemo(() => defs.filter(d => d.clientVisible).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es')), [defs])
  const series = useMemo(() => clientVisibleSeries(defs, values), [defs, values])
  // Sin métricas visibles no hay nada que enseñar ni que apuntar.
  if (visibleDefs.length === 0) return null

  const chosen = adding ? visibleDefs.find(d => d.id === adding.metricId) : null

  const save = async () => {
    if (!adding || !chosen) return
    const value = parseMetricInput(adding.value)
    if (value == null) { toast('Escribe un número mayor que 0 (por ejemplo 82,5).', 'warn'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(adding.date) || adding.date > today) { toast('La fecha no puede ser futura.', 'warn'); return }
    if (demoMode) {
      setValues(prev => [...prev.filter(v => !(v.metricId === chosen.id && v.date === adding.date)), { id: `demo-own-${Date.now()}`, clientId, metricId: chosen.id, date: adding.date, value }])
      toast('Modo demo: la medida no se guarda de verdad', 'ok'); setAdding(null); return
    }
    setSaving(true)
    const { error } = await supabase.from('body_metrics').upsert(
      { client_id: clientId, metric_id: chosen.id, date: adding.date, value }, { onConflict: 'client_id,metric_id,date' })
    setSaving(false)
    if (error) { toast('No se pudo guardar: ' + error.message, 'warn'); return }
    toast(`${chosen.name} guardada ✓`, 'ok')
    setAdding(null)
    await load()
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" /> Tus medidas</p>
        {!adding && (
          <button onClick={() => setAdding({ metricId: visibleDefs[0].id, date: today, value: '' })} className="flex items-center gap-1 text-xs font-bold text-accent">
            <Plus className="w-3.5 h-3.5" /> Apuntar una medida
          </button>
        )}
      </div>

      {series.length === 0 && !adding && (
        <p className="text-xs text-muted">Aquí verás tus medidas (cintura, cadera…) y cómo evolucionan. Puedes apuntar las tuyas cuando te midas, o las apuntará tu nutricionista en consulta.</p>
      )}

      {series.length > 0 && (
        <ul className="divide-y divide-border/60">
          {series.map(({ def, points }) => {
            const s = summarizeMetric(points)!
            return (
              <li key={def.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{def.name}</p>
                  <p className="text-xs text-muted">
                    {s.deltaFromFirst != null ? <>Desde la primera: <span className="font-semibold text-ink">{formatMetricDelta(s.deltaFromFirst, def.unit)}</span></> : 'Primera medida'}
                  </p>
                </div>
                <MetricSparkline points={points} label={def.name} />
                <p className="font-serif font-bold text-base w-20 text-right flex-shrink-0">{formatMetricValue(s.latest.value, def.unit)}</p>
              </li>
            )
          })}
        </ul>
      )}

      {adding && chosen && (
        <div className="mt-3 rounded-xl border border-border p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Nueva medida</p>
            <button onClick={() => setAdding(null)} className="p-1 text-muted hover:text-warn" aria-label="Cerrar"><X className="w-4 h-4" /></button>
          </div>
          <label className="block text-xs text-muted">Qué te has medido
            <select value={adding.metricId} onChange={e => setAdding({ ...adding, metricId: e.target.value })}
              className="w-full mt-1 px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20">
              {visibleDefs.map(d => <option key={d.id} value={d.id}>{d.name}{d.unit ? ` (${d.unit})` : ''}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted">Medida{chosen.unit ? ` (${chosen.unit})` : ''}
              <input inputMode="decimal" value={adding.value} onChange={e => setAdding({ ...adding, value: e.target.value })} placeholder="82,5"
                className="w-full mt-1 px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20" />
            </label>
            <label className="block text-xs text-muted">Fecha
              <input type="date" max={today} value={adding.date} onChange={e => setAdding({ ...adding, date: e.target.value })}
                className="w-full mt-1 px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50">Guardar</button>
            <button onClick={() => setAdding(null)} className="px-3 py-2 text-sm text-muted hover:text-ink">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
