import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useNewVersion } from '../../hooks/useNewVersion'

/** «Hay una versión nueva · Actualizar»: recarga la app para tener lo último. Se puede dejar para más tarde. */
export function UpdateBanner() {
  const available = useNewVersion()
  const [later, setLater] = useState(false)
  if (!available || later) return null
  return (
    <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 sm:bottom-6 z-[9998] w-[calc(100%-2rem)] max-w-md animate-slide-up">
      <div className="flex items-center gap-3 rounded-2xl bg-ink text-white px-4 py-3 shadow-lg">
        <RefreshCw className="w-4 h-4 flex-shrink-0" aria-hidden />
        <p className="text-sm flex-1 min-w-0"><span className="font-semibold">Hay una versión nueva.</span> Actualiza para ver lo último.</p>
        <button type="button" onClick={() => window.location.reload()} className="px-3 py-1.5 rounded-lg bg-white text-ink text-sm font-bold flex-shrink-0">Actualizar</button>
        <button type="button" onClick={() => setLater(true)} className="text-xs text-white/70 hover:text-white flex-shrink-0" aria-label="Recordármelo más tarde">Luego</button>
      </div>
    </div>
  )
}
