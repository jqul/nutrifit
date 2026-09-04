import { useState, useEffect, useCallback } from 'react'
import { ClientData } from '../../../types'
import { supabase } from '../../../lib/supabase'
import { weightFromRow, checkinFromRow, photoSessionFromRow, mealLogFromRow, clinicalNoteFromRow } from '../../../lib/mappers'
import { WeightEntry, DailyCheckin, ProgressPhotoSession, MealLog, ClinicalNote } from '../../../types'
import { BloodMarkerRow } from '../../../lib/supabase-types'
import { calcAdherence, calcStreak } from '../../../lib/adherence'
import { WeightChart } from '../../shared/WeightChart'
import { HealthTimeline } from '../../shared/HealthTimeline'
import { FOLLOWED_PLAN_LABELS } from '../../../lib/constants'
import { SurveyHistory } from './SurveyHistory'
import { DEMO_CUSTOM_SURVEYS, DEMO_SURVEY_RESPONSES } from '../../../lib/demo-data'
import { printProgressReport } from '../../../lib/printProgressReport'
import { toLocalISODate } from '../../../lib/date'
import { toast } from '../../shared/Toast'
import { Flame, Camera, UtensilsCrossed, AlertTriangle, FileDown, Plus } from 'lucide-react'

const INTENSITY_LABELS = ['Ninguna', 'Leve', 'Moderada', 'Intensa']
function isConcerningCheckin(c: DailyCheckin): boolean {
  return (c.bristolScale != null && (c.bristolScale <= 2 || c.bristolScale >= 6))
    || (c.bloating != null && c.bloating >= 2) || (c.abdominalPain != null && c.abdominalPain >= 2)
}

interface DemoData {
  weights: WeightEntry[]; checkins: DailyCheckin[]; photos: ProgressPhotoSession[]; mealLogs: MealLog[]
  bloodMarkers?: BloodMarkerRow[]; clinicalNotes?: ClinicalNote[]
}

export function SeguimientoTab({ client, demoData, nutricionistaLogoUrl, nutricionistaAccentColor, onUpdate }: {
  client: ClientData; demoData?: DemoData
  nutricionistaLogoUrl?: string | null; nutricionistaAccentColor?: string | null
  onUpdate?: (updates: Partial<ClientData>) => Promise<boolean>
}) {
  const [weights, setWeights] = useState<WeightEntry[]>(demoData?.weights ?? [])
  const [checkins, setCheckins] = useState<DailyCheckin[]>(demoData?.checkins ?? [])
  const [sessions, setSessions] = useState<ProgressPhotoSession[]>(demoData?.photos ?? [])
  const [mealLogs, setMealLogs] = useState<MealLog[]>(demoData?.mealLogs ?? [])
  const [bloodMarkers, setBloodMarkers] = useState<BloodMarkerRow[]>(demoData?.bloodMarkers ?? [])
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>(demoData?.clinicalNotes ?? [])
  const [loading, setLoading] = useState(!demoData)
  const demoMode = !!demoData
  // Notas del profesional para el informe en PDF (distintas de las notas
  // privadas de NotasTab.tsx — estas SÍ se imprimen, y ahora también las
  // puede descargar el propio cliente, así que van en un campo separado.
  const [reportNotes, setReportNotes] = useState(client.reportNotes)
  const [savingNotes, setSavingNotes] = useState(false)
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

  const load = useCallback(async () => {
    if (demoData) return
    setLoading(true)
    const [{ data: w }, { data: c }, { data: p }, { data: m }, { data: bm }, { data: cn }] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('client_id', client.id).order('date'),
      supabase.from('daily_checkins').select('*').eq('client_id', client.id).order('date', { ascending: false }),
      supabase.from('progress_photos').select('*').eq('client_id', client.id).order('date', { ascending: false }),
      supabase.from('meal_logs').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
      supabase.from('blood_markers').select('*').eq('client_id', client.id).order('date', { ascending: false }),
      supabase.from('client_clinical_notes').select('*').eq('client_id', client.id).order('date', { ascending: false }),
    ])
    setWeights((w || []).map(weightFromRow))
    setCheckins((c || []).map(checkinFromRow))
    setSessions((p || []).map(photoSessionFromRow))
    setMealLogs((m || []).map(mealLogFromRow))
    setBloodMarkers(bm || [])
    setClinicalNotes((cn || []).map(clinicalNoteFromRow))
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

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Notas y conclusiones para el informe</p>
          <button onClick={() => printProgressReport({ ...client, reportNotes }, { weights, checkins, bloodMarkers },
            { logoUrl: nutricionistaLogoUrl, accentColor: nutricionistaAccentColor })}
            className="flex items-center gap-1.5 text-xs font-bold text-accent flex-shrink-0">
            <FileDown className="w-3.5 h-3.5" /> Descargar PDF
          </button>
        </div>
        <p className="text-xs text-muted">Se imprimen tal cual en el informe clínico — el cliente también puede descargarlo desde su móvil.</p>
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

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
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

      <HealthTimeline weights={weights} bloodMarkers={bloodMarkers} photos={sessions} clinicalNotes={clinicalNotes}
        mealLogs={mealLogs} checkins={checkins} variant="trainer" />

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
