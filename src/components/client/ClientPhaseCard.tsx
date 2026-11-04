import { useEffect, useMemo, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { planPhaseFromRow } from '../../lib/mappers'
import { demoPlanPhases } from '../../lib/demo-data'
import { toLocalISODate } from '../../lib/date'
import { PlanPhase, formatRange, summarizePhases } from '../../lib/planPhases'

/** «Tu fase»: en cuál de las fases de su plan está el cliente, cuánto le queda y qué se hace en ella. */
export function ClientPhaseCard({ clientId, demoMode }: { clientId: string; demoMode?: boolean }) {
  const today = toLocalISODate(new Date())
  const [phases, setPhases] = useState<PlanPhase[]>(() => demoMode ? demoPlanPhases(today).filter(p => p.clientId === clientId) : [])

  useEffect(() => {
    if (demoMode) return
    let cancelled = false
    supabase.from('plan_phases').select('*').eq('client_id', clientId).order('start_date')
      .then(({ data }) => { if (!cancelled) setPhases((data || []).map(planPhaseFromRow)) })
    return () => { cancelled = true }
  }, [clientId, demoMode])

  const s = useMemo(() => summarizePhases(phases, today), [phases, today])
  if (!s.current && !(s.next && s.daysToNext != null && s.daysToNext <= 14)) return null

  if (s.current) {
    const pct = Math.round(((phaseLength(s.current) - (s.daysLeft ?? 0) + 1) / phaseLength(s.current)) * 100)
    return (
      <div className="card p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5"><CalendarRange className="w-3.5 h-3.5" /> Tu fase · {s.position} de {s.total}</p>
        <p className="font-serif font-bold text-lg mt-1">{s.current.name}</p>
        <p className="text-xs text-muted">{formatRange(s.current)} · {s.daysLeft === 1 ? 'hoy es el último día' : `quedan ${s.daysLeft} días`}</p>
        <div className="h-1.5 bg-bg-alt rounded-full overflow-hidden mt-2.5" role="img" aria-label={`Fase al ${Math.min(100, pct)}%`}>
          <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        {s.current.description && <p className="text-sm mt-2.5 leading-relaxed">{s.current.description}</p>}
        {s.next && <p className="text-xs text-muted mt-2">Después: <span className="font-semibold text-ink">{s.next.name}</span> ({formatRange(s.next)})</p>}
      </div>
    )
  }
  // Entre fases: lo próximo que viene.
  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5"><CalendarRange className="w-3.5 h-3.5" /> Tu próxima fase</p>
      <p className="font-serif font-bold text-lg mt-1">{s.next!.name}</p>
      <p className="text-xs text-muted">Empieza {s.daysToNext === 1 ? 'mañana' : `en ${s.daysToNext} días`} ({formatRange(s.next!)})</p>
      {s.next!.description && <p className="text-sm mt-2.5 leading-relaxed">{s.next!.description}</p>}
    </div>
  )
}

function phaseLength(p: PlanPhase): number {
  return Math.max(1, Math.round((new Date(`${p.endDate}T00:00:00Z`).getTime() - new Date(`${p.startDate}T00:00:00Z`).getTime()) / 86400000) + 1)
}
