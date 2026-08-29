import { useState } from 'react'
import { ClientData } from '../../types'
import { supabase } from '../../lib/supabase'
import { toLocalISODate } from '../../lib/date'
import { logError } from '../../lib/errors'
import { toast } from '../shared/Toast'
import { Button } from '../shared/Button'
import { GoalSelect } from '../shared/GoalSelect'
import { AnamnesisForm } from '../client/AnamnesisForm'
import { ClipboardList } from 'lucide-react'

/**
 * Primer arranque del modo personal: antes de soltar a alguien en su plan
 * vacío, se le pide lo mismo que un nutricionista pediría en la primera
 * consulta — edad, altura, peso actual, objetivo — más el cuestionario de
 * salud completo (AnamnesisForm, reutilizado tal cual). Se muestra
 * mientras el perfil siga sin altura (heightCm null es una señal fiable
 * de "todavía no ha pasado por aquí"); "Ahora no" la salta solo para esta
 * sesión del navegador (localStorage), sin marcar nada en la base de
 * datos — reaparecerá la próxima vez hasta que se rellene de verdad.
 */
export function PersonalOnboarding({ client, nutricionistaId, onUpdate, onDone }: {
  client: ClientData
  nutricionistaId: string
  onUpdate: (updates: Partial<ClientData>) => Promise<boolean>
  onDone: () => void
}) {
  const [birthDate, setBirthDate] = useState(client.birthDate || '')
  const [gender, setGender] = useState(client.gender || '')
  const [heightCm, setHeightCm] = useState(client.heightCm?.toString() || '')
  const [weightKg, setWeightKg] = useState('')
  const [goal, setGoal] = useState(client.goal || '')
  const [goalWeightKg, setGoalWeightKg] = useState(client.goalWeightKg?.toString() || '')
  const [allergies, setAllergies] = useState(client.allergies || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const updates: Partial<ClientData> = {
      birthDate: birthDate || null, gender: gender || null,
      heightCm: heightCm ? parseFloat(heightCm) : null,
      goal: goal || null, goalWeightKg: goalWeightKg ? parseFloat(goalWeightKg) : null,
      allergies,
    }
    const ok = await onUpdate(updates)
    if (!ok) { setSaving(false); return }

    const kg = parseFloat(weightKg)
    if (kg > 0) {
      const { error } = await supabase.from('weight_logs').upsert({
        client_id: client.id, date: toLocalISODate(new Date()), weight_kg: kg, note: '',
      }, { onConflict: 'client_id,date' })
      if (error) logError('PersonalOnboarding:weight', error)
    }

    setSaving(false)
    toast('Datos guardados ✓', 'ok')
    onDone()
  }

  const skip = () => {
    try { localStorage.setItem(`nutrifit-onboarding-skipped-${client.id}`, '1') } catch { /* localStorage puede fallar en privado */ }
    onDone()
  }

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-serif font-bold">Cuéntanos sobre ti</h1>
          <p className="text-sm text-muted">
            Con estos datos podemos calcular tus objetivos de calorías y macros, y llevar tu progreso desde ya.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Fecha de nacimiento</label>
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Género</label>
              <input value={gender} onChange={e => setGender(e.target.value)} placeholder="Ej. Mujer, Hombre..."
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Altura (cm)</label>
              <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Peso actual (kg)</label>
              <input type="number" step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)}
                className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
            </div>
          </div>
          <GoalSelect value={goal} onChange={setGoal} surface="card" />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Peso objetivo (kg)</label>
            <input type="number" step="0.1" value={goalWeightKg} onChange={e => setGoalWeightKg(e.target.value)}
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Alergias / intolerancias</label>
            <textarea value={allergies} onChange={e => setAllergies(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm resize-none" />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Cuestionario de salud
          </p>
          <AnamnesisForm clientId={client.id} nutricionistaId={nutricionistaId} personalMode openByDefault />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} loading={saving}>Guardar y continuar</Button>
          <Button variant="ghost" onClick={skip}>Ahora no</Button>
        </div>
      </div>
    </div>
  )
}
