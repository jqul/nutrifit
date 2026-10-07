import { useCallback, useEffect, useState } from 'react'
import { useRealtimeRefresh } from './useRealtimeRefresh'
import { supabase } from '../lib/supabase'
import { appointmentFromRow } from '../lib/mappers'
import { toLocalISODate } from '../lib/date'
import { DEMO_APPOINTMENTS } from '../lib/demo-data'
import { Appointment } from '../types'

/** Citas de hoy del nutricionista (sin canceladas), por hora. En demo salen de los datos de ejemplo. */
export function useTodayAppointments(nutricionistaId: string, demoMode: boolean): Appointment[] {
  const [appointments, setAppointments] = useState<Appointment[]>([])

  const load = useCallback(() => {
    if (demoMode) {
      const todayStr = toLocalISODate(new Date())
      setAppointments(DEMO_APPOINTMENTS
        .filter(a => toLocalISODate(new Date(a.startAt)) === todayStr && a.status !== 'cancelada')
        .sort((a, b) => a.startAt.localeCompare(b.startAt)))
      return
    }
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(); end.setHours(23, 59, 59, 999)
    supabase.from('appointments').select('*')
      .eq('nutricionista_id', nutricionistaId).neq('status', 'cancelada')
      .gte('start_at', start.toISOString()).lte('start_at', end.toISOString())
      .order('start_at')
      .then(({ data }) => setAppointments((data || []).map(appointmentFromRow)))
  }, [nutricionistaId, demoMode])

  useEffect(() => { load() }, [load])
  // Las citas de hoy se actualizan solas cuando cambia alguna.
  useRealtimeRefresh('appointments', `nutricionista_id=eq.${nutricionistaId}`, load, !demoMode)

  return appointments
}
