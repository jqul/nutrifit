import { useState, useEffect, useCallback } from 'react'
import { ClientData } from '../../../types'
import { supabase } from '../../../lib/supabase'
import { weightFromRow, cycleEntryFromRow, checkinFromRow, photoSessionFromRow, mealLogFromRow, clinicalNoteFromRow } from '../../../lib/mappers'
import { WeightEntry, CycleEntry, DailyCheckin, ProgressPhotoSession, MealLog, ClinicalNote } from '../../../types'
import { BloodMarkerRow, DietPlanChangeRow } from '../../../lib/supabase-types'
import { calcAdherence, calcStreak } from '../../../lib/adherence'
import { WeightChart } from '../../shared/WeightChart'
import { HealthTimeline } from '../../shared/HealthTimeline'
import { StoragePhoto } from '../../shared/StoragePhoto'
import { FOLLOWED_PLAN_LABELS } from '../../../lib/constants'
import { SurveyHistory } from './SurveyHistory'
import { extrasByDay } from '../../../lib/scannedLogs'
import { WeeklyReviewCard } from './WeeklyReviewCard'
import { DietAdjustmentCard } from './DietAdjustmentCard'
import { DEMO_CUSTOM_SURVEYS, DEMO_SURVEY_RESPONSES } from '../../../lib/demo-data'
import { printProgressReport, ReportOptions } from '../../../lib/printProgressReport'
import { ReportOptionsModal } from './ReportOptionsModal'
import { getDemoReviews } from '../../../hooks/useClientReviews'
import { DEMO_PLAN_CHANGES } from '../../../lib/demo-data'
import { toLocalISODate } from '../../../lib/date'
import { summarizeSignals, isConcerningCheckin, SignalTone } from '../../../lib/checkinSignals'
import { summarizeWeight, weightDeltaTone, formatWeightDelta } from '../../../lib/clientListSummary'
import { TONE_CLASS } from '../healthStyles'
import { toast } from '../../shared/Toast'
import { Flame, UtensilsCrossed, AlertTriangle, FileDown, Plus } from 'lucide-react'

const INTENSITY_LABELS = ['Ninguna', 'Leve', 'Moderada', 'Intensa']

const LEVEL_HINT: Record<SignalTone, string> = { good: 'Buena', warn: 'Baja', neutral: 'Media' }
const fmtScale = (avg: number | null) => (avg == null ? '—' : `${avg.toFixed(1).replace('.', ',')}/5`)

function SignalTile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: SignalTone }) {
  const dot = { good: 'bg-ok', warn: 'bg-warn', neutral: 'bg-muted/50' }[tone]
  return (
    <div className="bg-bg-alt/60 rounded-xl p-3">
      <p className="text-xs text-muted flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} /> {label}</p>
      <p className="font-serif font-bold text-lg leading-tight mt-1">{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  )
}

interface DemoData {
  weights: WeightEntry[]; checkins: DailyCheckin[]; photos: ProgressPhotoSession[]; mealLogs: MealLog[]
  bloodMarkers?: BloodMarkerRow[]; clinicalNotes?: ClinicalNote[]; cycles?: CycleEntry[]
}

export function SeguimientoTab({ client, demoData, nutricionistaLogoUrl, nutricionistaAccentColor, nutricionistaName, onUpdate }: {
  client: ClientData; demoData?: DemoData
  nutricionistaLogoUrl?: string | null; nutricionistaAccentColor?: string | null; nutricionistaName?: string
  onUpdate?: (updates: Partial<ClientData>) => Promise<boolean>
}) {
  const [weights, setWeights] = useState<WeightEntry[]>(demoData?.weights ?? [])
  const [checkins, setCheckins] = useState<DailyCheckin[]>(demoData?.checkins ?? [])
  const [sessions, setSessions] = useState<ProgressPhotoSession[]>(demoData?.photos ?? [])
  const [mealLogs, setMealLogs] = useState<MealLog[]>(demoData?.mealLogs ?? [])
  const [bloodMarkers, setBloodMarkers] = useState<BloodMarkerRow[]>(demoData?.bloodMarkers ?? [])
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>(demoData?.clinicalNotes ?? [])
  const [cycles, setCycles] = useState<CycleEntry[]>(demoData?.cycles ?? [])
  const [loading, setLoading] = useState(!demoData)
  const demoMode = !!demoData
  // Lo que el cliente ha escaneado y apuntado: comida fuera del plan, de los últimos 7 días.
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const extraDays = extrasByDay(mealLogs, toLocalISODate(sevenDaysAgo))
  const extraKcal = extraDays.reduce((s, d) => s + d.kcal, 0)
  const extraCount = extraDays.reduce((s, d) => s + d.count, 0)
  // Notas del profesional para el informe en PDF (distintas de las notas
  // privadas de NotasTab.tsx — estas SÍ se imprimen, y ahora también las
  // puede descargar el propio cliente, así que van en un campo separado.
  const [reportNotes, setReportNotes] = useState(client.reportNotes)
  const [savingNotes, setSavingNotes] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const reportNotesDirty = reportNotes !== client.reportNotes

  // Nota clínica fechada para la Línea de vida clínica (HealthTimeline) —
  // distinta tanto de reportNotes (un único bloque para el PDF) como de las
  // notas privadas de NotasTab.tsx: esto es un historial cronológico visible
  // para el cliente.
  const [addingNote, setAddingNote] = useState(false)
  const [noteDate, setNoteDate] = useState(toLocalISODate(new Date()))
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const handleSaveReportNotes = async () => {
    if (!onUpdate) return
    setSavingNotes(true)
    const ok = await onUpdate({ reportNotes })
    setSavingNotes(false)
    if (ok) toast('Notas del informe guardadas ✓', 'ok')
  }

  // Genera el informe: lo interno del nutricionista (cambios del plan, valoraciones) se lee
  // solo si se pide, y la ventana se abre antes de esperar para que no la bloquee el navegador.
  const generateReport = async (options: ReportOptions) => {
    const win = window.open('', '_blank')
    if (!win) { toast('El navegador bloqueó la ventana del informe: permite las ventanas emergentes', 'warn'); return }
    setGeneratingReport(true)
    try {
      let planChanges: DietPlanChangeRow[] | undefined
      let reviews: { week_start: string; status: 'accepted' | 'edited' | 'ignored'; note: string }[] | undefined
      if (options.sections.planChanges) {
        planChanges = demoMode ? DEMO_PLAN_CHANGES[client.id] ?? []
          : ((await supabase.from('diet_plan_changes').select('*').eq('client_id', client.id)).data ?? []) as DietPlanChangeRow[]
      }
      if (options.sections.reviews) {
        reviews = demoMode ? getDemoReviews(client.id)
          : ((await supabase.from('client_reviews').select('week_start, status, note').eq('client_id', client.id)).data ?? []) as typeof reviews
      }
      printProgressReport({ ...client, reportNotes }, { weights, checkins, bloodMarkers, planChanges, reviews },
        { logoUrl: nutricionistaLogoUrl, accentColor: nutricionistaAccentColor }, options, win)
      setReportOpen(false)
    } catch {
      win.close()
      toast('No se pudo generar el informe', 'warn')
    } finally {
      setGeneratingReport(false)
    }
  }

  const load = useCallback(async () => {
    if (demoData) return
    setLoading(true)
    const [{ data: w }, { data: c }, { data: p }, { data: m }, { data: bm }, { data: cn }, { data: cy }] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('client_id', client.id).order('date'),
      supabase.from('daily_checkins').select('*').eq('client_id', client.id).order('date', { ascending: false }),
      supabase.from('progress_photos').select('*').eq('client_id', client.id).order('date', { ascending: false }),
      supabase.from('meal_logs').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
      supabase.from('blood_markers').select('*').eq('client_id', client.id).order('date', { ascending: false }),
      supabase.from('client_clinical_notes').select('*').eq('client_id', client.id).order('date', { ascending: false }),
      supabase.from('cycle_logs').select('*').eq('client_id', client.id).order('start_date'),
    ])
    setWeights((w || []).map(weightFromRow))
    setCheckins((c || []).map(checkinFromRow))
    setSessions((p || []).map(photoSessionFromRow))
    setMealLogs((m || []).map(mealLogFromRow))
    setBloodMarkers(bm || [])
    setClinicalNotes((cn || []).map(clinicalNoteFromRow))
    setCycles((cy || []).map(cycleEntryFromRow))
    setLoading(false)
  }, [client.id, demoData])

  useEffect(() => { load() }, [load])

  const handleAddNote = async () => {
    if (!noteText.trim()) { toast('Escribe algo antes de guardar', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setAddingNote(false); setNoteText(''); return }
    setSavingNote(true)
    const { error } = await supabase.from('client_clinical_notes').insert({ client_id: client.id, date: noteDate, note: noteText.trim() })
    setSavingNote(false)
    if (error) { toast('Error al guardar la nota', 'warn'); return }
    toast('Nota clínica añadida ✓', 'ok')
    setAddingNote(false); setNoteText(''); setNoteDate(toLocalISODate(new Date()))
    await load()
  }

  if (loading) return <p className="text-muted text-sm">Cargando...</p>

  const today = new Date()
  const adherence7d = calcAdherence(checkins, 7, today)
  const adherence30d = calcAdherence(checkins, 30, today)
  const streak = calcStreak(checkins, today)
  const recentCheckins = [...checkins].sort((a, b) => b.date.localeCompare(a.date))
  const signals = summarizeSignals(checkins, today)
  const delta7 = summarizeWeight(weights, today, 7)?.deltaKg ?? null
  const delta28 = summarizeWeight(weights, today, 28)?.deltaKg ?? null

  return (
    <div className="max-w-2xl space-y-6">
      <WeeklyReviewCard client={client} checkins={checkins} weights={weights} demoMode={demoMode} />
      <DietAdjustmentCard client={client} checkins={checkins} weights={weights} demoMode={demoMode} />

      <div className="card p-5 space-y-3">
        <p className="font-semibold text-sm">Evolución del peso</p>
        {weights.length >= 2 && (
          <p className="text-sm flex flex-wrap gap-x-4 gap-y-1">
            {([['Última semana', delta7], ['Últimas 4 semanas', delta28]] as const).map(([label, delta]) => (
              <span key={label} className="text-muted">{label}: <span className={`font-semibold ${TONE_CLASS[weightDeltaTone(client.goal, delta)]}`}>{delta == null ? '—' : formatWeightDelta(delta)}</span></span>
            ))}
          </p>
        )}
        <WeightChart entries={weights} goalKg={client.goalWeightKg} cycleEntries={cycles} />
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-sm">Adherencia</p>
          <span className="flex items-center gap-1 text-sm font-semibold"><Flame className="w-4 h-4 text-accent" /> {streak} {streak === 1 ? 'día' : 'días'} de racha</span>
        </div>
        {([['Últimos 7 días', adherence7d], ['Últimos 30 días', adherence30d]] as const).map(([label, value]) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted">{label}</span>
              <span className="text-sm font-bold">{value}%</span>
            </div>
            <div className="h-2 bg-bg-alt rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="font-semibold text-sm">Señales</p>
          <span className="text-xs text-muted">últimos 7 días · {signals.days} check-in{signals.days === 1 ? '' : 's'}</span>
        </div>
        {signals.days === 0 ? (
          <p className="text-sm text-muted">Sin check-ins esta semana.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SignalTile label="Hambre" tone={signals.hunger.tone} value={fmtScale(signals.hunger.avg)}
              hint={signals.hunger.tone === 'warn' ? 'Alta' : signals.hunger.tone === 'good' ? 'Moderada' : (signals.hunger.avg ?? 3) < 2 ? 'Baja' : 'Algo alta'} />
            <SignalTile label="Energía" tone={signals.energy.tone} value={fmtScale(signals.energy.avg)} hint={LEVEL_HINT[signals.energy.tone]} />
            <SignalTile label="Ánimo" tone={signals.mood.tone} value={fmtScale(signals.mood.avg)} hint={LEVEL_HINT[signals.mood.tone]} />
            <SignalTile label="Digestión" tone={signals.digestion.tone}
              value={signals.digestion.daysWithData === 0 ? '—' : signals.digestion.concerningDays === 0 ? 'Sin molestias' : `${signals.digestion.concerningDays} día${signals.digestion.concerningDays === 1 ? '' : 's'} con molestias`}
              hint={signals.digestion.daysWithData === 0 ? 'Sin registros' : `${signals.digestion.daysWithData} registro${signals.digestion.daysWithData === 1 ? '' : 's'}`} />
          </div>
        )}
      </div>

      <HealthTimeline weights={weights} bloodMarkers={bloodMarkers} photos={sessions} clinicalNotes={clinicalNotes}
        mealLogs={mealLogs} checkins={checkins} variant="trainer" nutricionistaName={nutricionistaName} goalWeightKg={client.goalWeightKg} />

      <div className="card p-5">
        <p className="font-semibold text-sm mb-3 flex items-center gap-1.5">Fotos de progreso</p>
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
                      {url ? <StoragePhoto path={url} className="w-full h-full object-cover" alt="" /> : <span className="text-xs text-muted">—</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <p className="font-semibold text-sm mb-3 flex items-center gap-1.5">Diario de comidas</p>
        {extraDays.length > 0 && (
          <div className="mb-3 rounded-xl bg-warn/10 px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-warn">Fuera del plan · últimos 7 días</p>
            <p className="text-sm mt-1">
              <span className="font-semibold">{extraKcal} kcal</span> en {extraCount} {extraCount === 1 ? 'producto escaneado' : 'productos escaneados'}
              <span className="text-muted"> · {Math.round(extraKcal / 7)} kcal de media al día</span>
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {extraDays.map(d => (
                <li key={d.date} className="text-xs text-muted">
                  {new Date(d.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}: {d.kcal} kcal ({d.count})
                </li>
              ))}
            </ul>
          </div>
        )}
        {mealLogs.length === 0 ? (
          <p className="text-sm text-muted">El cliente todavía no ha registrado comidas.</p>
        ) : (
          <div className="space-y-2">
            {mealLogs.slice(0, 10).map(m => (
              <div key={m.id} className="flex items-center gap-3 border border-border rounded-xl p-2.5">
                {m.photoUrl ? (
                  <StoragePhoto path={m.photoUrl} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt={m.mealName} />
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

      <div className="card p-5">
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
                  <div className={`flex items-center gap-1.5 flex-wrap text-xs ${isConcerningCheckin(c) ? 'text-warn' : 'text-muted'}`}>
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

      <div className="pt-2">
        <p className="font-serif font-bold text-lg">Informe y notas</p>
        <p className="text-xs text-muted">Lo que escribes tú: el informe en PDF y las notas fechadas para la línea de vida.</p>
      </div>

      <div className="card p-5 space-y-3">
        <div>
          <p className="font-semibold text-sm">Informe de progreso</p>
          <p className="text-xs text-muted mt-0.5">Un PDF con el peso, la adherencia y las señales del periodo que elijas, para entregar a tu cliente o a su médico. Tú decides qué secciones lleva.</p>
        </div>
        <button onClick={() => setReportOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90">
          <FileDown className="w-4 h-4" /> Generar informe
        </button>
      </div>

      <ReportOptionsModal open={reportOpen} onClose={() => setReportOpen(false)} onGenerate={generateReport} busy={generatingReport} />

      <div className="card p-5 space-y-3">
        <p className="font-semibold text-sm">Observaciones y próximos objetivos</p>
        <p className="text-xs text-muted">Aparecen en el informe de progreso. El cliente también puede descargar el suyo desde el móvil, sin cambios del plan ni valoraciones.</p>
        <textarea value={reportNotes} onChange={e => setReportNotes(e.target.value)} rows={3}
          placeholder="Indicaciones y objetivos de cara a la siguiente revisión..."
          className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm resize-none" />
        {onUpdate && (
          <button onClick={handleSaveReportNotes} disabled={!reportNotesDirty || savingNotes}
            className="px-3 py-1.5 bg-ink text-white rounded-lg text-xs font-bold disabled:opacity-40">
            {savingNotes ? 'Guardando...' : 'Guardar notas'}
          </button>
        )}
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Nota clínica</p>
          <button onClick={() => setAddingNote(v => !v)} className="flex items-center gap-1 text-xs font-bold text-accent">
            <Plus className="w-3.5 h-3.5" /> Añadir
          </button>
        </div>
        {addingNote && (
          <div className="border border-dashed border-border rounded-xl p-3 space-y-2">
            <p className="text-xs text-muted">Se guarda con fecha y queda visible para el cliente en su Línea de vida clínica.</p>
            <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)}
              className="px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none" />
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2}
              placeholder="Observaciones, cambios de pauta, ajustes..."
              className="w-full px-2.5 py-2 bg-bg border border-border rounded-lg text-sm outline-none resize-none" />
            <div className="flex gap-2">
              <button onClick={() => { setAddingNote(false); setNoteText('') }}
                className="flex-1 py-1.5 border border-border rounded-lg text-xs text-muted">Cancelar</button>
              <button onClick={handleAddNote} disabled={savingNote}
                className="flex-1 py-1.5 bg-ink text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                {savingNote ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
