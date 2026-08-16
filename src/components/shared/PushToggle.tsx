import { useState } from 'react'
import { Bell, BellOff, HelpCircle } from 'lucide-react'
import { usePushNotifications } from '../../lib/usePushNotifications'

// En iOS, el navegador solo expone la API de notificaciones push cuando la
// app se abre desde el icono de "Añadida a pantalla de inicio" (no en una
// pestaña normal de Safari) y con iOS 16.4 o superior. Sin esto, `supported`
// da false y no hay ningún permiso que pedir — se lo explicamos en vez de
// simplemente ocultar el botón sin más, para poder diagnosticarlo a distancia.
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

export function PushToggle({ nutricionistaId, clientId }: { nutricionistaId?: string; clientId?: string }) {
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications({ nutricionistaId, clientId })
  const [showHint, setShowHint] = useState(false)

  if (!supported) {
    if (!isIOS) return null
    return (
      <div className="relative">
        <button onClick={() => setShowHint(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-border text-muted">
          <HelpCircle className="w-3.5 h-3.5" /> Notificaciones no disponibles
        </button>
        {showHint && (
          <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-xl p-3 text-xs text-muted shadow-lg z-20">
            En iPhone, las notificaciones solo funcionan si abres la app desde el icono de "Añadida a pantalla de inicio"
            (no desde una pestaña de Safari), con iOS 16.4 o superior.
          </div>
        )}
      </div>
    )
  }

  return (
    <button onClick={() => (subscribed ? unsubscribe() : subscribe())} disabled={loading}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 ${
        subscribed ? 'bg-ok/10 border-ok/30 text-ok' : 'border-border text-muted hover:border-accent hover:text-accent'
      }`}>
      {subscribed ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
      {subscribed ? 'Notificaciones activas' : 'Activar notificaciones'}
    </button>
  )
}
