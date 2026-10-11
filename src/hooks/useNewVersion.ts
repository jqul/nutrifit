import { useEffect, useState } from 'react'
import { entryAssetOf, isNewVersion } from '../lib/appVersion'

const MIN_GAP_MS = 5 * 60 * 1000       // no preguntar al servidor más de una vez cada 5 minutos
const EVERY_MS = 15 * 60 * 1000        // y, con la app abierta y visible, cada 15

/**
 * Avisa de que hay una versión nueva de la app. Una pestaña o una app instalada puede llevar días abierta con el código
 * antiguo; al volver a ella (o cada rato) se mira qué página sirve ahora el servidor. Solo en producción.
 */
export function useNewVersion(): boolean {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD) return
    const current = entryAssetOf(document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src') ?? '')
    if (!current) return
    let last = Date.now()
    let stopped = false

    const check = async () => {
      if (stopped || document.visibilityState !== 'visible' || Date.now() - last < MIN_GAP_MS) return
      last = Date.now()
      try {
        const res = await fetch('/', { cache: 'no-store', headers: { Accept: 'text/html' } })
        if (!res.ok) return
        if (isNewVersion(current, entryAssetOf(await res.text()))) setAvailable(true)
      } catch { /* sin conexión: se vuelve a mirar más tarde */ }
    }

    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    const timer = setInterval(check, EVERY_MS)
    return () => { stopped = true; document.removeEventListener('visibilitychange', check); window.removeEventListener('online', check); clearInterval(timer) }
  }, [])

  return available
}
