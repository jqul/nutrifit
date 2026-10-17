import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Los clientes del nutricionista que ya tienen un plan de dieta con objetivos (para los primeros pasos). */
export function useClientsWithPlan(nutricionistaId: string, enabled: boolean): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    supabase.from('diet_plans').select('client_id').eq('nutricionista_id', nutricionistaId).gt('kcal_target', 0)
      .then(({ data }) => { if (!cancelled) setIds(new Set((data ?? []).map(r => r.client_id as string))) })
    return () => { cancelled = true }
  }, [nutricionistaId, enabled])
  return ids
}
