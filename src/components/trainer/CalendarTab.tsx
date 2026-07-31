import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { appointmentFromRow } from '../../lib/mappers'
import { Appointment, AppointmentStatus } from '../../types'
import { toLocalISODate } from '../../lib/date'
import { ClientWithStats } from '../../hooks/useNutricionistaClients'
import { sendPush } from '../../lib/usePushNotifications'
import { Button } from '../shared/Button'
import { Modal } from '../shared/Modal'
import { toast } from '../shared/Toast'
import { ChevronLeft, ChevronRight, Plus, Check, X, Trash2 } from 'lucide-react'

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

const EMPTY_FORM = { title: '', clientId: '', date: toLocalISODate(new Date()), time: '10:00', durationMin: '30', recurring: false, recurringWeeks: '4' }

export function CalendarTab({ nutricionistaId, clients, demoMode }: {
  nutricionistaId: string
  clients: ClientWithStats[]
  demoMode?: boolean
}) {
  const [anchor, setAnchor] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const days = weekDays(anchor)
  const rangeKey = `${days[0].getTime()}`

  const load = useCallback(async () => {
    setLoading(true)
    const start = days[0]
    const end = new Date(days[6]); end.setDate(end.getDate() + 1)
    const { data } = await supabase.from('appointments').select('*')
      .eq('nutricionista_id', nutricionistaId)
      .gte('start_at', start.toISOString()).lt('start_at', end.toISOString())
      .order('start_at')
    setAppointments((data || []).map(appointmentFromRow))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nutricionistaId, rangeKey])

  useEffect(() => { load() }, [load])

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setAnchor(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })}
            className="p-2 rounded-lg hover:bg-bg-alt text-muted"><ChevronLeft className="w-4 h-4" /></button>
          <p className="text-sm font-semibold whitespace-nowrap">
            {days[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – {days[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </p>
          <button onClick={() => setAnchor(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })}
            className="p-2 rounded-lg hover:bg-bg-alt text-muted"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Nueva cita</Button>
      </div>

      {pendingCount > 0 && (
        <div className="bg-warn/10 border border-warn/20 rounded-xl px-4 py-2.5 text-sm text-warn font-medium">
          {pendingCount} {pendingCount === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'} de confirmar
        </div>
      )}

      {loading ? <p className="text-muted text-sm">Cargando...</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map(day => {
            const dayStr = toLocalISODate(day)
            const dayAppointments = appointments.filter(a => toLocalISODate(new Date(a.startAt)) === dayStr)
            return (
              <div key={dayStr} className="bg-card border border-border rounded-2xl p-3 space-y-2 min-h-[110px]">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  {day.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
                </p>
                {dayAppointments.map(a => (
                  <div key={a.id} className="border border-border rounded-lg p-2 space-y-1">
                    <p className="text-xs font-semibold">
                      {new Date(a.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {a.title}
                    </p>
                    {a.clientId && <p className="text-[10px] text-muted">{clients.find(c => c.id === a.clientId)?.name || 'Cliente'}</p>}
                    <p className={`text-[10px] font-semibold ${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</p>
                    <div className="flex items-center gap-1">
                      {a.status === 'pendiente' && (
                        <button onClick={() => updateStatus(a.id, 'confirmada')} className="p-1 text-ok hover:bg-ok/10 rounded" title="Confirmar"><Check className="w-3 h-3" /></button>
                      )}
                      {a.status !== 'cancelada' && a.status !== 'completada' && (
                        <button onClick={() => updateStatus(a.id, 'cancelada')} className="p-1 text-warn hover:bg-warn/10 rounded" title="Cancelar"><X className="w-3 h-3" /></button>
                      )}
                      <button onClick={() => deleteAppointment(a.id)} className="p-1 text-muted hover:text-warn rounded ml-auto" title="Eliminar"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
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
