import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { bodyMetricFromRow, metricDefinitionFromRow } from '../../../lib/mappers'
import { DEMO_METRIC_DEFS, demoBodyMetrics } from '../../../lib/demo-data'
import { toLocalISODate } from '../../../lib/date'
import {
  MetricDefinition, MetricValue, formatMetricDelta, formatMetricValue, missingStandardMetrics, parseMetricInput, pointsOf, summarizeMetric,
} from '../../../lib/bodyMetrics'
import { MetricSparkline } from '../../shared/MetricSparkline'
import { toast } from '../../shared/Toast'
import { Button } from '../../shared/Button'
import { Eye, EyeOff, Plus, Ruler, Settings2, Trash2, X } from 'lucide-react'

/**
 * Medidas corporales del cliente (% de grasa, cintura, cadera… y métricas propias del nutricionista), con su evolución.
 * El peso sigue en su gráfica de arriba. Cada métrica puede ocultarse al cliente.
 */
export function BodyMetricsCard({ clientId, nutricionistaId, demoMode }: { clientId: string; nutricionistaId: string; demoMode?: boolean }) {
  const today = toLocalISODate(new Date())
  const [defs, setDefs] = useState<MetricDefinition[]>(() => demoMode ? DEMO_METRIC_DEFS : [])
  const [values, setValues] = useState<MetricValue[]>(() => demoMode && clientId === 'demo-client-001' ? demoBodyMetrics(today) : [])
  const [adding, setAdding] = useState<{ date: string; inputs: Record<string, string> } | null>(null)
  const [managing, setManaging] = useState(false)
  const [custom, setCustom] = useState({ name: '', unit: '', visible: true })
  const [openId, setOpenId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (demoMode) return
    let { data: defRows } = await supabase.from('metric_definitions').select('*').eq('nutricionista_id', nutricionistaId).order('sort_order').order('created_at')
    // Las estándar se crean una sola vez por nutricionista, la primera vez que se abren las medidas.
    const missing = missingStandardMetrics((defRows || []).map(r => ({ key: r.key as string | null })))
    if (missing.length > 0) {
      const base = (defRows || []).reduce((max, r) => Math.max(max, Number(r.sort_order) || 0), -1) + 1
      await supabase.from('metric_definitions').upsert(
        missing.map((m, i) => ({ nutricionista_id: nutricionistaId, key: m.key, name: m.name, unit: m.unit, sort_order: base + i })),
        { onConflict: 'nutricionista_id,key', ignoreDuplicates: true })
      defRows = (await supabase.from('metric_definitions').select('*').eq('nutricionista_id', nutricionistaId).order('sort_order').order('created_at')).data
    }
    const { data: valueRows } = await supabase.from('body_metrics').select('*').eq('client_id', clientId).order('date')
    setDefs((defRows || []).map(metricDefinitionFromRow))
    setValues((valueRows || []).map(bodyMetricFromRow))
  }, [clientId, nutricionistaId, demoMode])
  useEffect(() => { load() }, [load])

  const withData = useMemo(() => defs.filter(d => values.some(v => v.metricId === d.id)), [defs, values])
  const lastOf = (id: string) => summarizeMetric(pointsOf(values, id))?.latest.value

  const noteDemo = () => { toast('Modo demo: los cambios no se guardan', 'ok') }

  const saveMeasurements = async () => {
    if (!adding) return
    const rows = defs.flatMap(d => {
      const raw = (adding.inputs[d.id] ?? '').trim()
      if (!raw) return []
      const value = parseMetricInput(raw)
      return [{ def: d, raw, value }]
    })
    const bad = rows.find(r => r.value == null)
    if (bad) { toast(`«${bad.def.name}»: escribe un número mayor que 0 (por ejemplo 82,5).`, 'warn'); return }
    if (rows.length === 0) { toast('Escribe al menos una medida.', 'warn'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(adding.date) || adding.date > today) { toast('La fecha no puede ser futura.', 'warn'); return }
    if (demoMode) { noteDemo(); setAdding(null); return }
    setSaving(true)
    const { error } = await supabase.from('body_metrics').upsert(
      rows.map(r => ({ client_id: clientId, metric_id: r.def.id, date: adding.date, value: r.value })),
      { onConflict: 'client_id,metric_id,date' })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast(`${rows.length} ${rows.length === 1 ? 'medida guardada' : 'medidas guardadas'} ✓`, 'ok')
    setAdding(null)
    await load()
  }

  const deleteValue = async (v: MetricValue) => {
    if (demoMode) { noteDemo(); return }
    setValues(prev => prev.filter(x => x.id !== v.id))
    const { error } = await supabase.from('body_metrics').delete().eq('id', v.id)
    if (error) { toast('Error: ' + error.message, 'warn'); await load() }
  }

  const toggleVisible = async (d: MetricDefinition) => {
    if (demoMode) { noteDemo(); return }
    setDefs(prev => prev.map(x => x.id === d.id ? { ...x, clientVisible: !x.clientVisible } : x))
    const { error } = await supabase.from('metric_definitions').update({ client_visible: !d.clientVisible }).eq('id', d.id)
    if (error) { toast('Error: ' + error.message, 'warn'); await load() }
    else toast(d.clientVisible ? `«${d.name}» ya no la ve ningún cliente tuyo` : `«${d.name}» la ven tus clientes`, 'ok')
  }

  const addCustom = async () => {
    const name = custom.name.trim()
    if (!name) { toast('Ponle un nombre a la métrica.', 'warn'); return }
    if (defs.some(d => d.name.toLowerCase() === name.toLowerCase())) { toast('Ya tienes una métrica con ese nombre.', 'warn'); return }
    if (demoMode) { noteDemo(); setCustom({ name: '', unit: '', visible: true }); return }
    const { error } = await supabase.from('metric_definitions').insert({
      nutricionista_id: nutricionistaId, name, unit: custom.unit.trim(), client_visible: custom.visible, sort_order: defs.length,
    })
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast(`Métrica «${name}» creada ✓`, 'ok')
    setCustom({ name: '', unit: '', visible: true })
    await load()
  }

  const deleteCustom = async (d: MetricDefinition) => {
    const count = values.filter(v => v.metricId === d.id).length
    if (!window.confirm(`¿Eliminar la métrica «${d.name}»? Se borran también sus medidas de TODOS tus clientes.${count ? ` (De este cliente hay ${count}.)` : ''}`)) return
    if (demoMode) { noteDemo(); return }
    const { error } = await supabase.from('metric_definitions').delete().eq('id', d.id)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast('Métrica eliminada', 'ok')
    await load()
  }

  const input = 'w-full px-2.5 py-1.5 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20'

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm flex items-center gap-2"><Ruler className="w-4 h-4 text-muted" /> Medidas corporales</p>
        <div className="flex items-center gap-3">
          <button onClick={() => setManaging(m => !m)} aria-pressed={managing} className="flex items-center gap-1 text-xs font-bold text-muted hover:text-ink"><Settings2 className="w-3.5 h-3.5" /> Métricas</button>
          {!adding && <button onClick={() => setAdding({ date: today, inputs: {} })} className="flex items-center gap-1 text-xs font-bold text-accent"><Plus className="w-3.5 h-3.5" /> Añadir medidas</button>}
        </div>
      </div>

      {withData.length === 0 && !adding && (
        <p className="text-xs text-muted">Todavía no hay medidas. Pulsa «Añadir medidas» en la consulta (cintura, cadera, % de grasa…) y verás aquí su evolución. El cliente la ve en su app, salvo lo que tú ocultes.</p>
      )}

      {withData.length > 0 && (
        <ul className="divide-y divide-border/60">
          {withData.map(d => {
            const points = pointsOf(values, d.id)
            const s = summarizeMetric(points)!
            const open = openId === d.id
            return (
              <li key={d.id} className="py-2">
                <button onClick={() => setOpenId(open ? null : d.id)} aria-expanded={open} className="w-full flex items-center gap-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {d.name}
                      {!d.clientVisible && <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-muted"><EyeOff className="w-3 h-3" /> oculta al cliente</span>}
                    </span>
                    <span className="block text-xs text-muted">
                      {s.deltaFromPrevious != null ? <>Desde la anterior: <span className="font-semibold text-ink">{formatMetricDelta(s.deltaFromPrevious, d.unit)}</span> · Desde la primera: <span className="font-semibold text-ink">{formatMetricDelta(s.deltaFromFirst!, d.unit)}</span></> : 'Una sola medida'}
                    </span>
                  </span>
                  <MetricSparkline points={points} label={d.name} />
                  <span className="w-20 text-right flex-shrink-0">
                    <span className="block font-serif font-bold text-base">{formatMetricValue(s.latest.value, d.unit)}</span>
                    <span className="block text-[11px] text-muted">{s.latest.date.split('-').reverse().join('/')}</span>
                  </span>
                </button>
                {open && (
                  <ul className="mt-2 ml-1 space-y-0.5">
                    {[...values.filter(v => v.metricId === d.id)].sort((a, b) => b.date.localeCompare(a.date)).map(v => (
                      <li key={v.id} className="flex items-center justify-between text-xs text-muted">
                        <span>{v.date.split('-').reverse().join('/')} · <span className="text-ink font-medium">{formatMetricValue(v.value, d.unit)}</span></span>
                        <button onClick={() => deleteValue(v)} className="p-1 hover:text-warn" aria-label={`Borrar la medida del ${v.date}`}><Trash2 className="w-3 h-3" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {adding && (
        <div className="rounded-xl border border-border p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Nuevas medidas</p>
            <button onClick={() => setAdding(null)} className="p-1 text-muted hover:text-warn" aria-label="Cerrar"><X className="w-4 h-4" /></button>
          </div>
          <label className="block text-xs text-muted">Fecha
            <input type="date" max={today} value={adding.date} onChange={e => setAdding({ ...adding, date: e.target.value })} className={`${input} mt-1 max-w-[11rem]`} />
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {defs.map(d => (
              <label key={d.id} className="block text-xs text-muted">{d.name}{d.unit ? ` (${d.unit})` : ''}
                <input inputMode="decimal" value={adding.inputs[d.id] ?? ''} placeholder={lastOf(d.id) != null ? String(lastOf(d.id)).replace('.', ',') : ''}
                  onChange={e => setAdding({ ...adding, inputs: { ...adding.inputs, [d.id]: e.target.value } })} className={`${input} mt-1`} />
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">Rellena solo lo que hayas medido. Si ya había una medida ese día, se sustituye.</p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveMeasurements} loading={saving}>Guardar medidas</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {managing && (
        <div className="rounded-xl border border-border p-3 space-y-3">
          <p className="text-xs text-muted">Qué mides con tus clientes (vale para todos) y si ellos lo ven en su app. Lo que ocultas no llega al cliente.</p>
          <ul className="space-y-1">
            {defs.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{d.name}{d.unit ? <span className="text-muted"> ({d.unit})</span> : null}{d.key == null && <span className="ml-1.5 text-[11px] text-accent font-medium">propia</span>}</span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleVisible(d)} className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${d.clientVisible ? 'bg-ok/10 text-ok' : 'bg-bg-alt text-muted'}`}
                    aria-label={`${d.name}: ${d.clientVisible ? 'visible' : 'oculta'} para el cliente`}>
                    {d.clientVisible ? <><Eye className="w-3 h-3" /> La ve el cliente</> : <><EyeOff className="w-3 h-3" /> Oculta</>}
                  </button>
                  {d.key == null && <button onClick={() => deleteCustom(d)} className="p-1.5 text-muted hover:text-warn" aria-label={`Eliminar la métrica ${d.name}`}><Trash2 className="w-3.5 h-3.5" /></button>}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Métrica propia</p>
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <input value={custom.name} onChange={e => setCustom({ ...custom, name: e.target.value })} placeholder="Nombre (Masa muscular, Pliegue…)" maxLength={60} className={input} />
              <input value={custom.unit} onChange={e => setCustom({ ...custom, unit: e.target.value })} placeholder="Unidad" maxLength={12} className={input} />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" className="accent-accent" checked={custom.visible} onChange={e => setCustom({ ...custom, visible: e.target.checked })} /> La ve el cliente en su app
            </label>
            <Button size="sm" variant="outline" onClick={addCustom}>Crear métrica</Button>
          </div>
        </div>
      )}
    </div>
  )
}
