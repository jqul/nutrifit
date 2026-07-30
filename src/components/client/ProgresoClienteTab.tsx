import { useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { logError } from '../../lib/errors'
import { weightFromRow, checkinFromRow, photoSessionFromRow } from '../../lib/mappers'
import { WeightEntry, DailyCheckin, ProgressPhotoSession } from '../../types'
import { calcAdherence, calcStreak } from '../../lib/adherence'
import { WeightChart } from '../shared/WeightChart'
import { Camera, Flame } from 'lucide-react'
import { toast } from '../shared/Toast'

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ProgresoClienteTab({ clientId }: { clientId: string }) {
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [checkins, setCheckins] = useState<DailyCheckin[]>([])
  const [sessions, setSessions] = useState<ProgressPhotoSession[]>([])
  const [newWeight, setNewWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: w }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('client_id', clientId).order('date'),
      supabase.from('daily_checkins').select('*').eq('client_id', clientId),
      supabase.from('progress_photos').select('*').eq('client_id', clientId).order('date', { ascending: false }),
    ])
    setWeights((w || []).map(weightFromRow))
    setCheckins((c || []).map(checkinFromRow))
    setSessions((p || []).map(photoSessionFromRow))
  }, [clientId])

  useEffect(() => { load() }, [load])

  const handleAddWeight = async () => {
    const kg = parseFloat(newWeight)
    if (!kg || kg <= 0) { toast('Introduce un peso válido', 'warn'); return }
    setSaving(true)
    const { error } = await supabase.from('weight_logs').upsert({
      client_id: clientId, date: toLocalISODate(new Date()), weight_kg: kg, note: '',
    }, { onConflict: 'client_id,date' })
    setSaving(false)
    if (error) { logError('ProgresoClienteTab:weight', error); toast('Error al guardar el peso', 'warn'); return }
    setNewWeight('')
    await load()
  }

  const handleNewSession = async () => {
    const { error } = await supabase.from('progress_photos').insert({
      client_id: clientId, date: toLocalISODate(new Date()), note: '',
    })
    if (error) { toast('Error al crear la sesión de fotos', 'warn'); return }
    await load()
  }

  const handleUpload = async (sessionId: string, angle: 'front' | 'side' | 'back', file: File) => {
    setUploading(`${sessionId}-${angle}`)
    const ext = file.name.split('.').pop()
    const path = `${clientId}/${sessionId}/${angle}_${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
    if (upErr) { toast('Error al subir la foto', 'warn'); setUploading(null); return }
    const { data: pub } = supabase.storage.from('photos').getPublicUrl(path)
    const column = angle === 'front' ? 'front_url' : angle === 'side' ? 'side_url' : 'back_url'
    await supabase.from('progress_photos').update({ [column]: pub.publicUrl }).eq('id', sessionId)
    setUploading(null)
    await load()
  }

  const today = new Date()
  const adherence7d = calcAdherence(checkins, 7, today)
  const adherence30d = calcAdherence(checkins, 30, today)
  const streak = calcStreak(checkins, today)

  return (
    <div className="px-4 py-6 space-y-5 max-w-xl mx-auto pb-24">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Racha" value={`${streak}d`} icon={<Flame className="w-4 h-4 text-accent" />} />
        <StatCard label="Adherencia 7d" value={`${adherence7d}%`} />
        <StatCard label="Adherencia 30d" value={`${adherence30d}%`} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <p className="font-semibold text-sm">Peso corporal</p>
        <div className="flex gap-2">
          <input type="number" step="0.1" value={newWeight} onChange={e => setNewWeight(e.target.value)}
            placeholder="Peso de hoy (kg)"
            className="flex-1 px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
          <button onClick={handleAddWeight} disabled={saving}
            className="px-4 py-2.5 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50">
            Guardar
          </button>
        </div>
        <WeightChart entries={weights} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Fotos de progreso</p>
          <button onClick={handleNewSession} className="flex items-center gap-1 text-xs font-bold text-accent">
            <Camera className="w-3.5 h-3.5" /> Nueva sesión
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">Todavía no has subido fotos de progreso.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className="border border-border rounded-xl p-3">
                <p className="text-xs text-muted mb-2">{new Date(s.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['front', 'side', 'back'] as const).map(angle => {
                    const url = angle === 'front' ? s.frontUrl : angle === 'side' ? s.sideUrl : s.backUrl
                    const key = `${s.id}-${angle}`
                    return (
                      <label key={angle} className="aspect-square bg-bg-alt rounded-lg overflow-hidden flex items-center justify-center cursor-pointer relative">
                        {url ? <img src={url} className="w-full h-full object-cover" alt={angle} /> : (
                          <span className="text-[10px] text-muted uppercase">{uploading === key ? '...' : angle}</span>
                        )}
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(s.id, angle, f) }} />
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <p className="text-lg font-serif font-bold">{value}</p>
      </div>
      <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  )
}
