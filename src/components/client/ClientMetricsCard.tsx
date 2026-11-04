import { useEffect, useMemo, useState } from 'react'
import { Ruler } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { bodyMetricFromRow, metricDefinitionFromRow } from '../../lib/mappers'
import { DEMO_METRIC_DEFS, demoBodyMetrics } from '../../lib/demo-data'
import { toLocalISODate } from '../../lib/date'
import { MetricDefinition, MetricValue, clientVisibleSeries, formatMetricDelta, formatMetricValue, summarizeMetric } from '../../lib/bodyMetrics'
import { MetricSparkline } from '../shared/MetricSparkline'

/**
 * «Tus medidas» en el Progreso del cliente: lo que el nutricionista ha medido y le deja ver. Lo que oculta no llega aquí
 * ni por la API (lo impide la base de datos); en la demo se filtra además a mano para enseñar lo mismo.
 */
export function ClientMetricsCard({ clientId, demoMode }: { clientId: string; demoMode?: boolean }) {
  const [defs, setDefs] = useState<MetricDefinition[]>(() => demoMode ? DEMO_METRIC_DEFS : [])
  const [values, setValues] = useState<MetricValue[]>(() => demoMode && clientId === 'demo-client-001' ? demoBodyMetrics(toLocalISODate(new Date())) : [])

  useEffect(() => {
    if (demoMode) return
    let cancelled = false
    Promise.all([
      supabase.from('metric_definitions').select('*').order('sort_order'),
      supabase.from('body_metrics').select('*').eq('client_id', clientId).order('date'),
    ]).then(([d, v]) => {
      if (cancelled) return
      setDefs((d.data || []).map(metricDefinitionFromRow))
      setValues((v.data || []).map(bodyMetricFromRow))
    })
    return () => { cancelled = true }
  }, [clientId, demoMode])

  const series = useMemo(() => clientVisibleSeries(defs, values), [defs, values])
  if (series.length === 0) return null

  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 mb-2"><Ruler className="w-3.5 h-3.5" /> Tus medidas</p>
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
    </div>
  )
}
