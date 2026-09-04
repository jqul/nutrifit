import { useState, useEffect, useCallback } from 'react'
import { ClientData } from '../../../types'
import { BloodMarkerRow } from '../../../lib/supabase-types'
import { supabase } from '../../../lib/supabase'
import {
  BLOOD_MARKERS, BLOOD_MARKER_MAP, MARKER_CATEGORY_LABELS, MARKER_TEMPLATES,
  adviceForMarker, markerTier, MarkerCategory,
} from '../../../lib/bloodMarkers'
import { HoloRangeBar } from '../../shared/HoloRangeBar'
import { toLocalISODate } from '../../../lib/date'
import { toast } from '../../shared/Toast'
import { Button } from '../../shared/Button'
import { Activity, Plus, Trash2, ChevronDown, ChevronUp, ClipboardList, CheckCircle2, AlertTriangle, Calendar, Clock } from 'lucide-react'

interface DraftEntry { markerKey: string; value: string }

const CATEGORY_ORDER = Object.keys(MARKER_CATEGORY_LABELS) as MarkerCategory[]

function fmtDate(date: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('es-ES', opts)
}

export function AnaliticasTab({ client, demoMode, demoMarkers }: { client: ClientData; demoMode?: boolean; demoMarkers?: BloodMarkerRow[] }) {
  const [markers, setMarkers] = useState<BloodMarkerRow[]>(demoMarkers || [])
  const [loading, setLoading] = useState(!demoMode)
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(toLocalISODate(new Date()))
  const [draft, setDraft] = useState<DraftEntry[]>([{ markerKey: BLOOD_MARKERS[0].key, value: '' }])
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<MarkerCategory | 'all'>('all')
  const [expandedMarker, setExpandedMarker] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (demoMode) return
    const { data } = await supabase.from('blood_markers').select('*').eq('client_id', client.id).order('date', { ascending: false })
    setMarkers(data || [])
    setLoading(false)
  }, [client.id, demoMode])

  useEffect(() => { load() }, [load])

  const addDraftRow = () => setDraft([...draft, { markerKey: BLOOD_MARKERS[0].key, value: '' }])
  const removeDraftRow = (i: number) => setDraft(draft.filter((_, idx) => idx !== i))
  const updateDraftRow = (i: number, updates: Partial<DraftEntry>) => setDraft(draft.map((d, idx) => idx === i ? { ...d, ...updates } : d))
  const applyTemplate = (markerKeys: string[]) => setDraft(markerKeys.map(k => ({ markerKey: k, value: '' })))

  const handleSave = async () => {
    const valid = draft.filter(d => d.value.trim() && !isNaN(parseFloat(d.value)))
    if (valid.length === 0) { toast('Añade al menos un valor', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setAdding(false); return }
    setSaving(true)
    const { error } = await supabase.from('blood_markers').insert(
      valid.map(d => ({ client_id: client.id, date, marker_key: d.markerKey, value: parseFloat(d.value) }))
    )
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast('Analítica guardada ✓', 'ok')
    setAdding(false); setDraft([{ markerKey: BLOOD_MARKERS[0].key, value: '' }]); setDate(toLocalISODate(new Date()))
    await load()
  }

  const deleteReading = async (id: string) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setMarkers(prev => prev.filter(m => m.id !== id))
    await supabase.from('blood_markers').delete().eq('id', id)
  }

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  // Historial por marcador, más reciente primero — de aquí sale tanto el
  // valor en la fecha seleccionada como el "anterior" (la lectura más
  // reciente de ESE marcador con fecha anterior a la seleccionada) para
  // la comparativa de HoloRangeBar.
  const byMarker = markers.reduce<Record<string, BloodMarkerRow[]>>((acc, m) => {
    (acc[m.marker_key] ||= []).push(m)
    return acc
  }, {})
  Object.values(byMarker).forEach(list => list.sort((a, b) => b.date.localeCompare(a.date)))

  // Fechas de extracción distintas (una "analítica" = todos los
  // marcadores registrados ese día), más reciente primero — permite ver
  // y comparar cualquier extracción pasada, no solo la última.
  const distinctDates = [...new Set(markers.map(m => m.date))].sort((a, b) => b.localeCompare(a))
  const effectiveDate = selectedDate && distinctDates.includes(selectedDate) ? selectedDate : (distinctDates[0] ?? null)
  const compareDate = effectiveDate ? distinctDates.find(d => d < effectiveDate) : undefined

  const sessionKeys = effectiveDate ? BLOOD_MARKERS.filter(def => byMarker[def.key]?.some(r => r.date === effectiveDate)).map(def => def.key) : []
  const valueAt = (key: string, atDate: string) => byMarker[key]?.find(r => r.date === atDate)?.value
  const previousValueFor = (key: string) => effectiveDate
    ? byMarker[key]?.find(r => r.date < effectiveDate)?.value ?? null
    : null

  const tierCounts = sessionKeys.reduce((acc, key) => {
    const v = valueAt(key, effectiveDate!)
    if (v == null) return acc
    acc[markerTier(BLOOD_MARKER_MAP[key], v)]++
    return acc
  }, { optimo: 0, normal: 0, atencion: 0 })
  const pctOptimo = sessionKeys.length > 0 ? Math.round((tierCounts.optimo / sessionKeys.length) * 100) : 0

  const visibleDefs = BLOOD_MARKERS.filter(def => sessionKeys.includes(def.key) && (categoryFilter === 'all' || def.category === categoryFilter))

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif font-bold text-lg flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" /> Biomarcadores &amp; Longevidad
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-accent/10 text-accent">Estilo Holo</span>
          </p>
          <p className="text-xs text-muted mt-0.5">Visualización de precisión mediante barras de rango calibradas (zonas subóptimas, normales y de longevidad óptima) con comparativas históricas directas.</p>
        </div>
        {!adding && <Button size="sm" onClick={() => setAdding(true)} className="flex-shrink-0"><Plus className="w-3.5 h-3.5" /> Nueva analítica</Button>}
      </div>

      {sessionKeys.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-card border border-border rounded-2xl p-3 text-center">
            <p className="text-lg font-serif font-bold">{sessionKeys.length}</p>
            <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">Analizados</p>
          </div>
          <div className="bg-ok/10 border border-ok/20 rounded-2xl p-3 text-center">
            <p className="text-lg font-serif font-bold text-ok flex items-center justify-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {tierCounts.optimo}</p>
            <p className="text-[9px] text-ok/80 uppercase tracking-wider mt-0.5">Rango óptimo</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3 text-center">
            <p className="text-lg font-serif font-bold">{tierCounts.normal}</p>
            <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">Normales</p>
          </div>
          <div className={`rounded-2xl p-3 text-center border ${tierCounts.atencion > 0 ? 'bg-warn/10 border-warn/20' : 'bg-card border-border'}`}>
            <p className={`text-lg font-serif font-bold flex items-center justify-center gap-1 ${tierCounts.atencion > 0 ? 'text-warn' : ''}`}>
              {tierCounts.atencion > 0 && <AlertTriangle className="w-3.5 h-3.5" />} {tierCounts.atencion}
            </p>
            <p className={`text-[9px] uppercase tracking-wider mt-0.5 ${tierCounts.atencion > 0 ? 'text-warn/80' : 'text-muted'}`}>Atención</p>
          </div>
        </div>
      )}

      {sessionKeys.length > 0 && pctOptimo >= 0 && (
        <p className="text-xs text-muted -mt-2">{pctOptimo}% de los analizados en rango óptimo de longevidad.</p>
      )}

      {adding && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Plantilla de registro rápido
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MARKER_TEMPLATES.map(t => (
                <button key={t.name} onClick={() => applyTemplate(t.markerKeys)}
                  className="px-2.5 py-1.5 bg-bg-alt rounded-lg text-xs font-medium text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                  {t.name} <span className="text-[10px] opacity-60">({t.markerKeys.length})</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-2 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          {draft.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <select value={d.markerKey} onChange={e => updateDraftRow(i, { markerKey: e.target.value })}
                className="flex-1 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20">
                {BLOOD_MARKERS.map(m => <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>)}
              </select>
              <input type="number" value={d.value} onChange={e => updateDraftRow(i, { value: e.target.value })} placeholder="Valor"
                className="w-24 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/20" />
              {draft.length > 1 && (
                <button onClick={() => removeDraftRow(i)} className="p-1.5 text-muted hover:text-warn"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
          ))}
          <button onClick={addDraftRow} className="flex items-center gap-1 text-xs text-muted hover:text-accent"><Plus className="w-3 h-3" /> Añadir otro marcador</button>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} loading={saving}>Guardar analítica</Button>
            <Button variant="ghost" onClick={() => { setAdding(false); setDraft([{ markerKey: BLOOD_MARKERS[0].key, value: '' }]) }}>Cancelar</Button>
          </div>
        </div>
      )}

      {distinctDates.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <p className="text-sm text-muted">Todavía no hay analíticas registradas para este cliente.</p>
        </div>
      ) : (
        <>
          {distinctDates.length > 1 && (
            <div className="flex items-center justify-between gap-3 flex-wrap bg-card border border-border rounded-2xl px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Calendar className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                <span className="text-xs text-muted mr-1">Analítica:</span>
                {distinctDates.map((d, i) => (
                  <button key={d} onClick={() => setSelectedDate(d)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                      d === effectiveDate ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
                    }`}>
                    {fmtDate(d)}{i === 0 ? ' (Reciente)' : ''}
                  </button>
                ))}
              </div>
              {compareDate && (
                <span className="flex items-center gap-1 text-xs text-muted flex-shrink-0">
                  <Clock className="w-3.5 h-3.5" /> Comparando vs: {fmtDate(compareDate, { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${categoryFilter === 'all' ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>
              Todos <span className="opacity-60">{sessionKeys.length}</span>
            </button>
            {CATEGORY_ORDER.filter(cat => sessionKeys.some(k => BLOOD_MARKER_MAP[k].category === cat)).map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${categoryFilter === cat ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'}`}>
                {MARKER_CATEGORY_LABELS[cat]} <span className="opacity-60">{sessionKeys.filter(k => BLOOD_MARKER_MAP[k].category === cat).length}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {visibleDefs.map(def => {
              const readings = byMarker[def.key]
              const value = valueAt(def.key, effectiveDate!)
              if (value == null) return null
              const previousValue = previousValueFor(def.key)
              const advice = adviceForMarker(def, value)
              const expanded = expandedMarker === def.key
              return (
                <div key={def.key} className="space-y-1.5">
                  <HoloRangeBar name={`${def.label} · ${fmtDate(effectiveDate!, { day: 'numeric', month: 'short' })}`}
                    unit={def.unit} value={value} previousValue={previousValue}
                    minNormal={def.min} maxNormal={def.max} minScale={def.scaleMin} maxScale={def.scaleMax}
                    description={def.description} dietaryNote={advice || undefined} />
                  <button onClick={() => setExpandedMarker(expanded ? null : def.key)}
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-accent ml-1">
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded ? 'Ocultar historial' : `Historial (${readings.length})`}
                  </button>
                  {expanded && (
                    <div className="bg-card border border-border rounded-xl p-3 divide-y divide-border">
                      {readings.map(r => (
                        <div key={r.id} className="py-1.5 flex items-center justify-between gap-2 text-xs first:pt-0 last:pb-0">
                          <span className="text-muted">{fmtDate(r.date)}</span>
                          <span className="tabular-nums">{r.value} {def.unit}</span>
                          <button onClick={() => deleteReading(r.id)} className="text-muted hover:text-warn"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
