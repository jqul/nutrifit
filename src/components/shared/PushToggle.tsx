import { Bell, BellOff } from 'lucide-react'
import { usePushNotifications } from '../../lib/usePushNotifications'

export function PushToggle({ nutricionistaId, clientId }: { nutricionistaId?: string; clientId?: string }) {
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications({ nutricionistaId, clientId })

  if (!supported) return null

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
