import { useState } from 'react'
import { ClientData } from '../../../types'
import { GOAL_LABELS, GOAL_OPTIONS } from '../../../lib/constants'
import { Button } from '../../shared/Button'
import { toast } from '../../shared/Toast'
import { Copy, RefreshCw } from 'lucide-react'

export function PerfilTab({ client, onUpdate, onRegenerateToken }: {
  client: ClientData
  onUpdate: (updates: Partial<ClientData>) => Promise<boolean>
  onRegenerateToken: () => Promise<string | null>
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(client)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const ok = await onUpdate({
      name: form.name, surname: form.surname, phone: form.phone, email: form.email,
      goal: form.goal, heightCm: form.heightCm, gender: form.gender, birthDate: form.birthDate,
      allergies: form.allergies,
    })
    setSaving(false)
    if (ok) { setEditing(false); toast('Perfil actualizado ✓', 'ok') }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/?c=${client.token}`)
    toast('Enlace copiado ✓', 'ok')
  }

  if (!editing) return (
    <div className="space-y-6 max-w-lg">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <Field label="Nombre" value={`${client.name} ${client.surname}`} />
        <Field label="Teléfono" value={client.phone || '—'} />
        <Field label="Email" value={client.email || '—'} />
        <Field label="Objetivo" value={client.goal ? GOAL_LABELS[client.goal] : '—'} />
        <Field label="Altura" value={client.heightCm ? `${client.heightCm} cm` : '—'} />
        <Field label="Género" value={client.gender || '—'} />
        <Field label="Fecha de nacimiento" value={client.birthDate || '—'} />
        <Field label="Alergias / intolerancias" value={client.allergies || '—'} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => { setForm(client); setEditing(true) }}>Editar</Button>
        <Button variant="outline" onClick={copyLink}><Copy className="w-3.5 h-3.5" /> Copiar enlace</Button>
        <Button variant="outline" onClick={onRegenerateToken}><RefreshCw className="w-3.5 h-3.5" /> Regenerar enlace</Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nombre" value={form.name} onChange={v => setForm({ ...form, name: v })} />
        <Input label="Apellidos" value={form.surname} onChange={v => setForm({ ...form, surname: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Teléfono" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
        <Input label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Objetivo</label>
        <select value={form.goal || ''} onChange={e => setForm({ ...form, goal: (e.target.value || null) as ClientData['goal'] })}
          className="w-full px-3 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm">
          <option value="">Sin especificar</option>
          {GOAL_OPTIONS.map(g => <option key={g} value={g}>{GOAL_LABELS[g]}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Altura (cm)" type="number" value={form.heightCm?.toString() || ''} onChange={v => setForm({ ...form, heightCm: v ? parseFloat(v) : null })} />
        <Input label="Género" value={form.gender || ''} onChange={v => setForm({ ...form, gender: v })} />
        <Input label="Nacimiento" type="date" value={form.birthDate || ''} onChange={v => setForm({ ...form, birthDate: v })} />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Alergias / intolerancias</label>
        <textarea value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} rows={2}
          className="w-full px-3 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm resize-none" />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} loading={saving}>Guardar</Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
    </div>
  )
}
