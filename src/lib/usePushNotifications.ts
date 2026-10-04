import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { toast } from '../components/shared/Toast'

// Clave PÚBLICA VAPID (no es un secreto: el navegador la necesita para
// suscribirse). Va fija en el código a propósito y NO se lee de
// VITE_VAPID_PUBLIC_KEY: una variable antigua en Vercel o en un .env pisaría la
// clave buena y rompería las notificaciones sin ningún error visible. Debe
// coincidir con el secreto VAPID_PUBLIC_KEY de Supabase; si se rota el par,
// se cambia aquí.
const VAPID_PUBLIC_KEY = 'BMqjfis4fACrLYQE0Fm0-mQxT9FQBLDheEkXWtHh13_sfBvXg7jX7_SjAFjn0Yugw09bqgDKW8ewoideccDWvw4'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

interface Owner { nutricionistaId?: string; clientId?: string }

export function usePushNotifications(owner: Owner) {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY)
    navigator.serviceWorker?.ready.then(async reg => {
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    }).catch(() => {})
  }, [])

  const subscribe = async () => {
    if (!supported) return
    setLoading(true)
    try {
      // Importante: pedir el permiso ANTES de cualquier await de por medio
      // (incl. serviceWorker.ready) — Safari/WebKit es más estricto que Chrome
      // sobre qué cuenta como "gesto del usuario" y puede ignorar la petición
      // en silencio (sin mostrar el diálogo del sistema) si ya ha pasado por
      // un await distinto antes de llamar a requestPermission().
      const permission = await Notification.requestPermission()
      if (permission === 'denied') {
        toast('Notificaciones bloqueadas — actívalas desde los ajustes del sistema para esta app', 'warn')
        setLoading(false)
        return
      }
      if (permission !== 'granted') { setLoading(false); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      })
      const key = sub.toJSON() as { keys?: { p256dh: string; auth: string } }
      const { error } = await supabase.from('push_subscriptions').upsert({
        nutricionista_id: owner.nutricionistaId || null,
        client_id: owner.clientId || null,
        endpoint: sub.endpoint,
        p256dh: key.keys?.p256dh || '',
        auth: key.keys?.auth || '',
      }, { onConflict: 'endpoint' })
      if (error) { toast('Error al guardar la suscripción: ' + error.message, 'warn'); setLoading(false); return }
      setSubscribed(true)
      toast('Notificaciones activadas ✓', 'ok')
    } catch (err) {
      toast('No se pudo activar las notificaciones: ' + (err instanceof Error ? err.message : String(err)), 'warn')
    } finally {
      setLoading(false)
    }
  }

  const unsubscribe = async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }

  return { supported, subscribed, loading, subscribe, unsubscribe }
}

/** Dispara un push real vía la Edge Function send-push. Falla en silencio si no hay suscripciones. */
export async function sendPush(target: Owner, title: string, body: string, url?: string) {
  try {
    await supabase.functions.invoke('send-push', { body: { ...target, title, body, url } })
  } catch {
    // no bloquear el flujo principal si falla el push
  }
}
