import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Llama a `onChange` cuando cambia algo en una tabla (Supabase Realtime), agrupando ráfagas de cambios (por defecto
 * 400 ms) para no recargar varias veces seguidas. `filter` es de la forma `columna=eq.valor`. No hace nada si `enabled`
 * es false (p. ej. en el modo demo). Requiere que la tabla esté en la publicación supabase_realtime (migración 0054).
 */
export function useRealtimeRefresh(table: string, filter: string, onChange: () => void, enabled = true, debounceMs = 400) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const channel = supabase.channel(`rt:${table}:${filter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
        clearTimeout(timer)
        timer = setTimeout(() => onChangeRef.current(), debounceMs)
      })
      .subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(channel) }
  }, [table, filter, enabled, debounceMs])
}
