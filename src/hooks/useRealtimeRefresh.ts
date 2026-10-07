import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const POLL_MS = 45_000

/**
 * Llama a `onChange` cuando cambia algo en una tabla (Supabase Realtime), agrupando ráfagas de cambios (por defecto
 * 400 ms) para no recargar varias veces seguidas. `filter` es de la forma `columna=eq.valor`. No hace nada si `enabled`
 * es false (p. ej. en el modo demo). Requiere que la tabla esté en la publicación supabase_realtime (migración 0054).
 *
 * El directo no basta por sí solo: en un móvil (sobre todo una app instalada en iOS) el sistema suspende la conexión
 * en segundo plano y los cambios que ocurren mientras tanto se pierden. Por eso, además, se recarga al volver a la app,
 * al recuperar la conexión y cada `POLL_MS` mientras la pantalla está visible.
 */
// Supabase devuelve el MISMO canal si dos `channel()` comparten nombre, y añadir `.on()` a un canal ya suscrito lanza
// una excepción (pantalla "algo ha ido mal"). Dos pantallas escuchan la misma tabla a la vez, así que cada uso lleva
// su propio canal.
let nextChannelId = 0

export function useRealtimeRefresh(table: string, filter: string, onChange: () => void, enabled = true, debounceMs = 400) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let channel: ReturnType<typeof supabase.channel> | undefined
    try {
      channel = supabase.channel(`rt:${table}:${filter}:${++nextChannelId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
          clearTimeout(timer)
          timer = setTimeout(() => onChangeRef.current(), debounceMs)
        })
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[realtime]', table, status)
        })
    } catch (e) {
      // El directo es un extra: si falla, la pantalla sigue funcionando (se actualiza al recargar).
      console.warn('[realtime] no se pudo suscribir a', table, e)
    }

    const refreshNow = () => { if (document.visibilityState === 'visible') onChangeRef.current() }
    document.addEventListener('visibilitychange', refreshNow)
    window.addEventListener('online', refreshNow)
    window.addEventListener('focus', refreshNow)
    const poll = setInterval(refreshNow, POLL_MS)

    return () => {
      clearTimeout(timer); clearInterval(poll)
      document.removeEventListener('visibilitychange', refreshNow)
      window.removeEventListener('online', refreshNow)
      window.removeEventListener('focus', refreshNow)
      if (channel) supabase.removeChannel(channel)
    }
  }, [table, filter, enabled, debounceMs])
}
