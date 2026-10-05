import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { DietPlanChangeRow } from '../../../lib/supabase-types'
import { DEMO_PLAN_CHANGES } from '../../../lib/demo-data'
import { formatPlanChange } from '../../../lib/planChanges'

/**
 * Historial de cambios de los objetivos del plan: qué se cambió, de qué a qué,
 * cuándo y por qué. Lo registra la base de datos al guardar; aquí solo se lee.
 * Es interno del nutricionista: el cliente no lo ve.
 */
export function PlanHistory({ clientId, nutricionistaId, nutricionistaName, personalMode, demoMode, refreshKey }: {
  clientId: string; nutricionistaId: string; nutricionistaName?: string; personalMode?: boolean; demoMode?: boolean
  /** Cambia cuando se guarda el plan, para volver a leer el historial. */
  refreshKey: number
}) {
  const [rows, setRows] = useState<DietPlanChangeRow[]>(demoMode ? DEMO_PLAN_CHANGES[clientId] ?? [] : [])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (demoMode) { setRows(DEMO_PLAN_CHANGES[clientId] ?? []); return }
    let cancelled = false
    supabase.from('diet_plan_changes').select('*').eq('client_id', clientId).order('changed_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (!cancelled) setRows((data || []) as DietPlanChangeRow[]) })
    return () => { cancelled = true }
  }, [clientId, demoMode, refreshKey])

  if (rows.length === 0) return null

  const author = (by: string | null) => (by === nutricionistaId ? (personalMode ? 'Tú' : nutricionistaName ?? null) : null)

  return (
    <div className="card">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="font-semibold text-sm">Historial de cambios <span className="font-normal text-muted">({rows.length})</span></span>
        {open ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>
      {open && (
        <ol className="px-5 pb-5 space-y-4 border-t border-border/60 pt-4">
          {rows.map(r => {
            const who = author(r.changed_by)
            return (
              <li key={r.id} className="space-y-1">
                <p className="text-xs text-muted">
                  {new Date(r.changed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {who && ` · ${who}`}
                </p>
                <ul className="text-sm">
                  {r.changes.map((c, i) => <li key={i} className="font-medium">{formatPlanChange(c)}</li>)}
                </ul>
                {r.reason && <p className="text-sm text-muted italic">«{r.reason}»</p>}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
