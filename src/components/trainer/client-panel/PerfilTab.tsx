import { useState, useEffect, ReactNode } from 'react'
import { ClientData, CustomAnamnesisQuestion, WeightEntry } from '../../../types'
import { goalLabel } from '../../../lib/constants'
import { ANAMNESIS_QUESTIONS } from '../../../lib/anamnesis'
import { supabase } from '../../../lib/supabase'
import { printInvoice } from '../../../lib/printInvoice'
import { InvoiceRow } from '../../../lib/supabase-types'
import { invoiceFromRow, weightFromRow } from '../../../lib/mappers'
import { calcBmi, bmiCategory } from '../../../lib/bmi'
import { computeWeightProgress } from '../../../lib/weightProgress'
import { Button } from '../../shared/Button'
import { Modal } from '../../shared/Modal'
import { GoalSelect } from '../../shared/GoalSelect'
import { toast } from '../../shared/Toast'
import { QuestionAnswerDisplay } from '../../shared/QuestionAnswerDisplay'
import { exportClientData } from '../../../lib/gdprExport'
import { DEMO_WEIGHTS, DEMO_ANAMNESIS, DEMO_INVOICES } from '../../../lib/demo-data'
import { Copy, RefreshCw, Download, Trash2, ClipboardList, Receipt, Tag, X, AlertTriangle, Scale, Ruler, ShieldCheck } from 'lucide-react'

const BMI_CATEGORY_CLASS: Record<string, string> = {
  'bajo peso': 'text-notice', normal: 'text-ok', sobrepeso: 'text-notice', obesidad: 'text-warn',
}

export function PerfilTab({ client, onUpdate, onRegenerateToken, onDelete, demoMode, nutricionistaName, customQuestions, hasConsentDocument }: {
  client: ClientData
  onUpdate: (updates: Partial<ClientData>) => Promise<boolean>
  onRegenerateToken: () => Promise<string | null>
  onDelete: () => Promise<void>
  demoMode?: boolean
  nutricionistaName?: string
  customQuestions?: CustomAnamnesisQuestion[]
  hasConsentDocument?: boolean
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
  // Historial completo de peso (no solo el último) — hace falta el primer
  // registro para poder mostrar "peso inicial → meta" en la tarjeta de
  // Composición Corporal, con la misma cuenta que usa WeightImpactCard del
  // lado cliente (computeWeightProgress).
  const [weights, setWeights] = useState<WeightEntry[]>([])

  const loadInvoices = () => {
    if (demoMode) return
    supabase.from('invoices').select('*').eq('client_id', client.id).order('period', { ascending: false })
      .then(({ data }) => setInvoices(data || []))
  }

  useEffect(() => {
    if (demoMode) {
      setWeights(DEMO_WEIGHTS[client.id] || [])
      setAnamnesisAnswers(DEMO_ANAMNESIS[client.id] || null)
      setInvoices(DEMO_INVOICES[client.id] || [])
      return
    }
    supabase.from('anamnesis').select('*').eq('client_id', client.id).maybeSingle()
      .then(({ data }) => setAnamnesisAnswers(data?.completed_at ? data.answers || {} : null))
    supabase.from('weight_logs').select('*').eq('client_id', client.id).order('date', { ascending: true })
      .then(({ data }) => setWeights((data || []).map(weightFromRow)))
    loadInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id, demoMode])

  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const initialWeight = sortedWeights.length ? sortedWeights[0].weightKg : null
  const currentWeight = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].weightKg : null
  const weightProgress = initialWeight != null && currentWeight != null
    ? computeWeightProgress(initialWeight, currentWeight, client.goalWeightKg) : null
  const bmi = currentWeight != null && client.heightCm ? calcBmi(currentWeight, client.heightCm) : null
  const bmiCat = bmi != null ? bmiCategory(bmi) : null

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
      tags: form.tags,
    })
    setSaving(false)
    if (ok) { setEditing(false); toast('Perfil actualizado ✓', 'ok') }
  }

  const [tagDraft, setTagDraft] = useState('')
  const addTag = () => {
    const t = tagDraft.trim()
    if (!t || form.tags.includes(t)) { setTagDraft(''); return }
    setForm({ ...form, tags: [...form.tags, t] })
    setTagDraft('')
  }
  const removeTag = (t: string) => setForm({ ...form, tags: form.tags.filter(x => x !== t) })

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
        <Field label="Género" value={client.gender || '—'} />
        <Field label="Fecha de nacimiento" value={client.birthDate || '—'} />
        <Field label="Precio mensual" value={client.monthlyPrice != null ? `${client.monthlyPrice}€` : '—'} />
        <div>
          <p className="text-xs uppercase tracking-wider text-muted mb-1">Etiquetas</p>
          {client.tags.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {client.tags.map(t => (
                <span key={t} className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs font-medium">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => { setForm(client); setEditing(true) }}>Editar</Button>
        <Button variant="outline" onClick={copyLink}><Copy className="w-3.5 h-3.5" /> Copiar enlace</Button>
        <Button variant="outline" onClick={onRegenerateToken}><RefreshCw className="w-3.5 h-3.5" /> Regenerar enlace</Button>
      </div>

      {/* Solo se muestra si has subido un documento de consentimiento en
          Ajustes — para los que no usan esta función, no añade ruido. */}
      {hasConsentDocument && (
        client.consentAcceptedAt ? (
          <p className="text-xs text-ok flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
            Consentimiento firmado el {new Date(client.consentAcceptedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
            {client.consentSignedName ? ` por ${client.consentSignedName}` : ''}
          </p>
        ) : (
          <p className="text-xs text-warn flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
            Consentimiento todavía sin firmar
          </p>
        )
      )}

      {/* Composición Corporal: peso inicial → meta con barra de progreso,
          más IMC y altura como mini-métricas — sustituye a la lista plana
          de texto que había antes (Altura/Peso actual/Peso objetivo). */}
      {(currentWeight != null || client.heightCm != null) && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" /> Composición corporal</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {initialWeight != null && <MiniStat label="Peso inicial" value={`${initialWeight} kg`} />}
            {currentWeight != null && <MiniStat label="Peso actual" value={`${currentWeight} kg`} />}
            {client.goalWeightKg != null && <MiniStat label="Meta" value={`${client.goalWeightKg} kg`} />}
            {client.heightCm != null && <MiniStat label="Altura" value={`${client.heightCm} cm`} icon={<Ruler className="w-3 h-3" />} />}
            {bmi != null && bmiCat && (
              <MiniStat label="IMC" value={bmi.toFixed(1)} sublabel={bmiCat} valueClassName={BMI_CATEGORY_CLASS[bmiCat]} />
            )}
          </div>
          {weightProgress && client.goalWeightKg != null && weightProgress.progressPct != null && (
            <div>
              <div className="flex items-center justify-between text-xs text-muted mb-1">
                <span>{weightProgress.goalReached ? 'Meta alcanzada 🎉' : `A ${weightProgress.remainingKg!.toFixed(1)}kg de la meta`}</span>
                <span className="font-bold text-ink">{Math.round(weightProgress.progressPct)}%</span>
              </div>
              <div className="h-2 bg-bg-alt rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${weightProgress.progressPct}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {client.allergies && (
        <div className="bg-warn/10 border border-warn/20 rounded-2xl p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-warn mb-0.5">Alertas médicas</p>
            <p className="text-sm text-ink">{client.allergies}</p>
          </div>
        </div>
      )}

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
            {(customQuestions || []).map(q => anamnesisAnswers[q.id] ? (
              <div key={q.id}>
                <p className="text-xs text-muted mb-0.5">{q.label}</p>
                <QuestionAnswerDisplay question={q} value={anamnesisAnswers[q.id]} />
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
          <Button variant="outline" onClick={handleGenerateInvoice} loading={generatingInvoice} disabled={hasCurrentInvoice || client.monthlyPrice == null}>
            {hasCurrentInvoice ? 'Ya generada este mes' : 'Generar factura de este mes'}
          </Button>
        </div>
        {client.monthlyPrice == null && (
          <p className="text-xs text-warn">Ponle un precio mensual a este cliente (arriba, en "Editar") para poder generarle facturas.</p>
        )}
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
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Etiquetas</label>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.tags.map(t => (
              <span key={t} className="flex items-center gap-1 pl-2.5 pr-1 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium">
                {t}
                <button onClick={() => removeTag(t)} className="hover:text-warn"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={tagDraft} onChange={e => setTagDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder='Ej. "Pérdida de grasa - Nivel 1"'
            className="flex-1 px-3 py-2 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
          <button onClick={addTag} className="px-3 py-2 bg-bg-alt rounded-xl text-xs font-semibold text-muted hover:text-accent">Añadir</button>
        </div>
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

function MiniStat({ label, value, sublabel, valueClassName = '', icon }: {
  label: string; value: string; sublabel?: string; valueClassName?: string; icon?: ReactNode
}) {
  return (
    <div className="bg-bg-alt rounded-xl p-2.5 text-center">
      <p className={`text-sm font-bold flex items-center justify-center gap-1 ${valueClassName}`}>{icon}{value}</p>
      <p className="text-[9px] text-muted uppercase tracking-wider mt-0.5">{sublabel || label}</p>
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
