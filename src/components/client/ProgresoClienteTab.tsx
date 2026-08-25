import { useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { logError } from '../../lib/errors'
import { weightFromRow, checkinFromRow, photoSessionFromRow, mealLogFromRow } from '../../lib/mappers'
import { WeightEntry, DailyCheckin, ProgressPhotoSession, MealLog, ClientData } from '../../types'
import { BloodMarkerRow } from '../../lib/supabase-types'
import { calcAdherence, calcStreak } from '../../lib/adherence'
import { computeWeightProgress } from '../../lib/weightProgress'
import { toLocalISODate } from '../../lib/date'
import { WeightChart } from '../shared/WeightChart'
import { printProgressReport } from '../../lib/printProgressReport'
import { Camera, Flame, UtensilsCrossed, Plus, Images, FileDown } from 'lucide-react'
import { toast } from '../shared/Toast'

const HYDRATION_GOAL_L = 2.0

interface DemoData { weights: WeightEntry[]; checkins: DailyCheckin[]; photos: ProgressPhotoSession[]; mealLogs: MealLog[]; bloodMarkers?: BloodMarkerRow[] }

export function ProgresoClienteTab({ client, demoMode, demoData, nutricionistaLogoUrl, nutricionistaAccentColor }: {
  client: ClientData; demoMode?: boolean; demoData?: DemoData
  nutricionistaLogoUrl?: string | null; nutricionistaAccentColor?: string | null
}) {
  const clientId = client.id
  const [weights, setWeights] = useState<WeightEntry[]>(demoData?.weights ?? [])
  const [checkins, setCheckins] = useState<DailyCheckin[]>(demoData?.checkins ?? [])
  const [sessions, setSessions] = useState<ProgressPhotoSession[]>(demoData?.photos ?? [])
  const [mealLogs, setMealLogs] = useState<MealLog[]>(demoData?.mealLogs ?? [])
  // El cliente puede leer sus propias analíticas por RLS (client_reads_own_blood_markers,
  // 0017_blood_markers.sql) aunque no tenga una pestaña dedicada para verlas — solo
  // hacen falta aquí para incluirlas en el informe clínico descargable.
  const [bloodMarkers, setBloodMarkers] = useState<BloodMarkerRow[]>(demoData?.bloodMarkers ?? [])
  const [newWeight, setNewWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [addingMeal, setAddingMeal] = useState(false)
  const [mealName, setMealName] = useState('')
  const [mealNote, setMealNote] = useState('')
  const [mealFile, setMealFile] = useState<File | null>(null)
  const [savingMeal, setSavingMeal] = useState(false)

  const load = useCallback(async () => {
    if (demoMode) return
    const [{ data: w }, { data: c }, { data: p }, { data: m }, { data: bm }] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('client_id', clientId).order('date'),
      supabase.from('daily_checkins').select('*').eq('client_id', clientId),
      supabase.from('progress_photos').select('*').eq('client_id', clientId).order('date', { ascending: false }),
      supabase.from('meal_logs').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('blood_markers').select('*').eq('client_id', clientId).order('date', { ascending: false }),
    ])
    setWeights((w || []).map(weightFromRow))
    setCheckins((c || []).map(checkinFromRow))
    setSessions((p || []).map(photoSessionFromRow))
    setMealLogs((m || []).map(mealLogFromRow))
    setBloodMarkers(bm || [])
  }, [clientId, demoMode])

  useEffect(() => { load() }, [load])

  const handleAddWeight = async () => {
    const kg = parseFloat(newWeight)
    if (!kg || kg <= 0) { toast('Introduce un peso válido', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setNewWeight(''); return }
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
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    const { error } = await supabase.from('progress_photos').insert({
      client_id: clientId, date: toLocalISODate(new Date()), note: '',
    })
    if (error) { toast('Error al crear la sesión de fotos', 'warn'); return }
    await load()
  }

  const handleUpload = async (sessionId: string, angle: 'front' | 'side' | 'back', file: File) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
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

  const handleAddMealLog = async () => {
    if (!mealName.trim()) { toast('Ponle un nombre a la comida', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setAddingMeal(false); setMealName(''); setMealNote(''); setMealFile(null); return }
    setSavingMeal(true)
    let photoUrl: string | null = null
    if (mealFile) {
      const ext = mealFile.name.split('.').pop()
      const path = `${clientId}/meals/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('photos').upload(path, mealFile, { upsert: true })
      if (upErr) { toast('Error al subir la foto', 'warn'); setSavingMeal(false); return }
      photoUrl = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
    }
    const { error } = await supabase.from('meal_logs').insert({
      client_id: clientId, date: toLocalISODate(new Date()), meal_name: mealName.trim(), note: mealNote.trim(), photo_url: photoUrl,
    })
    setSavingMeal(false)
    if (error) { toast('Error al guardar la comida', 'warn'); return }
    toast('Comida añadida al diario ✓', 'ok')
    setAddingMeal(false); setMealName(''); setMealNote(''); setMealFile(null)
    await load()
  }

  const today = new Date()
  const adherence7d = calcAdherence(checkins, 7, today)
  const adherence30d = calcAdherence(checkins, 30, today)
  const streak = calcStreak(checkins, today)

  return (
    <div className="px-4 py-6 space-y-5 max-w-xl mx-auto pb-24">
      <div className="flex justify-end">
        <button onClick={() => printProgressReport(client, { weights, checkins, bloodMarkers },
          { logoUrl: nutricionistaLogoUrl, accentColor: nutricionistaAccentColor })}
          className="flex items-center gap-1.5 text-xs font-bold text-accent">
          <FileDown className="w-3.5 h-3.5" /> Informe clínico (PDF)
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Racha" value={`${streak}d`} icon={<Flame className="w-4 h-4 text-accent" />} />
        <StatCard label="Adherencia 7d" value={`${adherence7d}%`} />
        <StatCard label="Adherencia 30d" value={`${adherence30d}%`} />
      </div>

      <AchievementBadges weights={weights} streak={streak} checkins={checkins} mealLogs={mealLogs} />

      <WeightImpactCard weights={weights} goalKg={client.goalWeightKg} />

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
        <WeightChart entries={weights} goalKg={client.goalWeightKg} />
      </div>

      <PhotoComparator sessions={sessions} />

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

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm flex items-center gap-1.5"><UtensilsCrossed className="w-4 h-4" /> Diario de comidas</p>
          <button onClick={() => setAddingMeal(v => !v)} className="flex items-center gap-1 text-xs font-bold text-accent">
            <Plus className="w-3.5 h-3.5" /> Añadir
          </button>
        </div>

        {addingMeal && (
          <div className="border border-dashed border-border rounded-xl p-3 space-y-2">
            <input value={mealName} onChange={e => setMealName(e.target.value)} placeholder="Ej. Desayuno, tentempié..."
              className="w-full px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none" />
            <textarea value={mealNote} onChange={e => setMealNote(e.target.value)} rows={2} placeholder="Nota (opcional)"
              className="w-full px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none resize-none" />
            <input type="file" accept="image/*" onChange={e => setMealFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-muted" />
            <div className="flex gap-2">
              <button onClick={() => { setAddingMeal(false); setMealName(''); setMealNote(''); setMealFile(null) }}
                className="flex-1 py-1.5 border border-border rounded-lg text-xs text-muted">Cancelar</button>
              <button onClick={handleAddMealLog} disabled={savingMeal}
                className="flex-1 py-1.5 bg-ink text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                {savingMeal ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {mealLogs.length === 0 ? (
          <p className="text-sm text-muted">Todavía no has registrado ninguna comida.</p>
        ) : (
          <div className="space-y-2">
            {mealLogs.map(m => (
              <div key={m.id} className="flex items-center gap-3 border border-border rounded-xl p-2.5">
                {m.photoUrl ? (
                  <img src={m.photoUrl} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt={m.mealName} />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-bg-alt flex items-center justify-center flex-shrink-0">
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
    </div>
  )
}

/** Muro de logros — badges desbloqueables calculados al vuelo a partir de
 * datos que ya existen (peso, racha, hidratación, fotos de comida), sin
 * tabla nueva: son hitos, no algo que haya que auditar ni deshacer. */
function AchievementBadges({ weights, streak, checkins, mealLogs }: {
  weights: WeightEntry[]; streak: number; checkins: DailyCheckin[]; mealLogs: MealLog[]
}) {
  const hydratedDays = checkins.filter(c => (c.waterL || 0) >= HYDRATION_GOAL_L).length
  const mealPhotoCount = mealLogs.filter(m => m.photoUrl).length
  const badges = [
    { icon: '🎯', label: 'Primer pesaje', unlocked: weights.length >= 1 },
    { icon: '🔥', label: '7 días de racha', unlocked: streak >= 7 },
    { icon: '💧', label: 'Rey/reina del agua', unlocked: hydratedDays >= 5 },
    { icon: '🥗', label: '10 fotos de comida', unlocked: mealPhotoCount >= 10 },
  ]
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="font-semibold text-sm mb-3">Tus logros</p>
      <div className="grid grid-cols-4 gap-2">
        {badges.map(b => (
          <div key={b.label} title={b.unlocked ? '¡Desbloqueado!' : 'Todavía bloqueado'}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
              b.unlocked ? 'border-accent/30 bg-accent/5' : 'border-border opacity-40 grayscale'
            }`}>
            <span className="text-2xl">{b.icon}</span>
            <p className="text-[9px] text-center text-muted leading-tight">{b.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Tarjeta de impacto: mismo dato que las fichas de WeightChart, pero en un
 * formato "hero" con barra de progreso hacia la meta — para dar una lectura
 * de un vistazo y con más gratificación visual que la gráfica en sí. */
function WeightImpactCard({ weights, goalKg }: { weights: WeightEntry[]; goalKg: number | null }) {
  if (weights.length === 0) return null
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const initial = sorted[0].weightKg
  const current = sorted[sorted.length - 1].weightKg
  const { changeKg, remainingKg, progressPct, goalReached } = computeWeightProgress(initial, current, goalKg)

  return (
    <div className="bg-gradient-to-br from-accent to-accent2 rounded-2xl p-5 text-white space-y-3 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-white/80">Tu progreso de peso</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-lg font-serif font-bold">{initial}kg</p>
          <p className="text-[9px] text-white/80 uppercase tracking-wider">Inicial</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-serif font-bold">{current}kg</p>
          <p className="text-[9px] text-white/80 uppercase tracking-wider">Actual</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-serif font-bold">{changeKg <= 0 ? '−' : '+'}{Math.abs(changeKg).toFixed(1)}kg</p>
          <p className="text-[9px] text-white/80 uppercase tracking-wider">Cambio</p>
        </div>
      </div>
      {goalKg != null && progressPct != null && (
        <div>
          <div className="flex items-center justify-between text-xs text-white/90 mb-1">
            <span>{goalReached ? '¡Objetivo alcanzado! 🎉' : `Estás a solo ${remainingKg!.toFixed(1)}kg de tu objetivo`}</span>
            <span className="font-bold">{Math.round(progressPct)}%</span>
          </div>
          <div className="h-2 bg-white/25 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Comparador antes/después: la primera sesión con fotos frente a la más
 * reciente, con selector de ángulo — solo aparece con 2+ sesiones (si no,
 * no hay "antes" con el que comparar). */
function PhotoComparator({ sessions }: { sessions: ProgressPhotoSession[] }) {
  const [angle, setAngle] = useState<'front' | 'side' | 'back'>('front')
  if (sessions.length < 2) return null
  // Vienen ordenadas de más reciente a más antigua (ver load()).
  const after = sessions[0]
  const before = sessions[sessions.length - 1]
  const urlFor = (s: ProgressPhotoSession) => angle === 'front' ? s.frontUrl : angle === 'side' ? s.sideUrl : s.backUrl
  const ANGLE_LABELS = { front: 'Frontal', side: 'Perfil', back: 'Espalda' } as const

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <p className="font-semibold text-sm flex items-center gap-1.5"><Images className="w-4 h-4" /> Antes vs. después</p>
      <div className="flex gap-1.5">
        {(['front', 'side', 'back'] as const).map(a => (
          <button key={a} onClick={() => setAngle(a)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              angle === a ? 'bg-ink text-white' : 'bg-bg-alt text-muted hover:text-ink'
            }`}>
            {ANGLE_LABELS[a]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[{ session: before, tag: 'Antes' }, { session: after, tag: 'Después' }].map(({ session, tag }) => {
          const url = urlFor(session)
          return (
            <div key={tag}>
              <div className="aspect-square bg-bg-alt rounded-xl overflow-hidden flex items-center justify-center">
                {url ? <img src={url} className="w-full h-full object-cover" alt={`${tag} — ${ANGLE_LABELS[angle]}`} /> : (
                  <span className="text-xs text-muted">Sin foto</span>
                )}
              </div>
              <p className="text-[10px] text-muted text-center mt-1 font-semibold">
                {tag} · {new Date(session.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          )
        })}
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
