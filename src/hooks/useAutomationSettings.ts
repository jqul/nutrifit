import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AutomationSettings } from '../lib/alertDigest'

/**
 * Qué avisos automáticos quiere recibir el nutricionista (tabla
 * nutricionista_automations). Sin fila = todo activado. En demo vive en memoria.
 */
export function useAutomationSettings(nutricionistaId: string, demoMode: boolean) {
  const [settings, setSettings] = useState<AutomationSettings>({})
  const [loading, setLoading] = useState(!demoMode)

  useEffect(() => {
    if (demoMode) return
    let cancelled = false
    supabase.from('nutricionista_automations').select('settings').eq('nutricionista_id', nutricionistaId).maybeSingle()
      .then(({ data }) => { if (!cancelled) { setSettings((data?.settings as AutomationSettings) ?? {}); setLoading(false) } })
    return () => { cancelled = true }
  }, [nutricionistaId, demoMode])

  /** Guarda de inmediato; devuelve false (y deshace el cambio) si la base de datos lo rechaza. */
  const save = useCallback(async (next: AutomationSettings): Promise<boolean> => {
    const previous = settings
    setSettings(next)
    if (demoMode) return true
    const { error } = await supabase.from('nutricionista_automations')
      .upsert({ nutricionista_id: nutricionistaId, settings: next, updated_at: new Date().toISOString() }, { onConflict: 'nutricionista_id' })
    if (error) { setSettings(previous); return false }
    return true
  }, [nutricionistaId, demoMode, settings])

  return { settings, loading, save }
}
