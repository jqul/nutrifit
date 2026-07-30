import { useState, useEffect, useCallback } from 'react'
import { ClientData } from '../../../types'
import { supabase } from '../../../lib/supabase'
import { weightFromRow, checkinFromRow, photoSessionFromRow } from '../../../lib/mappers'
import { WeightEntry, DailyCheckin, ProgressPhotoSession } from '../../../types'
import { calcAdherence, calcStreak } from '../../../lib/adherence'
import { WeightChart } from '../../shared/WeightChart'
import { FOLLOWED_PLAN_LABELS } from '../../../lib/constants'
import { Flame, Camera } from 'lucide-react'

interface DemoData { weights: WeightEntry[]; checkins: DailyCheckin[]; photos: ProgressPhotoSession[] }

export function SeguimientoTab({ client, demoData }: { client: ClientData; demoData?: DemoData }) {
  const [weights, setWeights] = useState<WeightEntry[]>(demoData?.weights ?? [])
  const [checkins, setCheckins] = useState<DailyCheckin[]>(demoData?.checkins ?? [])
  const [sessions, setSessions] = useState<ProgressPhotoSession[]>(demoData?.photos ?? [])
  const [loading, setLoading] = useState(!demoData)

  const load = useCallback(async () => {
    if (demoData) return
    setLoading(true)
    const [{ data: w }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('client_id', client.id).order('date'),
      supabase.from('daily_checkins').select('*').eq('client_id', client.id).order('date', { ascending: false }),
      supabase.from('progress_photos').select('*').eq('client_id', client.id).order('date', { ascending: false }),
    ])
    setWeights((w || []).map(weightFromRow))
    setCheckins((c || []).map(checkinFromRow))
    setSessions((p || []).map(photoSessionFromRow))
    setLoading(false)
  }, [client.id, demoData])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  const today = new Date()
  const adherence7d = calcAdherence(checkins, 7, today)
  const adherence30d = calcAdherence(checkins, 30, today)
  const streak = calcStreak(checkins, today)
  const recentCheckins = [...checkins].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-1"><Flame className="w-4 h-4 text-accent" /><p className="text-xl font-serif font-bold">{streak}d</p></div>
          <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Racha</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-xl font-serif font-bold">{adherence7d}%</p>
          <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Adherencia 7d</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-xl font-serif font-bold">{adherence30d}%</p>
          <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Adherencia 30d</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="font-semibold text-sm mb-3">Peso corporal</p>
        <WeightChart entries={weights} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="font-semibold text-sm mb-3 flex items-center gap-1.5"><Camera className="w-4 h-4" /> Fotos de progreso</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">El cliente todavía no ha subido fotos.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className="border border-border rounded-xl p-3">
                <p className="text-xs text-muted mb-2">{new Date(s.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[s.frontUrl, s.sideUrl, s.backUrl].map((url, i) => (
                    <div key={i} className="aspect-square bg-bg-alt rounded-lg overflow-hidden flex items-center justify-center">
                      {url ? <img src={url} className="w-full h-full object-cover" alt="" /> : <span className="text-[10px] text-muted">—</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="font-semibold text-sm mb-3">Check-ins recientes</p>
        {checkins.length === 0 ? (
          <p className="text-sm text-muted">Sin check-ins todavía.</p>
        ) : (
          <div className="divide-y divide-border">
            {recentCheckins.slice(0, 14).map(c => (
              <div key={c.id} className="py-2.5 flex items-center justify-between text-sm">
                <span className="text-muted">{new Date(c.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                <span className="font-medium">{FOLLOWED_PLAN_LABELS[c.followedPlan]}</span>
                <span className="text-xs text-muted">🍽 {c.hunger} · ⚡ {c.energy} · 🙂 {c.mood}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
