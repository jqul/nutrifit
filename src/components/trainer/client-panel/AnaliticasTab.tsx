import { useState, useEffect, useCallback } from 'react'
import { ClientData } from '../../../types'
import { BloodMarkerRow } from '../../../lib/supabase-types'
import { supabase } from '../../../lib/supabase'
import { BLOOD_MARKERS, BLOOD_MARKER_MAP, evaluateMarker, adviceForMarker, MarkerStatus } from '../../../lib/bloodMarkers'
import { toLocalISODate } from '../../../lib/date'
import { toast } from '../../shared/Toast'
import { Button } from '../../shared/Button'
import { Activity, Plus, Trash2, AlertTriangle } from 'lucide-react'

const STATUS_CLASS: Record<MarkerStatus, string> = {
  bajo: 'text-warn font-semibold', alto: 'text-warn font-semibold', normal: 'text-ok',
}

interface DraftEntry { markerKey: string; value: string }

export function AnaliticasTab({ client, demoMode, demoMarkers }: { client: ClientData; demoMode?: boolean; demoMarkers?: BloodMarkerRow[] }) {
  const [markers, setMarkers] = useState<BloodMarkerRow[]>(demoMarkers || [])
  const [loading, setLoading] = useState(!demoMode)
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState(toLocalISODate(new Date()))
  const [draft, setDraft] = useState<DraftEntry[]>([{ markerKey: BLOOD_MARKERS[0].key, value: '' }])
  const [saving, setSaving] = useState(false)

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

  const byDate = markers.reduce<Record<string, BloodMarkerRow[]>>((acc, m) => {
    (acc[m.date] ||= []).push(m)
    return acc
  }, {})
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm flex items-center gap-1.5"><Activity className="w-4 h-4" /> Analíticas de sangre</p>
          <p className="text-xs text-muted mt-0.5">Entrada manual de los valores del laboratorio — sin lectura automática de PDF/imagen. Rangos orientativos, no sustituyen el diagnóstico médico.</p>
        </div>
        {!adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" /> Nueva analítica</Button>}
      </div>

      {adding && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
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

      {dates.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <p className="text-sm text-muted">Todavía no hay analíticas registradas para este cliente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dates.map(d => (
            <div key={d} className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                {new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <div className="space-y-2">
                {byDate[d].map(m => {
                  const def = BLOOD_MARKER_MAP[m.marker_key]
                  if (!def) return null
                  const status = evaluateMarker(def, m.value)
                  const advice = adviceForMarker(def, m.value)
                  return (
                    <div key={m.id} className="border-b border-border last:border-0 pb-2 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm">{def.label}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-sm ${STATUS_CLASS[status]}`}>{m.value} {def.unit}</span>
                          {status !== 'normal' && <AlertTriangle className="w-3.5 h-3.5 text-warn" />}
                          <button onClick={() => deleteReading(m.id)} className="text-muted hover:text-warn"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                      {advice && <p className="text-xs text-warn mt-1">{advice}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
