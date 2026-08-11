import { useState, useEffect } from 'react'
import { ClientData } from '../../../types'
import { goalLabel } from '../../../lib/constants'
import { ANAMNESIS_QUESTIONS } from '../../../lib/anamnesis'
import { supabase } from '../../../lib/supabase'
import { printInvoice } from '../../../lib/printInvoice'
import { InvoiceRow } from '../../../lib/supabase-types'
import { invoiceFromRow } from '../../../lib/mappers'
import { Button } from '../../shared/Button'
import { Modal } from '../../shared/Modal'
import { GoalSelect } from '../../shared/GoalSelect'
import { toast } from '../../shared/Toast'
import { exportClientData } from '../../../lib/gdprExport'
import { Copy, RefreshCw, Download, Trash2, ClipboardList, Receipt } from 'lucide-react'

export function PerfilTab({ client, onUpdate, onRegenerateToken, onDelete, demoMode, nutricionistaName }: {
  client: ClientData
  onUpdate: (updates: Partial<ClientData>) => Promise<boolean>
  onRegenerateToken: () => Promise<string | null>
  onDelete: () => Promise<void>
  demoMode?: boolean
  nutricionistaName?: string
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(client)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [anamnesisAnswers, setAnamnesisAnswers] = useState<Record<string, string> | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [generatingInvoice, setGeneratingInvoice] = useState(false)

  const loadInvoices = () => {
    if (demoMode) return
    supabase.from('invoices').select('*').eq('client_id', client.id).order('period', { ascending: false })
      .then(({ data }) => setInvoices(data || []))
  }

  useEffect(() => {
    if (demoMode) return
    supabase.from('anamnesis').select('*').eq('client_id', client.id).maybeSingle()
      .then(({ data }) => setAnamnesisAnswers(data?.completed_at ? data.answers || {} : null))
    loadInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id, demoMode])

  const currentPeriod = new Date().toISOString().slice(0, 7)
  const hasCurrentInvoice = invoices.some(i => i.period === currentPeriod)

  const handleGenerateInvoice = async () => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    if (client.monthlyPrice == null) { toast('Ponle un precio mensual a este cliente primero', 'warn'); return }
    setGeneratingInvoice(true)
    const { error } = await supabase.from('invoices').insert({
      nutricionista_id: client.nutricionistaId, client_id: client.id,
      period: currentPeriod, amount: client.monthlyPrice, status: 'pendiente',
    })
    setGeneratingInvoice(false)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast('Factura generada ✓', 'ok')
    loadInvoices()
  }

  const toggleInvoiceStatus = async (invoice: InvoiceRow) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    const next = invoice.status === 'pagado' ? 'pendiente' : 'pagado'
    setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, status: next } : i))
    await supabase.from('invoices').update({ status: next }).eq('id', invoice.id)
  }

  const handleExport = async () => {
    if (demoMode) { toast('No disponible en modo demo', 'warn'); return }
    setExporting(true)
    try {
      await exportClientData(client)
      toast('Datos exportados ✓', 'ok')
    } catch {
      toast('Error al exportar los datos', 'warn')
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete()
    setDeleting(false)
    setConfirmDeleteOpen(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const ok = await onUpdate({
      name: form.name, surname: form.surname, phone: form.phone, email: form.email,
      goal: form.goal, heightCm: form.heightCm, gender: form.gender, birthDate: form.birthDate,
      allergies: form.allergies, monthlyPrice: form.monthlyPrice, goalWeightKg: form.goalWeightKg,
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
        <Field label="Objetivo" value={goalLabel(client.goal)} />
        <Field label="Altura" value={client.heightCm ? `${client.heightCm} cm` : '—'} />
        <Field label="Género" value={client.gender || '—'} />
        <Field label="Fecha de nacimiento" value={client.birthDate || '—'} />
        <Field label="Alergias / intolerancias" value={client.allergies || '—'} />
        <Field label="Precio mensual" value={client.monthlyPrice != null ? `${client.monthlyPrice}€` : '—'} />
        <Field label="Peso objetivo" value={client.goalWeightKg != null ? `${client.goalWeightKg} kg` : '—'} />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => { setForm(client); setEditing(true) }}>Editar</Button>
        <Button variant="outline" onClick={copyLink}><Copy className="w-3.5 h-3.5" /> Copiar enlace</Button>
        <Button variant="outline" onClick={onRegenerateToken}><RefreshCw className="w-3.5 h-3.5" /> Regenerar enlace</Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Cuestionario de salud</p>
        {anamnesisAnswers ? (
          <div className="space-y-2.5">
            {ANAMNESIS_QUESTIONS.map(q => anamnesisAnswers[q.key] ? (
              <div key={q.key}>
                <p className="text-xs text-muted">{q.label}</p>
                <p className="text-sm mt-0.5">{anamnesisAnswers[q.key]}</p>
              </div>
            ) : null)}
          </div>
        ) : (
          <p className="text-sm text-muted">El cliente todavía no ha completado el cuestionario.</p>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Facturación</p>
          <Button variant="outline" onClick={handleGenerateInvoice} loading={generatingInvoice} disabled={hasCurrentInvoice}>
            {hasCurrentInvoice ? 'Ya generada este mes' : 'Generar factura de este mes'}
          </Button>
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay facturas para este cliente.</p>
        ) : (
          <div className="divide-y divide-border">
            {invoices.map(inv => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span>{new Date(inv.period + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                <span className="font-semibold">{inv.amount}€</span>
                <button onClick={() => toggleInvoiceStatus(inv)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                    inv.status === 'pagado' ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'
                  }`}>
                  {inv.status}
                </button>
                <button onClick={() => printInvoice(client, invoiceFromRow(inv), nutricionistaName || 'Tu nutricionista')}
                  className="text-muted hover:text-accent" title="Descargar PDF">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Datos del cliente (RGPD)</p>
        <p className="text-xs text-muted">Descarga toda la información guardada de este cliente, o elimínala por completo si te lo solicita.</p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExport} loading={exporting}><Download className="w-3.5 h-3.5" /> Exportar datos</Button>
          <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}><Trash2 className="w-3.5 h-3.5" /> Eliminar cliente y sus datos</Button>
        </div>
      </div>

      <Modal open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title="Eliminar cliente">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            ¿Eliminar a <strong className="text-ink">{client.name} {client.surname}</strong> y todos sus datos
            (plan de dieta, peso, fotos, check-ins)? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Sí, eliminar</Button>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
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
      <GoalSelect value={form.goal || ''} onChange={goal => setForm({ ...form, goal: goal || null })} surface="card" />
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
      <div className="grid grid-cols-2 gap-3">
        <Input label="Precio mensual (€)" type="number" value={form.monthlyPrice?.toString() || ''} onChange={v => setForm({ ...form, monthlyPrice: v ? parseFloat(v) : null })} />
        <Input label="Peso objetivo (kg)" type="number" value={form.goalWeightKg?.toString() || ''} onChange={v => setForm({ ...form, goalWeightKg: v ? parseFloat(v) : null })} />
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
