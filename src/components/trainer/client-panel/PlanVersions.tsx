import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { DEMO_PLAN_VERSIONS } from '../../../lib/demo-data'
import { PlanVersionRow, describeRestore, mealLabel, summarizeSnapshot } from '../../../lib/planVersions'
import { Modal } from '../../shared/Modal'
import { Button } from '../../shared/Button'
import { toast } from '../../shared/Toast'

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Versiones del plan: cada guardado deja una instantánea completa y se puede
 * volver a una anterior. Restaurar no borra nada: guarda antes el plan actual
 * como versión y deja la restauración como versión nueva. Es interno del
 * nutricionista; el cliente solo ve el plan vigente.
 */
export function PlanVersions({ planId, demoMode, refreshKey, onRestored }: {
  planId: string; demoMode?: boolean
  /** Cambia cuando se guarda el plan, para volver a leer las versiones. */
  refreshKey: number
  /** Se llama tras restaurar de verdad, para recargar el plan en el editor. */
  onRestored: () => void | Promise<void>
}) {
  const [versions, setVersions] = useState<PlanVersionRow[]>(demoMode ? Object.values(DEMO_PLAN_VERSIONS)[0] ?? [] : [])
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<PlanVersionRow | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (demoMode) { setVersions(Object.values(DEMO_PLAN_VERSIONS)[0] ?? []); return }
    let cancelled = false
    supabase.from('diet_plan_versions').select('*').eq('plan_id', planId).order('version_number', { ascending: false })
      .then(({ data }) => { if (!cancelled) setVersions((data || []) as PlanVersionRow[]) })
    return () => { cancelled = true }
  }, [planId, demoMode, refreshKey])

  if (versions.length === 0) return null
  const current = versions[0]

  const restore = async () => {
    if (!restoring) return
    if (demoMode) { toast('Modo demo: no se restaura de verdad', 'ok'); setRestoring(null); return }
    setBusy(true)
    const { error } = await supabase.rpc('restore_plan_version', { p_version_id: restoring.id })
    setBusy(false)
    if (error) { toast('No se pudo restaurar la versión', 'warn'); return }
    toast(`Versión ${restoring.version_number} restaurada ✓`, 'ok')
    setRestoring(null)
    await onRestored()
  }

  const changes = restoring ? describeRestore(current.snapshot, restoring.snapshot) : []

  return (
    <div className="card">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="font-semibold text-sm">Versiones del plan <span className="font-normal text-muted">({versions.length})</span></span>
        {open ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>

      {open && (
        <ol className="px-5 pb-5 space-y-3 border-t border-border/60 pt-4">
          {versions.map(v => {
            const s = summarizeSnapshot(v.snapshot)
            const isCurrent = v.id === current.id
            const isOpen = expanded === v.id
            return (
              <li key={v.id} className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      Versión {v.version_number}
                      {isCurrent && <span className="ml-2 text-xs font-semibold text-ok">Actual</span>}
                      {v.restored_from != null && <span className="ml-2 text-xs font-normal text-muted">restaurada de la {v.restored_from}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {fmtDate(v.created_at)} · {s.kcal} kcal · {s.proteinG} P · {s.carbsG} C · {s.fatG} G · {s.meals} comida{s.meals === 1 ? '' : 's'}
                    </p>
                    {v.note && <p className="text-xs text-muted italic">«{v.note}»</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => setExpanded(isOpen ? null : v.id)} aria-expanded={isOpen}
                      className="text-xs font-semibold text-muted hover:text-ink">{isOpen ? 'Ocultar' : 'Ver'}</button>
                    {!isCurrent && (
                      <button onClick={() => setRestoring(v)} className="text-xs font-semibold text-accent hover:underline">Restaurar</button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="bg-bg-alt/60 rounded-xl p-3 text-xs space-y-2">
                    {v.snapshot.advice && <p><span className="font-semibold">Consejo:</span> {v.snapshot.advice}</p>}
                    {v.snapshot.meals.map((m, i) => (
                      <div key={i}>
                        <p className="font-semibold">{mealLabel(m)}{m.time ? ` · ${m.time}` : ''}{m.kcal_target != null ? ` · ${m.kcal_target} kcal` : ''}</p>
                        {m.items.length > 0 && <p className="text-muted">{m.items.map(it => `${it.food_name}${it.quantity ? ` (${it.quantity}${it.unit})` : ''}`).join(', ')}</p>}
                      </div>
                    ))}
                    {v.snapshot.supplements.length > 0 && (
                      <p><span className="font-semibold">Suplementos:</span> {v.snapshot.supplements.map(x => x.name).join(', ')}</p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <Modal open={!!restoring} onClose={() => !busy && setRestoring(null)} title={restoring ? `Restaurar la versión ${restoring.version_number}` : ''}>
        {restoring && (
          <div className="space-y-4">
            <p className="text-sm text-muted leading-relaxed">
              El plan volverá a ser el de la versión {restoring.version_number} ({fmtDate(restoring.created_at)}). <strong className="text-ink">No se borra nada</strong>:
              tu plan actual queda guardado como versión y la restauración se añade como una versión nueva.
            </p>
            <div>
              <p className="text-sm font-semibold mb-1.5">Qué cambia frente al plan actual</p>
              {changes.length === 0
                ? <p className="text-sm text-muted">Nada: es idéntica al plan actual.</p>
                : <ul className="text-sm space-y-1 list-disc pl-5">{changes.map((c, i) => <li key={i}>{c}</li>)}</ul>}
            </div>
            <p className="text-xs text-muted">
              El cliente verá el plan restaurado desde que confirmes, pero no se le avisa automáticamente. Los cambios sin guardar que tengas ahora en el editor se perderán.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button onClick={restore} loading={busy}>Restaurar versión {restoring.version_number}</Button>
              <Button variant="ghost" onClick={() => setRestoring(null)} disabled={busy}>Cancelar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
