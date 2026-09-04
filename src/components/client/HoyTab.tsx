import { useState, useEffect, useCallback } from 'react'
import { ClientData, FollowedPlan, Appointment, DietPlan, MealLog, DietMeal } from '../../types'
import { supabase } from '../../lib/supabase'
import { logError } from '../../lib/errors'
import { FOLLOWED_PLAN_LABELS } from '../../lib/constants'
import { toLocalISODate, todayDayOfWeek } from '../../lib/date'
import { appointmentFromRow, checkinFromRow, mealLogFromRow, dietPlanFromRows } from '../../lib/mappers'
import { calcStreak } from '../../lib/adherence'
import { resolveTodaysMeals, loadOptionChoices, loadDayType } from '../../lib/planMeals'
import { sendPush } from '../../lib/usePushNotifications'
import { PendingSurveys } from './PendingSurveys'
import { DEMO_APPOINTMENTS, DEMO_DIET_PLANS, DEMO_MEAL_LOGS, DEMO_CHECKINS } from '../../lib/demo-data'
import { toast } from '../shared/Toast'
import { CheckCircle2, CheckSquare, Square, Calendar, Plus, Video, Flame, Droplet, Camera, UtensilsCrossed, Pill } from 'lucide-react'

const SCALE = [1, 2, 3, 4, 5]
const WATER_GOAL_L = 2.0

// Selector simplificado de digestión: en vez de pedir 3 campos sueltos
// (escala de Bristol + hinchazón + dolor abdominal) al cliente, un único
// toque elige uno de 3 estados con valores preestablecidos para esos
// mismos campos — el nutricionista sigue viendo la misma señal en
// SeguimientoTab (isConcerningCheckin lee bristol/bloating/abdominalPain
// tal cual), solo que el cliente ya no rellena cada campo por separado.
type DigestionOption = 'ligera' | 'normal' | 'hinchazon'
const DIGESTION_PRESETS: Record<DigestionOption, { bristolScale: number; bloating: number; abdominalPain: number; label: string }> = {
  ligera: { bristolScale: 4, bloating: 0, abdominalPain: 0, label: 'Ligera & Buena' },
  normal: { bristolScale: 4, bloating: 1, abdominalPain: 0, label: 'Normal' },
  hinchazon: { bristolScale: 4, bloating: 2, abdominalPain: 1, label: 'Hinchazón / Pesada' },
}
function digestionFromFields(bloating: number | null, abdominalPain: number | null): DigestionOption | null {
  if (bloating == null && abdominalPain == null) return null
  if ((bloating ?? 0) >= 2 || (abdominalPain ?? 0) >= 1) return 'hinchazon'
  if ((bloating ?? 0) === 1) return 'normal'
  return 'ligera'
}

function greeting(): { text: string; icon: string } {
  const h = new Date().getHours()
  if (h < 6) return { text: 'Buenas noches', icon: '🌙' }
  if (h < 13) return { text: 'Buenos días', icon: '☀️' }
  if (h < 20) return { text: 'Buenas tardes', icon: '🌤️' }
  return { text: 'Buenas noches', icon: '🌙' }
}

function newId(): string {
  return crypto.randomUUID()
}

export function HoyTab({ client, demoMode, personalMode }: {
  client: ClientData; demoMode?: boolean
  // true en modo personal (ver PersonalModeShell) — oculta "Próximas
  // citas / Pedir cita", que no tiene sentido cuando no hay un
  // profesional distinto al que pedirle una.
  personalMode?: boolean
}) {
  const today = toLocalISODate(new Date())
  // loadCheckins() corta de inmediato en modo demo (no hay Supabase que
  // consultar), así que si el check-in de hoy ya viene en los datos de demo
  // (como el de María) hay que precargarlo aquí mismo — si no, la pantalla
  // arrancaría siempre como si hoy no se hubiera hecho nada, y la racha se
  // quedaría en 0 para siempre.
  const demoTodayCheckin = demoMode ? (DEMO_CHECKINS[client.id] || []).find(c => c.date === today) : undefined
  const [loading, setLoading] = useState(!demoMode)
  const [doneToday, setDoneToday] = useState(!!demoTodayCheckin)
  const [followedPlan, setFollowedPlan] = useState<FollowedPlan>(demoTodayCheckin?.followedPlan ?? 'si')
  const [hunger, setHunger] = useState(demoTodayCheckin?.hunger ?? 3)
  const [energy, setEnergy] = useState(demoTodayCheckin?.energy ?? 3)
  const [mood, setMood] = useState(demoTodayCheckin?.mood ?? 3)
  const [waterL, setWaterL] = useState(demoTodayCheckin?.waterL ?? 0)
  const [notes, setNotes] = useState(demoTodayCheckin?.notes ?? '')
  const [bristolScale, setBristolScale] = useState<number | null>(demoTodayCheckin?.bristolScale ?? null)
  const [bloating, setBloating] = useState<number | null>(demoTodayCheckin?.bloating ?? null)
  const [abdominalPain, setAbdominalPain] = useState<number | null>(demoTodayCheckin?.abdominalPain ?? null)
  const [saving, setSaving] = useState(false)
  // Igual que doneToday: loadCheckins() nunca calcula la racha real en modo
  // demo, así que se calcula aquí a partir de los check-ins de demo.
  const [streak, setStreak] = useState(() => demoMode ? calcStreak(DEMO_CHECKINS[client.id] || []) : 0)

  // Plan de hoy — mismas tres capas de flexibilidad que Dieta (cuadrante
  // semanal, carb cycling, opciones intercambiables), leídas de las mismas
  // claves de localStorage para que las dos pantallas nunca se desincronicen
  // aunque estén las dos montadas a la vez (ver ClientView).
  const [plan, setPlan] = useState<DietPlan | null>(demoMode ? (DEMO_DIET_PLANS[client.id] ?? null) : null)
  const [mealLogsToday, setMealLogsToday] = useState<MealLog[]>(
    demoMode ? (DEMO_MEAL_LOGS[client.id] || []).filter(m => m.date === today) : []
  )
  const [uploadingMeal, setUploadingMeal] = useState<string | null>(null)
  // "Tomado hoy" es solo de esta sesión (como el checklist de la lista de
  // la compra) — no hay tabla de "toma de suplementos" en la base de
  // datos; el objetivo es el recordatorio visual del momento, no auditar
  // el cumplimiento.
  const [supplementsTaken, setSupplementsTaken] = useState<Set<string>>(new Set())

  const loadCheckins = useCallback(async () => {
    if (demoMode) return
    const [{ data: todayRow }, { data: history }] = await Promise.all([
      supabase.from('daily_checkins').select('*').eq('client_id', client.id).eq('date', today).maybeSingle(),
      supabase.from('daily_checkins').select('*').eq('client_id', client.id),
    ])
    if (todayRow) {
      setDoneToday(true)
      setFollowedPlan(todayRow.followed_plan)
      setHunger(todayRow.hunger)
      setEnergy(todayRow.energy)
      setMood(todayRow.mood)
      setWaterL(todayRow.water_l ?? 0)
      setNotes(todayRow.notes || '')
      setBristolScale(todayRow.bristol_scale)
      setBloating(todayRow.bloating)
      setAbdominalPain(todayRow.abdominal_pain)
    }
    setStreak(calcStreak((history || []).map(checkinFromRow)))
    setLoading(false)
  }, [client.id, today, demoMode])

  useEffect(() => { loadCheckins() }, [loadCheckins])

  useEffect(() => {
    if (demoMode) return
    ;(async () => {
      const { data: planRow } = await supabase.from('diet_plans').select('*').eq('client_id', client.id).eq('is_active', true).maybeSingle()
      if (!planRow) { setPlan(null); return }
      const [{ data: mealRows }, { data: itemRowsRaw }] = await Promise.all([
        supabase.from('diet_meals').select('*').eq('plan_id', planRow.id).order('sort_order'),
        supabase.from('diet_meal_items').select('*'),
      ])
      const mealIds = new Set((mealRows || []).map((m: { id: string }) => m.id))
      const itemRows = (itemRowsRaw || []).filter((i: { meal_id: string }) => mealIds.has(i.meal_id))
      setPlan(dietPlanFromRows(planRow, mealRows || [], itemRows, []))
    })()
  }, [client.id, demoMode])

  const loadMealLogs = useCallback(async () => {
    if (demoMode) return
    const { data } = await supabase.from('meal_logs').select('*').eq('client_id', client.id).eq('date', today)
    setMealLogsToday((data || []).map(mealLogFromRow))
  }, [client.id, today, demoMode])

  useEffect(() => { loadMealLogs() }, [loadMealLogs])

  const todaysMeals: DietMeal[] = plan
    ? resolveTodaysMeals(plan.meals, todayDayOfWeek(), loadDayType(plan.id), loadOptionChoices(plan.id))
    : []
  const mealsDoneCount = todaysMeals.filter(m => mealLogsToday.some(l => l.mealName === m.name)).length
  const allMealsDone = todaysMeals.length > 0 && mealsDoneCount === todaysMeals.length
  const totalKcalTarget = todaysMeals.length > 0 && todaysMeals.every(m => m.kcalTarget != null)
    ? todaysMeals.reduce((sum, m) => sum + (m.kcalTarget || 0), 0)
    : null
  const visibleSupplements = plan?.supplements.filter(s => s.visibleToClient) || []
  const toggleSupplementTaken = (id: string) => setSupplementsTaken(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const waterGoalReached = waterL >= WATER_GOAL_L
  const dayProgressPct = Math.round(([doneToday, waterGoalReached, allMealsDone].filter(Boolean).length / 3) * 100)
  const digestionValue = digestionFromFields(bloating, abdominalPain)

  const saveCheckin = async (overrides: Partial<{
    followedPlan: FollowedPlan; hunger: number; energy: number; mood: number; waterL: number; notes: string
    bristolScale: number | null; bloating: number | null; abdominalPain: number | null
  }> = {}) => {
    if (demoMode) {
      toast('Modo demo: los cambios no se guardan', 'ok')
      // Si hoy todavía no contaba (el check-in de hoy no venía precargado
      // de los datos de demo), el primer guardado del día suma un día más
      // de racha — mismo efecto que el recálculo real en modo no-demo.
      if (!doneToday) setStreak(s => s + 1)
      setDoneToday(true)
      return
    }
    const payload = {
      client_id: client.id, date: today,
      followed_plan: overrides.followedPlan ?? followedPlan,
      hunger: overrides.hunger ?? hunger, energy: overrides.energy ?? energy, mood: overrides.mood ?? mood,
      water_l: overrides.waterL ?? waterL, notes: overrides.notes ?? notes,
      bristol_scale: overrides.bristolScale !== undefined ? overrides.bristolScale : bristolScale,
      bloating: overrides.bloating !== undefined ? overrides.bloating : bloating,
      abdominal_pain: overrides.abdominalPain !== undefined ? overrides.abdominalPain : abdominalPain,
    }
    const { error } = await supabase.from('daily_checkins').upsert(payload, { onConflict: 'client_id,date' })
    if (error) { logError('HoyTab:save', error); return }
    setDoneToday(true)
    // Recalcula la racha tras el primer check-in del día — así el contador
    // de llama reacciona al instante, sin esperar a la siguiente carga.
    if (!doneToday) {
      const { data } = await supabase.from('daily_checkins').select('*').eq('client_id', client.id)
      setStreak(calcStreak((data || []).map(checkinFromRow)))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await saveCheckin()
    setSaving(false)
  }

  // Ajuste rápido de hidratación por cantidad fija (vaso/botella/deshacer).
  // Nunca baja de 0.
  const adjustWater = (deltaL: number) => {
    const nextWaterL = Math.max(0, Math.round((waterL + deltaL) * 100) / 100)
    setWaterL(nextWaterL)
    saveCheckin({ waterL: nextWaterL })
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(deltaL > 0 && nextWaterL >= WATER_GOAL_L && waterL < WATER_GOAL_L ? [15, 60, 15] : 15)
    }
  }

  const setDigestion = (opt: DigestionOption) => {
    const preset = DIGESTION_PRESETS[opt]
    setBristolScale(preset.bristolScale); setBloating(preset.bloating); setAbdominalPain(preset.abdominalPain)
    saveCheckin({ bristolScale: preset.bristolScale, bloating: preset.bloating, abdominalPain: preset.abdominalPain })
  }

  const markMealDone = async (meal: DietMeal) => {
    if (demoMode) {
      setMealLogsToday(prev => [...prev, { id: newId(), clientId: client.id, date: today, mealName: meal.name, note: '', photoUrl: null, createdAt: Date.now() }])
      toast('Modo demo: los cambios no se guardan', 'ok')
      return
    }
    const { data, error } = await supabase.from('meal_logs').insert({
      client_id: client.id, date: today, meal_name: meal.name, note: '', photo_url: null,
    }).select().single()
    if (error) { toast('Error al marcar la comida', 'warn'); return }
    setMealLogsToday(prev => [...prev, mealLogFromRow(data)])
  }

  const unmarkMealDone = async (meal: DietMeal) => {
    const log = mealLogsToday.find(l => l.mealName === meal.name)
    if (!log) return
    if (demoMode) { setMealLogsToday(prev => prev.filter(l => l.id !== log.id)); toast('Modo demo: los cambios no se guardan', 'ok'); return }
    await supabase.from('meal_logs').delete().eq('id', log.id)
    setMealLogsToday(prev => prev.filter(l => l.id !== log.id))
  }

  const uploadMealPhoto = async (meal: DietMeal, file: File) => {
    const existing = mealLogsToday.find(l => l.mealName === meal.name)
    if (demoMode) {
      const localUrl = URL.createObjectURL(file)
      setMealLogsToday(prev => existing
        ? prev.map(l => l.id === existing.id ? { ...l, photoUrl: localUrl } : l)
        : [...prev, { id: newId(), clientId: client.id, date: today, mealName: meal.name, note: '', photoUrl: localUrl, createdAt: Date.now() }])
      toast('Modo demo: los cambios no se guardan', 'ok')
      return
    }
    setUploadingMeal(meal.id)
    const ext = file.name.split('.').pop()
    const path = `${client.id}/meals/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
    if (upErr) { toast('Error al subir la foto', 'warn'); setUploadingMeal(null); return }
    const photoUrl = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
    if (existing) {
      await supabase.from('meal_logs').update({ photo_url: photoUrl }).eq('id', existing.id)
      setMealLogsToday(prev => prev.map(l => l.id === existing.id ? { ...l, photoUrl } : l))
    } else {
      const { data } = await supabase.from('meal_logs').insert({
        client_id: client.id, date: today, meal_name: meal.name, note: '', photo_url: photoUrl,
      }).select().single()
      if (data) setMealLogsToday(prev => [...prev, mealLogFromRow(data)])
    }
    setUploadingMeal(null)
    toast('Foto añadida ✓', 'ok')
  }

  if (loading) return null

  const g = greeting()

  return (
    <div className="px-4 py-6 space-y-4 max-w-xl mx-auto pb-24">
      {/* ── Hero: saludo, racha, progreso del día ── */}
      <div className="bg-gradient-to-br from-accent to-accent2 rounded-2xl p-5 text-white space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif font-bold">{g.text}, {client.name.split(' ')[0]} {g.icon}</h2>
            <p className="text-xs text-white/80 mt-0.5">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1.5 flex-shrink-0">
              <Flame className="w-4 h-4 animate-flame-flicker" />
              <span className="text-sm font-bold">{streak}d</span>
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-white/90 mb-1">
            <span>Progreso de hoy</span>
            <span className="font-bold">{dayProgressPct}%</span>
          </div>
          <div className="h-2 bg-white/25 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${dayProgressPct}%` }} />
          </div>
        </div>
      </div>

      {/* ── Pauta activa del nutricionista ── */}
      {plan?.advice && (
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-accent mb-1.5">{personalMode ? 'Tu nota' : 'Consejo de tu nutricionista'}</p>
          <p className="text-sm leading-relaxed">{plan.advice}</p>
        </div>
      )}

      <PendingSurveys client={client} demoMode={demoMode} />

      {/* ── Tracker de hidratación ── */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500 flex-shrink-0">
              <Droplet className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">Hidratación de precisión</p>
              <p className="text-xs text-muted">Meta diaria recomendada: {WATER_GOAL_L} L</p>
            </div>
          </div>
          <span className="text-sm font-bold text-sky-600 dark:text-sky-400 flex-shrink-0">{waterL.toFixed(2).replace(/\.?0+$/, '') || 0} L / {WATER_GOAL_L} L</span>
        </div>
        <div className="h-2 rounded-full bg-bg-alt overflow-hidden">
          <div className="h-full bg-sky-500 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (waterL / WATER_GOAL_L) * 100)}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{Math.round(Math.min(100, (waterL / WATER_GOAL_L) * 100))}% de la meta</span>
          {waterGoalReached && <span className="font-semibold text-ok">🎉 ¡Meta alcanzada!</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => adjustWater(0.25)} className="flex-1 py-2 bg-bg-alt rounded-xl text-xs font-bold text-ink hover:bg-sky-500/10 hover:text-sky-600 transition-colors">
            + 250 ml <span className="text-muted font-normal">(Vaso)</span>
          </button>
          <button onClick={() => adjustWater(0.5)} className="flex-1 py-2 bg-bg-alt rounded-xl text-xs font-bold text-ink hover:bg-sky-500/10 hover:text-sky-600 transition-colors">
            + 500 ml <span className="text-muted font-normal">(Botella)</span>
          </button>
          <button onClick={() => adjustWater(-0.25)} disabled={waterL <= 0}
            className="px-3 py-2 bg-bg-alt rounded-xl text-xs font-bold text-muted hover:text-warn transition-colors disabled:opacity-30">
            −250 ml
          </button>
        </div>
      </div>

      {/* ── Comidas del día ── */}
      {todaysMeals.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">Comidas del día</p>
                <p className="text-xs text-muted">{mealsDoneCount} de {todaysMeals.length} completadas</p>
              </div>
            </div>
            {totalKcalTarget != null && <span className="text-xs font-semibold text-muted flex-shrink-0">Objetivo: {totalKcalTarget} kcal</span>}
          </div>
          <div className="divide-y divide-border">
            {todaysMeals.map(meal => {
              const log = mealLogsToday.find(l => l.mealName === meal.name)
              const done = !!log
              return (
                <div key={meal.id} className="flex items-center gap-3 py-2.5">
                  <button onClick={() => done ? unmarkMealDone(meal) : markMealDone(meal)} className="flex-shrink-0">
                    {done ? <CheckSquare className="w-5 h-5 text-ok" /> : <Square className="w-5 h-5 text-muted" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold truncate ${done ? 'line-through text-muted' : ''}`}>
                        {meal.name} <span className="font-normal text-muted">· {meal.time}</span>
                      </p>
                      {meal.kcalTarget != null && (
                        <span className="text-[11px] font-semibold text-muted bg-bg-alt px-2 py-0.5 rounded-full flex-shrink-0">{meal.kcalTarget} kcal</span>
                      )}
                    </div>
                    {meal.items.length > 0 && (
                      <p className="text-xs text-muted mt-0.5 truncate">
                        {meal.items.map(i => `${i.foodName}${i.quantity ? ` (${i.quantity}${i.unit})` : ''}`).join(', ')}
                      </p>
                    )}
                  </div>
                  {log?.photoUrl ? (
                    <img src={log.photoUrl} alt={meal.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <label className="w-10 h-10 rounded-lg bg-bg-alt flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-bg-alt/70">
                      {uploadingMeal === meal.id ? (
                        <span className="text-[9px] text-muted">...</span>
                      ) : (
                        <Camera className="w-4 h-4 text-muted" />
                      )}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadMealPhoto(meal, f) }} />
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Pauta de suplementos ── */}
      {visibleSupplements.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
              <Pill className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">Pauta de suplementos</p>
              <p className="text-xs text-muted">Marcar cuando los hayas tomado hoy</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {visibleSupplements.map(s => {
              const taken = supplementsTaken.has(s.id)
              return (
                <button key={s.id} onClick={() => toggleSupplementTaken(s.id)}
                  className="w-full flex items-center gap-3 py-2 text-left">
                  {taken ? <CheckSquare className="w-5 h-5 text-ok flex-shrink-0" /> : <Square className="w-5 h-5 text-muted flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${taken ? 'line-through text-muted' : ''}`}>{s.name}</p>
                    <p className="text-xs text-muted">{s.dose}{s.timing ? ` · ${s.timing}` : ''}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-ok/10 flex items-center justify-center text-ok flex-shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">Check-in de sensaciones</p>
              <p className="text-xs text-muted">Evaluación de hábitos diarios</p>
            </div>
          </div>
          {doneToday && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-ok/10 text-xs font-bold text-ok flex-shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> Registrado hoy</span>}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">¿Seguiste el plan hoy?</p>
          <div className="flex gap-2">
            {(Object.keys(FOLLOWED_PLAN_LABELS) as FollowedPlan[]).map(v => (
              <button key={v} onClick={() => { setFollowedPlan(v); saveCheckin({ followedPlan: v }) }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  followedPlan === v ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-accent'
                }`}>
                {FOLLOWED_PLAN_LABELS[v]}
              </button>
            ))}
          </div>
        </div>

        <NumberScaleField label="Nivel de hambre" value={hunger} onChange={v => { setHunger(v); saveCheckin({ hunger: v }) }} />
        <NumberScaleField label="Energía & vitalidad" value={energy} onChange={v => { setEnergy(v); saveCheckin({ energy: v }) }} />
        <NumberScaleField label="Estado de ánimo" value={mood} onChange={v => { setMood(v); saveCheckin({ mood: v }) }} />

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Digestión del día</p>
          <div className="flex gap-1.5">
            {(Object.keys(DIGESTION_PRESETS) as DigestionOption[]).map(opt => (
              <button key={opt} onClick={() => setDigestion(opt)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  digestionValue === opt ? 'bg-accent text-white border-accent' : 'border-border text-muted hover:border-accent'
                }`}>
                {DIGESTION_PRESETS[opt].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Sensaciones o notas para tu nutricionista (opcional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="¿Cómo te has sentido hoy? ¿Alguna comida fuera de pauta o entrenamiento especial?"
            className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3.5 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Actualizar check-in de hoy'}
        </button>
      </div>

      {/* Sin sentido en modo personal: no hay un profesional distinto al
          que pedirle cita. */}
      {!personalMode && (
        <ProximasCitas client={client} demoMode={demoMode} demoCitas={demoMode ? DEMO_APPOINTMENTS.filter(a => a.clientId === client.id) : undefined} />
      )}
    </div>
  )
}

function ProximasCitas({ client, demoMode, demoCitas }: { client: ClientData; demoMode?: boolean; demoCitas?: Appointment[] }) {
  const [citas, setCitas] = useState<Appointment[]>(demoCitas ?? [])
  const [loading, setLoading] = useState(!demoMode)
  const [requesting, setRequesting] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (demoMode) return
    const { data } = await supabase.from('appointments').select('*')
      .eq('client_id', client.id).in('status', ['confirmada', 'pendiente'])
      .gte('start_at', new Date().toISOString()).order('start_at').limit(3)
    setCitas((data || []).map(appointmentFromRow))
    setLoading(false)
  }, [client.id, demoMode])

  useEffect(() => { load() }, [load])

  const requestAppointment = async () => {
    if (!date) { toast('Elige una fecha', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setRequesting(false); setDate(''); return }
    setSaving(true)
    const start = new Date(date + 'T' + time)
    const end = new Date(start.getTime() + 30 * 60000)
    const { error } = await supabase.from('appointments').insert({
      nutricionista_id: client.nutricionistaId, client_id: client.id,
      title: `Cita solicitada por ${client.name}`,
      start_at: start.toISOString(), end_at: end.toISOString(), status: 'pendiente', notes: '',
    })
    setSaving(false)
    if (error) { toast('Error al pedir la cita', 'warn'); return }
    sendPush({ nutricionistaId: client.nutricionistaId }, 'Nueva solicitud de cita 📅',
      `${client.name} ha pedido cita para el ${new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`)
    toast('Cita solicitada — te avisaremos cuando se confirme ✓', 'ok')
    setRequesting(false); setDate('')
    await load()
  }

  if (loading) return null

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Próximas citas</p>
        <button onClick={() => setRequesting(v => !v)} className="flex items-center gap-1 text-xs font-bold text-accent">
          <Plus className="w-3.5 h-3.5" /> Pedir cita
        </button>
      </div>
      {citas.length === 0 ? (
        <p className="text-sm text-muted">No tienes citas próximas.</p>
      ) : (
        <div className="space-y-2">
          {citas.map(c => (
            <div key={c.id} className="border border-border rounded-xl p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="text-xs text-muted">
                  {new Date(c.startAt).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                  {' · '}{new Date(c.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {c.videoLink && (
                  <a href={c.videoLink} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent rounded-lg text-[10px] font-bold">
                    <Video className="w-3 h-3" /> Unirse
                  </a>
                )}
                {c.status === 'pendiente' && <span className="text-[10px] font-bold text-warn uppercase">Pendiente</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {requesting && (
        <div className="flex items-center gap-2 pt-1">
          <input type="date" value={date} min={toLocalISODate(new Date())} onChange={e => setDate(e.target.value)}
            className="flex-1 px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none" />
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="w-28 px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none" />
          <button onClick={requestAppointment} disabled={saving}
            className="px-3 py-2 bg-ink text-white rounded-lg text-xs font-bold disabled:opacity-50">Pedir</button>
        </div>
      )}
    </div>
  )
}

function NumberScaleField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{label}</p>
      <div className="flex gap-2">
        {SCALE.map(n => (
          <button key={n} onClick={() => onChange(n)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
              value === n ? 'bg-accent text-white border-accent' : 'border-border text-muted hover:border-accent/40'
            }`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
