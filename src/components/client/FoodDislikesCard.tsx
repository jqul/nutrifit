import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { MAX_DISLIKES_LENGTH, parseDislikes } from '../../lib/foodDislikes'
import { toast } from '../shared/Toast'

/**
 * «Lo que no me gusta»: el cliente apunta alimentos que prefiere evitar (no son alergias: esas las pone su nutricionista).
 * Las sustituciones que le salen en su plan no los sugieren, y su nutricionista los ve al montarle el menú.
 */
export function FoodDislikesCard({ clientId, value, onSaved, demoMode, readOnly }: {
  clientId: string; value: string; onSaved: (text: string) => void; demoMode?: boolean; readOnly?: boolean
}) {
  const [text, setText] = useState(value)
  const [saving, setSaving] = useState(false)
  const dirty = text.trim() !== value.trim()
  const count = parseDislikes(text).length

  const save = async () => {
    if (demoMode) { onSaved(text.trim()); toast('Modo demo: no se guarda de verdad', 'ok'); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('set_my_food_dislikes', { p_client_id: clientId, p_text: text })
    setSaving(false)
    if (error) { toast('No se pudo guardar', 'warn'); return }
    onSaved(typeof data === 'string' ? data : text.trim())
    toast('Guardado ✓', 'ok')
  }

  return (
    <div className="card p-5 space-y-2">
      <p className="text-sm font-semibold">Lo que no me gusta</p>
      <p className="text-xs text-muted">Alimentos que prefieres evitar, separados por comas. No es lo mismo que una alergia: eso lo apunta tu nutricionista.</p>
      <textarea value={text} onChange={e => setText(e.target.value.slice(0, MAX_DISLIKES_LENGTH))} rows={2} readOnly={readOnly}
        placeholder="Pescado, coliflor, setas…" aria-label="Lo que no me gusta"
        className="w-full px-3 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 read-only:opacity-70" />
      {!readOnly && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{count === 0 ? 'Nada apuntado' : `${count} ${count === 1 ? 'alimento' : 'alimentos'}`}</span>
          <button onClick={save} disabled={!dirty || saving} className="px-4 py-2 bg-ink text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-40">Guardar</button>
        </div>
      )}
    </div>
  )
}
