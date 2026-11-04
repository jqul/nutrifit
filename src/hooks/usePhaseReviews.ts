import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { planPhaseFromRow } from '../lib/mappers'
import { demoPlanPhases } from '../lib/demo-data'
import { toLocalISODate } from '../lib/date'
import { PlanPhase, PhaseReview, phaseReview } from '../lib/planPhases'

export interface ClientPhaseReview<C> { client: C; review: PhaseReview }

/**
 * Las fases que piden mirar el plan (una termina en pocos días, o terminó sin otra detrás), de los clientes activos de
 * este nutricionista; las más urgentes primero. Una sola consulta para todos los clientes.
 */
export function usePhaseReviews<C extends { id: string }>(nutricionistaId: string, clients: C[], demoMode?: boolean): ClientPhaseReview<C>[] {
  const today = toLocalISODate(new Date())
  const [phases, setPhases] = useState<PlanPhase[]>(() => demoMode ? demoPlanPhases(today) : [])

  useEffect(() => {
    if (demoMode) return
    let cancelled = false
    supabase.from('plan_phases').select('*').eq('nutricionista_id', nutricionistaId).order('start_date')
      .then(({ data }) => { if (!cancelled) setPhases((data || []).map(planPhaseFromRow)) })
    return () => { cancelled = true }
  }, [nutricionistaId, demoMode])

  return useMemo(() => {
    const byClient = new Map<string, PlanPhase[]>()
    for (const p of phases) byClient.set(p.clientId, [...(byClient.get(p.clientId) ?? []), p])
    const out: ClientPhaseReview<C>[] = []
    for (const c of clients) {
      const review = phaseReview(byClient.get(c.id) ?? [], today)
      if (review) out.push({ client: c, review })
    }
    // Primero las que terminan antes (las ya terminadas, por detrás de las que terminan).
    return out.sort((a, b) => (a.review.kind === b.review.kind ? a.review.phase.endDate.localeCompare(b.review.phase.endDate) : a.review.kind === 'ending' ? -1 : 1))
  }, [phases, clients, today])
}
