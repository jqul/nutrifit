import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEMO_ANAMNESIS } from '../lib/demo-data'
import { ReproductiveCheck, reproductiveCheckFromQuery } from '../lib/planSafety'

/**
 * Lee la respuesta del cuestionario de salud sobre embarazo/lactancia, distinguiendo TRES estados: cargando, leído (con o sin respuesta) y
 * error de consulta. Un error no se interpreta nunca como «no hay embarazo ni lactancia»: quien lo use debe tratarlo como «no comprobado».
 */
export function useReproductiveCheck(clientId: string, demoMode?: boolean): { check: ReproductiveCheck; answer: string } {
  const [state, setState] = useState<{ check: ReproductiveCheck; answer: string }>(
    demoMode ? { check: 'ready', answer: DEMO_ANAMNESIS[clientId]?.embarazo_lactancia || '' } : { check: 'loading', answer: '' })

  useEffect(() => {
    if (demoMode) { setState({ check: 'ready', answer: DEMO_ANAMNESIS[clientId]?.embarazo_lactancia || '' }); return }
    let cancelled = false
    setState({ check: 'loading', answer: '' })
    Promise.resolve(supabase.from('anamnesis').select('answers').eq('client_id', clientId).maybeSingle())
      .then(({ data, error }) => { if (!cancelled) setState(reproductiveCheckFromQuery(data as { answers?: Record<string, string> | null } | null, error)) })
      .catch(() => { if (!cancelled) setState({ check: 'error', answer: '' }) })
    return () => { cancelled = true }
  }, [clientId, demoMode])

  return state
}
