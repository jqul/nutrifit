import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Fallback fijo — ver el comentario en lib/supabase.ts sobre por qué no basta
// con confiar en la variable de entorno en algunas plataformas de despliegue.
const FALLBACK_VAPID_KEY = 'BMJsM8qK_wLP8bcy_mf7QkFVmju7O2vBkk9Je38qlXT57ZNFokzsZOJ6uSKx1zbxde1dwiyEbXh6W2n5ti2TRvg'
const envVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
const VAPID_PUBLIC_KEY = envVapidKey && /^[\w-]{80,}$/.test(envVapidKey) ? envVapidKey : FALLBACK_VAPID_KEY

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
      const reg = await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setLoading(false); return }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      })
      const key = sub.toJSON() as { keys?: { p256dh: string; auth: string } }
      await supabase.from('push_subscriptions').upsert({
        nutricionista_id: owner.nutricionistaId || null,
        client_id: owner.clientId || null,
        endpoint: sub.endpoint,
        p256dh: key.keys?.p256dh || '',
        auth: key.keys?.auth || '',
      }, { onConflict: 'endpoint' })
      setSubscribed(true)
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
