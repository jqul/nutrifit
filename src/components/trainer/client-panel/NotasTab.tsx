import { useState } from 'react'
import { Lock } from 'lucide-react'
import { ClientData } from '../../../types'
import { formatNotesEdited } from '../../../lib/notesMeta'
import { Button } from '../../shared/Button'
import { toast } from '../../shared/Toast'

export function NotasTab({ client, onUpdate }: {
  client: ClientData
  onUpdate: (updates: Partial<ClientData>) => Promise<boolean>
}) {
  const [notes, setNotes] = useState(client.notes)
  const [editedAt, setEditedAt] = useState(client.notesUpdatedAt ?? null)
  const [saving, setSaving] = useState(false)
  const dirty = notes !== client.notes

  const handleSave = async () => {
    setSaving(true)
    const ok = await onUpdate({ notes })
    setSaving(false)
    if (ok) { setEditedAt(Date.now()); toast('Notas guardadas ✓', 'ok') }
  }

  return (
    <div className="max-w-lg space-y-3">
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <Lock className="w-3.5 h-3.5 flex-shrink-0" /> Notas privadas: solo las ves tú, el cliente no tiene acceso a ellas.
      </p>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={10} aria-label="Notas privadas"
        placeholder="Historial clínico, preferencias alimentarias, observaciones de consulta..."
        className="w-full px-4 py-3 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm resize-none" />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button onClick={handleSave} loading={saving} disabled={!dirty}>Guardar notas</Button>
        <p className="text-xs text-muted">{formatNotesEdited(editedAt, notes.trim().length > 0)}</p>
      </div>
    </div>
  )
}
