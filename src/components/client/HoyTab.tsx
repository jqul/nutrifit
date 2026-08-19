import { useState, useEffect, useCallback } from 'react'
import { ClientData, FollowedPlan, Appointment } from '../../types'
import { supabase } from '../../lib/supabase'
import { logError } from '../../lib/errors'
import { FOLLOWED_PLAN_LABELS } from '../../lib/constants'
import { toLocalISODate } from '../../lib/date'
import { appointmentFromRow } from '../../lib/mappers'
import { sendPush } from '../../lib/usePushNotifications'
import { PendingSurveys } from './PendingSurveys'
import { DEMO_APPOINTMENTS } from '../../lib/demo-data'
import { toast } from '../shared/Toast'
import { CheckCircle2, Calendar, Plus, Video } from 'lucide-react'

const SCALE = [1, 2, 3, 4, 5]
const BRISTOL_OPTIONS = [
  { value: 1, label: '1', hint: 'Bolitas duras' },
  { value: 2, label: '2', hint: 'Grumosa' },
  { value: 3, label: '3', hint: 'Agrietada' },
  { value: 4, label: '4', hint: 'Normal' },
  { value: 5, label: '5', hint: 'Blanda' },
  { value: 6, label: '6', hint: 'Pastosa' },
  { value: 7, label: '7', hint: 'Líquida' },
]
const INTENSITY_OPTIONS = [
  { value: 0, label: 'Ninguna' }, { value: 1, label: 'Leve' }, { value: 2, label: 'Moderada' }, { value: 3, label: 'Intensa' },
]

export function HoyTab({ client, demoMode }: { client: ClientData; demoMode?: boolean }) {
  const today = toLocalISODate(new Date())
  const [loading, setLoading] = useState(!demoMode)
  const [doneToday, setDoneToday] = useState(false)
  const [followedPlan, setFollowedPlan] = useState<FollowedPlan>('si')
  const [hunger, setHunger] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [mood, setMood] = useState(3)
  const [waterL, setWaterL] = useState('')
  const [notes, setNotes] = useState('')
  const [showDigestive, setShowDigestive] = useState(false)
  const [bristolScale, setBristolScale] = useState<number | null>(null)
  const [bloating, setBloating] = useState<number | null>(null)
  const [abdominalPain, setAbdominalPain] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (demoMode) return
    supabase.from('daily_checkins').select('*').eq('client_id', client.id).eq('date', today).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDoneToday(true)
          setFollowedPlan(data.followed_plan)
          setHunger(data.hunger)
          setEnergy(data.energy)
          setMood(data.mood)
          setWaterL(data.water_l != null ? String(data.water_l) : '')
          setNotes(data.notes || '')
          setBristolScale(data.bristol_scale)
          setBloating(data.bloating)
          setAbdominalPain(data.abdominal_pain)
          if (data.bristol_scale != null || data.bloating != null || data.abdominal_pain != null) setShowDigestive(true)
        }
        setLoading(false)
      })
  }, [client.id, today, demoMode])

  const handleSave = async () => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setDoneToday(true); return }
    setSaving(true)
    const { error } = await supabase.from('daily_checkins').upsert({
      client_id: client.id, date: today, followed_plan: followedPlan,
      hunger, energy, mood, water_l: waterL ? parseFloat(waterL) : null, notes,
      bristol_scale: bristolScale, bloating, abdominal_pain: abdominalPain,
    }, { onConflict: 'client_id,date' })
    setSaving(false)
    if (error) { logError('HoyTab:save', error); return }
    setDoneToday(true)
  }

  if (loading) return null

  return (
    <div className="px-4 py-6 space-y-4 max-w-xl mx-auto pb-24">
      <div>
        <h2 className="text-xl font-serif font-bold">Hola, {client.name.split(' ')[0]} 👋</h2>
        <p className="text-sm text-muted mt-1">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <PendingSurveys client={client} demoMode={demoMode} />

      <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Check-in diario</p>
          {doneToday && <span className="flex items-center gap-1 text-xs font-bold text-ok"><CheckCircle2 className="w-3.5 h-3.5" /> Hecho hoy</span>}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">¿Seguiste el plan hoy?</p>
          <div className="flex gap-2">
            {(Object.keys(FOLLOWED_PLAN_LABELS) as FollowedPlan[]).map(v => (
              <button key={v} onClick={() => setFollowedPlan(v)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  followedPlan === v ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-accent'
                }`}>
                {FOLLOWED_PLAN_LABELS[v]}
              </button>
            ))}
          </div>
        </div>

        <ScaleField label="Hambre" value={hunger} onChange={setHunger} />
        <ScaleField label="Energía" value={energy} onChange={setEnergy} />
        <ScaleField label="Ánimo" value={mood} onChange={setMood} />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Agua (litros)</label>
          <input type="number" step="0.1" value={waterL} onChange={e => setWaterL(e.target.value)}
            placeholder="2.0"
            className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Notas (opcional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
        </div>

        {!showDigestive ? (
          <button onClick={() => setShowDigestive(true)} className="text-xs font-bold text-accent">
            + Añadir diario digestivo (opcional)
          </button>
        ) : (
          <div className="pt-3 border-t border-border space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Diario digestivo (opcional)</p>
            <div>
              <p className="text-xs text-muted mb-2">Forma de las heces hoy (escala de Bristol)</p>
              <div className="flex gap-1.5 flex-wrap">
                {BRISTOL_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setBristolScale(bristolScale === o.value ? null : o.value)} title={o.hint}
                    className={`flex-1 min-w-[38px] py-2 rounded-xl text-xs font-semibold border transition-all ${
                      bristolScale === o.value ? 'bg-accent text-white border-accent' : 'border-border text-muted hover:border-accent'
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <IntensityField label="Hinchazón" value={bloating} onChange={setBloating} />
            <IntensityField label="Dolor abdominal" value={abdominalPain} onChange={setAbdominalPain} />
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3.5 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50">
          {saving ? 'Guardando...' : doneToday ? 'Actualizar check-in' : 'Guardar check-in'}
        </button>
      </div>

      <ProximasCitas client={client} demoMode={demoMode} demoCitas={demoMode ? DEMO_APPOINTMENTS.filter(a => a.clientId === client.id) : undefined} />
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

function IntensityField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <p className="text-xs text-muted mb-2">{label}</p>
      <div className="flex gap-1.5">
        {INTENSITY_OPTIONS.map(o => (
          <button key={o.value} onClick={() => onChange(value === o.value ? null : o.value)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
              value === o.value ? 'bg-accent text-white border-accent' : 'border-border text-muted hover:border-accent'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ScaleField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{label}</p>
      <div className="flex gap-2">
        {SCALE.map(n => (
          <button key={n} onClick={() => onChange(n)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
              value === n ? 'bg-accent text-white border-accent' : 'border-border text-muted hover:border-accent'
            }`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
