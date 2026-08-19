import { useState, useEffect, useCallback } from 'react'
import { ClientData } from '../../../types'
import { supabase } from '../../../lib/supabase'
import { weightFromRow, checkinFromRow, photoSessionFromRow, mealLogFromRow } from '../../../lib/mappers'
import { WeightEntry, DailyCheckin, ProgressPhotoSession, MealLog } from '../../../types'
import { calcAdherence, calcStreak } from '../../../lib/adherence'
import { WeightChart } from '../../shared/WeightChart'
import { FOLLOWED_PLAN_LABELS } from '../../../lib/constants'
import { SurveyHistory } from './SurveyHistory'
import { DEMO_CUSTOM_SURVEYS, DEMO_SURVEY_RESPONSES } from '../../../lib/demo-data'
import { Flame, Camera, UtensilsCrossed, AlertTriangle } from 'lucide-react'

const INTENSITY_LABELS = ['Ninguna', 'Leve', 'Moderada', 'Intensa']
function isConcerningCheckin(c: DailyCheckin): boolean {
  return (c.bristolScale != null && (c.bristolScale <= 2 || c.bristolScale >= 6))
    || (c.bloating != null && c.bloating >= 2) || (c.abdominalPain != null && c.abdominalPain >= 2)
}

interface DemoData { weights: WeightEntry[]; checkins: DailyCheckin[]; photos: ProgressPhotoSession[]; mealLogs: MealLog[] }

export function SeguimientoTab({ client, demoData }: { client: ClientData; demoData?: DemoData }) {
  const [weights, setWeights] = useState<WeightEntry[]>(demoData?.weights ?? [])
  const [checkins, setCheckins] = useState<DailyCheckin[]>(demoData?.checkins ?? [])
  const [sessions, setSessions] = useState<ProgressPhotoSession[]>(demoData?.photos ?? [])
  const [mealLogs, setMealLogs] = useState<MealLog[]>(demoData?.mealLogs ?? [])
  const [loading, setLoading] = useState(!demoData)

  const load = useCallback(async () => {
    if (demoData) return
    setLoading(true)
    const [{ data: w }, { data: c }, { data: p }, { data: m }] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('client_id', client.id).order('date'),
      supabase.from('daily_checkins').select('*').eq('client_id', client.id).order('date', { ascending: false }),
      supabase.from('progress_photos').select('*').eq('client_id', client.id).order('date', { ascending: false }),
      supabase.from('meal_logs').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
    ])
    setWeights((w || []).map(weightFromRow))
    setCheckins((c || []).map(checkinFromRow))
    setSessions((p || []).map(photoSessionFromRow))
    setMealLogs((m || []).map(mealLogFromRow))
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
        <WeightChart entries={weights} goalKg={client.goalWeightKg} />
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
        <p className="font-semibold text-sm mb-3 flex items-center gap-1.5"><UtensilsCrossed className="w-4 h-4" /> Diario de comidas</p>
        {mealLogs.length === 0 ? (
          <p className="text-sm text-muted">El cliente todavía no ha registrado comidas.</p>
        ) : (
          <div className="space-y-2">
            {mealLogs.slice(0, 10).map(m => (
              <div key={m.id} className="flex items-center gap-3 border border-border rounded-xl p-2.5">
                {m.photoUrl ? (
                  <img src={m.photoUrl} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt={m.mealName} />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-bg-alt flex items-center justify-center flex-shrink-0">
                    <UtensilsCrossed className="w-4 h-4 text-muted" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{m.mealName}</p>
                  <p className="text-xs text-muted">{new Date(m.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}{m.note ? ` · ${m.note}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SurveyHistory client={client} demoMode={!!demoData}
        demoSurveys={demoData ? DEMO_CUSTOM_SURVEYS : undefined}
        demoResponses={demoData ? (DEMO_SURVEY_RESPONSES[client.id] || []) : undefined} />

      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="font-semibold text-sm mb-3">Check-ins recientes</p>
        {checkins.length === 0 ? (
          <p className="text-sm text-muted">Sin check-ins todavía.</p>
        ) : (
          <div className="divide-y divide-border">
            {recentCheckins.slice(0, 14).map(c => (
              <div key={c.id} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">{new Date(c.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                  <span className="font-medium">{FOLLOWED_PLAN_LABELS[c.followedPlan]}</span>
                  <span className="text-xs text-muted">🍽 {c.hunger} · ⚡ {c.energy} · 🙂 {c.mood}</span>
                </div>
                {(c.bristolScale != null || c.bloating != null || c.abdominalPain != null) && (
                  <div className={`flex items-center gap-1.5 flex-wrap text-[11px] ${isConcerningCheckin(c) ? 'text-warn' : 'text-muted'}`}>
                    {isConcerningCheckin(c) && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                    {c.bristolScale != null && <span>Bristol {c.bristolScale}</span>}
                    {c.bloating != null && <span>Hinchazón: {INTENSITY_LABELS[c.bloating]}</span>}
                    {c.abdominalPain != null && <span>Dolor abdominal: {INTENSITY_LABELS[c.abdominalPain]}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
