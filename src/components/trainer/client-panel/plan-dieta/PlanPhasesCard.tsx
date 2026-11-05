import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { planPhaseFromRow } from '../../../../lib/mappers'
import { DEMO_DIET_TEMPLATES, demoPlanPhases } from '../../../../lib/demo-data'
import { toLocalISODate } from '../../../../lib/date'
import {
  PlanPhase, formatRange, madridDay, nextPhaseDefaults, phaseReview, phaseStatus, sortPhases, summarizePhases, validatePhase,
} from '../../../../lib/planPhases'
import { toast } from '../../../shared/Toast'
import { Button } from '../../../shared/Button'
import { AlertTriangle, CalendarRange, Pencil, Plus, Trash2, X } from 'lucide-react'

interface Draft { id: string | null; name: string; description: string; startDate: string; endDate: string; templateId: string; autoApply: boolean }

/**
 * «Fases del plan»: la línea de tiempo del cliente (Definición → Mantenimiento…). El cliente ve en qué fase está; el
 * nutricionista recibe un aviso en el Centro de control cuando una termina. No cambia el plan por sí sola: la plantilla
 * de cada fase es una referencia para cargarla en el plan cuando toque.
 */
export function PlanPhasesCard({ clientId, nutricionistaId, demoMode }: { clientId: string; nutricionistaId: string; demoMode?: boolean }) {
  const today = toLocalISODate(new Date())
  const [phases, setPhases] = useState<PlanPhase[]>(() => demoMode ? demoPlanPhases(today).filter(p => p.clientId === clientId) : [])
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>(() => demoMode ? DEMO_DIET_TEMPLATES.map(t => ({ id: t.id, name: t.name })) : [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (demoMode) return
    const [{ data: rows }, { data: tpls }] = await Promise.all([
      supabase.from('plan_phases').select('*').eq('client_id', clientId).order('start_date'),
      supabase.from('diet_templates').select('id, name').eq('nutricionista_id', nutricionistaId).order('name'),
    ])
    setPhases((rows || []).map(planPhaseFromRow))
    setTemplates((tpls || []) as { id: string; name: string }[])
  }, [clientId, nutricionistaId, demoMode])
  useEffect(() => { load() }, [load])

  const sorted = useMemo(() => sortPhases(phases), [phases])
  const summary = useMemo(() => summarizePhases(phases, today), [phases, today])
  const review = useMemo(() => phaseReview(phases, today), [phases, today])
  const templateName = (id: string | null) => templates.find(t => t.id === id)?.name

  const openNew = () => setDraft({ id: null, name: '', description: '', templateId: '', autoApply: false, ...nextPhaseDefaults(phases, today) })
  const openEdit = (p: PlanPhase) => setDraft({ id: p.id, name: p.name, description: p.description, startDate: p.startDate, endDate: p.endDate, templateId: p.templateId ?? '', autoApply: p.autoApply === true })

  const save = async () => {
    if (!draft) return
    const errors = validatePhase(draft, phases.filter(p => p.id !== draft.id))
    if (errors.length > 0) { toast(errors[0], 'warn'); return }
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); setDraft(null); return }
    setSaving(true)
    const payload = {
      name: draft.name.trim(), description: draft.description.trim(), start_date: draft.startDate, end_date: draft.endDate,
      template_id: draft.templateId || null,
      auto_apply: !!draft.templateId && draft.autoApply,
      // Una fase que aún no ha empezado vuelve a quedar pendiente de aplicarse (si se cambió la plantilla o la fecha).
      ...(draft.startDate > today ? { applied_at: null, apply_error: null } : {}),
    }
    const { error } = draft.id
      ? await supabase.from('plan_phases').update(payload).eq('id', draft.id)
      : await supabase.from('plan_phases').insert({ ...payload, client_id: clientId, nutricionista_id: nutricionistaId })
    setSaving(false)
    if (error) { toast('Error: ' + error.message, 'warn'); return }
    toast(draft.id ? 'Fase actualizada ✓' : `Fase «${payload.name}» añadida ✓`, 'ok')
    setDraft(null)
    await load()
  }

  const remove = async (p: PlanPhase) => {
    if (demoMode) { toast('Modo demo: los cambios no se guardan', 'ok'); return }
    setPhases(prev => prev.filter(x => x.id !== p.id))
    const { error } = await supabase.from('plan_phases').delete().eq('id', p.id)
    if (error) { toast('Error: ' + error.message, 'warn'); await load(); return }
    toast('Fase eliminada', 'ok')
  }

  const input = 'w-full px-2.5 py-1.5 bg-bg border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20'

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm flex items-center gap-2"><CalendarRange className="w-4 h-4 text-muted" /> Fases del plan</p>
        {!draft && <button onClick={openNew} className="flex items-center gap-1 text-xs font-bold text-accent"><Plus className="w-3.5 h-3.5" /> Añadir fase</button>}
      </div>

      {review && (
        <div className="flex items-start gap-2 rounded-xl bg-warn/10 text-warn px-3 py-2 text-xs font-medium" role="status">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{review.text} Revisa el plan.</span>
        </div>
      )}

      {sorted.length === 0 && !draft && (
        <p className="text-xs text-muted">
          Divide el proceso de este cliente en fases (por ejemplo «Definición» 4 semanas y «Mantenimiento» 2). Él verá en cuál está y tú
          recibirás un aviso cuando una vaya a terminar, para ajustar el plan a tiempo.
        </p>
      )}

      {sorted.length > 0 && (
        <ol className="space-y-1.5">
          {sorted.map((p, i) => {
            const status = phaseStatus(p, today)
            const isCurrent = summary.current?.id === p.id
            return (
              <li key={p.id} className={`rounded-xl px-3 py-2 flex items-start justify-between gap-2 ${isCurrent ? 'bg-ok/10 border border-ok/30' : 'bg-bg-alt'} ${status === 'ended' ? 'opacity-60' : ''}`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    <span className="text-muted font-normal">{i + 1}. </span>{p.name}
                    {isCurrent && <span className="ml-2 text-xs font-bold text-ok">En curso · {summary.daysLeft === 1 ? 'último día' : `quedan ${summary.daysLeft} días`}</span>}
                    {status === 'upcoming' && <span className="ml-2 text-xs font-medium text-muted">Próxima</span>}
                    {status === 'ended' && <span className="ml-2 text-xs font-medium text-muted">Terminada</span>}
                  </p>
                  <p className="text-xs text-muted">{formatRange(p)}{templateName(p.templateId) ? ` · Plantilla: ${templateName(p.templateId)}` : ''}</p>
                  {p.autoApply && p.appliedAt && <p className="text-xs text-ok font-medium">Plantilla aplicada al plan el {madridDay(p.appliedAt).split('-').reverse().join('/')}</p>}
                  {p.autoApply && !p.appliedAt && !p.applyError && status !== 'ended' && <p className="text-xs text-muted">Se aplicará sola al plan el {p.startDate.split('-').reverse().join('/')}.</p>}
                  {p.applyError && !p.appliedAt && <p className="text-xs text-warn font-medium">No se pudo aplicar la plantilla: {p.applyError}</p>}
                  {p.description && <p className="text-xs text-muted mt-0.5 italic">“{p.description}”</p>}
                </div>
                <div className="flex items-center flex-shrink-0">
                  <button onClick={() => openEdit(p)} className="p-1.5 text-muted hover:text-accent" aria-label={`Editar la fase ${p.name}`}><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(p)} className="p-1.5 text-muted hover:text-warn" aria-label={`Eliminar la fase ${p.name}`}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {draft && (
        <div className="rounded-xl border border-border p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">{draft.id ? 'Editar fase' : 'Nueva fase'}</p>
            <button onClick={() => setDraft(null)} className="p-1 text-muted hover:text-warn" aria-label="Cerrar"><X className="w-4 h-4" /></button>
          </div>
          <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Nombre (Definición, Mantenimiento…)" maxLength={80} autoFocus className={input} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">Empieza
              <input type="date" value={draft.startDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} className={`${input} mt-1`} />
            </label>
            <label className="text-xs text-muted">Termina (incluido)
              <input type="date" value={draft.endDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })} className={`${input} mt-1`} />
            </label>
          </div>
          <label className="block text-xs text-muted">Qué se hace en esta fase (lo ve el cliente)
            <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={2} maxLength={500}
              placeholder="Déficit moderado y mucha proteína…" className={`${input} mt-1 resize-none`} />
          </label>
          {templates.length > 0 && (
            <label className="block text-xs text-muted">Plantilla de plan de esta fase (opcional)
              <select value={draft.templateId} onChange={e => setDraft({ ...draft, templateId: e.target.value, autoApply: e.target.value ? draft.autoApply : false })} className={`${input} mt-1`}>
                <option value="">Ninguna</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          {draft.templateId && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-accent" checked={draft.autoApply} onChange={e => setDraft({ ...draft, autoApply: e.target.checked })} />
              <span className="text-xs">
                <span className="font-semibold">Aplicar la plantilla sola cuando empiece la fase</span>
                <span className="block text-muted">Sustituye el plan actual del cliente por el de la plantilla (a las 6-7 de la mañana del día de inicio). El plan anterior queda en «Versiones del plan» y puedes restaurarlo; el cambio sale en el historial como «Cambio de fase».</span>
              </span>
            </label>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={save} loading={saving}>Guardar fase</Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
