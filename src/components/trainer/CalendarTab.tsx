import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { appointmentFromRow } from '../../lib/mappers'
import { Appointment, AppointmentStatus } from '../../types'
import { toLocalISODate } from '../../lib/date'
import { groupAppointmentsByDay, dayHeading } from '../../lib/calendarList'
import { ClientWithStats } from '../../hooks/useNutricionistaClients'
import { sendPush } from '../../lib/usePushNotifications'
import { DEMO_APPOINTMENTS } from '../../lib/demo-data'
import { Button } from '../shared/Button'
import { Modal } from '../shared/Modal'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { toast } from '../shared/Toast'
import { ChevronLeft, ChevronRight, Plus, Check, X, Trash2, Video, List, CalendarDays } from 'lucide-react'

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pendiente: 'Pendiente', confirmada: 'Confirmada', cancelada: 'Cancelada', completada: 'Completada',
}
const STATUS_COLOR: Record<AppointmentStatus, string> = {
  pendiente: 'text-warn', confirmada: 'text-accent', cancelada: 'text-muted line-through', completada: 'text-ok',
}

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

const EMPTY_FORM = { title: '', clientId: '', date: toLocalISODate(new Date()), time: '10:00', durationMin: '30', recurring: false, recurringWeeks: '4', videoLink: '' }

export function CalendarTab({ nutricionistaId, clients, demoMode }: {
  nutricionistaId: string
  clients: ClientWithStats[]
  demoMode?: boolean
}) {
  const [anchor, setAnchor] = useState(new Date())
  // Semana (cuadrícula de 7 columnas) o Lista (citas por día en orden). En móvil la
  // cuadrícula se apila en 7 tarjetas casi vacías, así que ahí se abre en lista.
  const [mode, setMode] = useState<'semana' | 'lista'>(() => window.matchMedia('(max-width: 639px)').matches ? 'lista' : 'semana')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const days = weekDays(anchor)
  const rangeKey = `${days[0].getTime()}`

  // `quiet`: recarga en segundo plano (un cambio en directo) sin el parpadeo de "cargando".
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    const start = days[0]
    const end = new Date(days[6]); end.setDate(end.getDate() + 1)
    if (demoMode) {
      const inRange = DEMO_APPOINTMENTS.filter(a => {
        const t = new Date(a.startAt).getTime()
        return t >= start.getTime() && t < end.getTime()
      }).sort((a, b) => a.startAt.localeCompare(b.startAt))
      setAppointments(inRange)
      setLoading(false)
      return
    }
    const { data } = await supabase.from('appointments').select('*')
      .eq('nutricionista_id', nutricionistaId)
      .gte('start_at', start.toISOString()).lt('start_at', end.toISOString())
      .order('start_at')
    setAppointments((data || []).map(appointmentFromRow))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nutricionistaId, rangeKey, demoMode])

  useEffect(() => { load() }, [load])

  // Una cita nueva (p. ej. un cliente que la pide) aparece sola, sin cerrar y abrir la app.
  useRealtimeRefresh('appointments', `nutricionista_id=eq.${nutricionistaId}`, () => load(true), !demoMode)

  const saveAppointment = async () => {
    if (!form.title.trim()) { toast('Ponle un título a la cita', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setShowForm(false); setForm(EMPTY_FORM); return }
    setSaving(true)
    const [h, m] = form.time.split(':').map(Number)
    const baseDate = new Date(form.date + 'T00:00:00')
    const occurrences = form.recurring ? Math.max(1, parseInt(form.recurringWeeks) || 1) : 1
    const rows = Array.from({ length: occurrences }, (_, i) => {
      const start = new Date(baseDate)
      start.setDate(start.getDate() + i * 7)
      start.setHours(h, m, 0, 0)
      const end = new Date(start.getTime() + (parseInt(form.durationMin) || 30) * 60000)
      return {
        nutricionista_id: nutricionistaId,
        client_id: form.clientId || null,
        title: form.title.trim(),
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: 'confirmada' as const,
        notes: '',
        recurring: form.recurring ? ('weekly' as const) : null,
        video_link: form.videoLink.trim() || null,
      }
    })
    const { error } = await supabase.from('appointments').insert(rows)
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast(occurrences > 1 ? `${occurrences} citas creadas ✓` : 'Cita creada ✓', 'ok')
    if (form.clientId) {
      sendPush({ clientId: form.clientId }, 'Nueva cita confirmada 📅',
        `${form.title} — ${new Date(form.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} a las ${form.time}`)
    }
    setShowForm(false)
    setForm(EMPTY_FORM)
    await load()
  }

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    await supabase.from('appointments').update({ status }).eq('id', id)
    await load()
  }

  const deleteAppointment = async (id: string) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    await supabase.from('appointments').delete().eq('id', id)
    await load()
  }

  const pendingCount = appointments.filter(a => a.status === 'pendiente').length
  const isCurrentWeek = days[0].getTime() === startOfWeek(new Date()).getTime()
  const clientName = (id: string | null) => id ? (clients.find(c => c.id === id)?.name || 'Cliente') : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })}
            aria-label="Semana anterior" className="p-2 rounded-lg hover:bg-bg-alt text-muted"><ChevronLeft className="w-4 h-4" /></button>
          <p className="text-sm font-semibold whitespace-nowrap">
            {days[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – {days[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </p>
          <button onClick={() => setAnchor(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}
            aria-label="Semana siguiente" className="p-2 rounded-lg hover:bg-bg-alt text-muted"><ChevronRight className="w-4 h-4" /></button>
          {!isCurrentWeek && (
            <button onClick={() => setAnchor(new Date())} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-accent hover:bg-accent/10">Hoy</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Vista del calendario" className="flex bg-bg-alt rounded-lg p-0.5">
            {([['semana', 'Semana', CalendarDays], ['lista', 'Lista', List]] as const).map(([id, label, Icon]) => (
              <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  mode === id ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Nueva cita</Button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="bg-warn/10 border border-warn/20 rounded-xl px-4 py-2.5 text-sm text-warn font-medium">
          {pendingCount} {pendingCount === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} de confirmar
        </div>
      )}

      {loading ? <p className="text-muted text-sm">Cargando...</p> : mode === 'semana' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map(day => {
            const dayStr = toLocalISODate(day)
            const dayAppointments = appointments.filter(a => toLocalISODate(new Date(a.startAt)) === dayStr)
            return (
              <div key={dayStr} className="card p-3 space-y-2 min-h-[110px]">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  {day.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
                </p>
                {dayAppointments.map(a => (
                  <AppointmentCard key={a.id} a={a} clientName={clientName(a.clientId)} onStatus={updateStatus} onDelete={deleteAppointment} />
                ))}
              </div>
            )
          })}
        </div>
      ) : appointments.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">No hay citas esta semana.</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-sm font-semibold text-accent">Crear una cita</button>
        </div>
      ) : (
        <div className="space-y-5">
          {groupAppointmentsByDay(appointments).map(g => (
            <section key={g.day}>
              <h2 className="text-sm font-semibold capitalize mb-2">{dayHeading(g.day)}</h2>
              <div className="space-y-2">
                {g.appointments.map(a => (
                  <AppointmentCard key={a.id} a={a} clientName={clientName(a.clientId)} onStatus={updateStatus} onDelete={deleteAppointment} row />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva cita">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Título</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Consulta de seguimiento"
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Cliente</label>
            <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm">
              <option value="">Sin cliente (bloqueo de agenda)</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.surname}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Fecha</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Hora</label>
              <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Duración (min)</label>
              <input type="number" value={form.durationMin} onChange={e => setForm({ ...form, durationMin: e.target.value })}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Enlace de videollamada (opcional)</label>
            <input value={form.videoLink} onChange={e => setForm({ ...form, videoLink: e.target.value })} placeholder="https://meet.google.com/..."
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.checked })} />
            Repetir cada semana
          </label>
          {form.recurring && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Número de semanas</label>
              <input type="number" value={form.recurringWeeks} onChange={e => setForm({ ...form, recurringWeeks: e.target.value })}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
          )}
          <Button onClick={saveAppointment} loading={saving} className="w-full">Crear cita</Button>
        </div>
      </Modal>
    </div>
  )
}

/** Una cita con su estado y acciones. `row` = versión de la lista (hora a la izquierda, tarjeta a todo el ancho). */
function AppointmentCard({ a, clientName, onStatus, onDelete, row }: {
  a: Appointment; clientName: string | null; onStatus: (id: string, status: AppointmentStatus) => void
  onDelete: (id: string) => void; row?: boolean
}) {
  const time = new Date(a.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const actions = (
    <div className="flex items-center gap-1">
      {a.status === 'pendiente' && (
        <button onClick={() => onStatus(a.id, 'confirmada')} className="p-1 text-ok hover:bg-ok/10 rounded" title="Confirmar" aria-label="Confirmar"><Check className="w-3 h-3" /></button>
      )}
      {a.status !== 'cancelada' && a.status !== 'completada' && (
        <button onClick={() => onStatus(a.id, 'cancelada')} className="p-1 text-warn hover:bg-warn/10 rounded" title="Cancelar" aria-label="Cancelar"><X className="w-3 h-3" /></button>
      )}
      <button onClick={() => onDelete(a.id)} className="p-1 text-muted hover:text-warn rounded ml-auto" title="Eliminar" aria-label="Eliminar"><Trash2 className="w-3 h-3" /></button>
    </div>
  )
  const video = a.videoLink && (
    <a href={a.videoLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
      <Video className="w-3 h-3" /> Videollamada
    </a>
  )

  if (row) {
    return (
      <div className="card p-3 flex items-start gap-3">
        <p className="font-serif font-bold text-lg leading-tight w-14 flex-shrink-0">{time}</p>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold">{a.title}</p>
          {clientName && <p className="text-xs text-muted">{clientName}</p>}
          <p className={`text-xs font-semibold ${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</p>
          {video}
        </div>
        <div className="flex-shrink-0">{actions}</div>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg p-2 space-y-1">
      <p className="text-xs font-semibold">{time} · {a.title}</p>
      {clientName && <p className="text-xs text-muted">{clientName}</p>}
      <p className={`text-xs font-semibold ${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</p>
      {video}
      {actions}
    </div>
  )
}
