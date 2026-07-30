import { useState } from 'react'
import { ClientData } from '../../../types'
import { Button } from '../../shared/Button'
import { toast } from '../../shared/Toast'

export function NotasTab({ client, onUpdate }: {
  client: ClientData
  onUpdate: (updates: Partial<ClientData>) => Promise<boolean>
}) {
  const [notes, setNotes] = useState(client.notes)
  const [saving, setSaving] = useState(false)
  const dirty = notes !== client.notes

  const handleSave = async () => {
    setSaving(true)
    const ok = await onUpdate({ notes })
    setSaving(false)
    if (ok) toast('Notas guardadas ✓', 'ok')
  }

  return (
    <div className="max-w-lg space-y-3">
      <p className="text-xs text-muted">Notas privadas — no visibles para el cliente.</p>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={10}
        placeholder="Historial clínico, preferencias alimentarias, observaciones de consulta..."
        className="w-full px-4 py-3 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm resize-none" />
      <Button onClick={handleSave} loading={saving} disabled={!dirty}>Guardar notas</Button>
    </div>
  )
}
