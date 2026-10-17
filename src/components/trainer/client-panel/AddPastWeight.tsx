import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { toast } from '../../shared/Toast'
import { toLocalISODate } from '../../../lib/date'
import { parseWeightKg } from '../../../lib/weightInput'

/**
 * Para apuntar un pesaje de un día concreto (p. ej. el de la primera consulta, antes de empezar con NutriFit). Si el
 * cliente ya tiene un pesaje ese día se respeta el suyo. Para muchos de una vez: Clientes → Importar historial de peso.
 */
export function AddPastWeight({ clientId, demoMode, onAdded }: { clientId: string; demoMode?: boolean; onAdded: () => void }) {
  const today = toLocalISODate(new Date())
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  // El atajo "Registrar peso" de la cabecera de la ficha abre este formulario.
  useEffect(() => {
    const openForm = () => setOpen(true)
    window.addEventListener('nutrifit:add-weight', openForm)
    return () => window.removeEventListener('nutrifit:add-weight', openForm)
  }, [])

  const save = async () => {
    const w = parseWeightKg(text)
    if (w.status !== 'ok') { toast(w.status === 'empty' ? 'Escribe el peso' : 'El peso no es válido (entre 20 y 400 kg)', 'warn'); return }
    if (!date || date > today) { toast('Elige una fecha de hoy o anterior', 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setOpen(false); return }
    setSaving(true)
    const { data, error } = await supabase.from('weight_logs')
      .upsert({ client_id: clientId, date, weight_kg: w.kg, note: '' }, { onConflict: 'client_id,date', ignoreDuplicates: true }).select('id')
    setSaving(false)
    if (error) { toast('No se pudo guardar: ' + error.message, 'warn'); return }
    if (!data || data.length === 0) { toast('Ya hay un pesaje de ese día: se ha respetado el que estaba', 'warn'); return }
    toast('Pesaje añadido ✓', 'ok')
    setText(''); setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs font-bold text-accent">
        <Plus className="w-3.5 h-3.5" /> Añadir un pesaje con fecha
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-muted">Fecha
        <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
          className="block mt-1 px-3 py-2 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
      </label>
      <label className="text-xs text-muted">Peso (kg)
        <input type="text" inputMode="decimal" value={text} onChange={e => setText(e.target.value)} placeholder="72,5"
          className="block mt-1 w-28 px-3 py-2 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
      </label>
      <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-ink text-white rounded-xl text-sm font-semibold disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
      <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-muted">Cancelar</button>
    </div>
  )
}
