import { useState, useEffect } from 'react'
import { ClientData, FollowedPlan } from '../../types'
import { supabase } from '../../lib/supabase'
import { logError } from '../../lib/errors'
import { FOLLOWED_PLAN_LABELS } from '../../lib/constants'
import { CheckCircle2 } from 'lucide-react'

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const SCALE = [1, 2, 3, 4, 5]

export function HoyTab({ client }: { client: ClientData }) {
  const today = toLocalISODate(new Date())
  const [loading, setLoading] = useState(true)
  const [doneToday, setDoneToday] = useState(false)
  const [followedPlan, setFollowedPlan] = useState<FollowedPlan>('si')
  const [hunger, setHunger] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [mood, setMood] = useState(3)
  const [waterL, setWaterL] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
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
        }
        setLoading(false)
      })
  }, [client.id, today])

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('daily_checkins').upsert({
      client_id: client.id, date: today, followed_plan: followedPlan,
      hunger, energy, mood, water_l: waterL ? parseFloat(waterL) : null, notes,
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

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3.5 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50">
          {saving ? 'Guardando...' : doneToday ? 'Actualizar check-in' : 'Guardar check-in'}
        </button>
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
