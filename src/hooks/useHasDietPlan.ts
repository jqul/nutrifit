import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** ¿Alguno de los clientes del nutricionista tiene ya un plan de dieta con objetivos? (para los primeros pasos). */
export function useHasDietPlan(nutricionistaId: string, enabled: boolean): boolean {
  const [has, setHas] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    supabase.from('diet_plans').select('id').eq('nutricionista_id', nutricionistaId).gt('kcal_target', 0).limit(1)
      .then(({ data }) => { if (!cancelled) setHas((data?.length ?? 0) > 0) })
    return () => { cancelled = true }
  }, [nutricionistaId, enabled])
  return has
}
