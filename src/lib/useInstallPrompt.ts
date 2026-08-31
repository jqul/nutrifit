import { useState, useEffect } from 'react'

// El evento beforeinstallprompt no tiene tipo estándar en TS todavía.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari no tiene display-mode: standalone — expone su propio flag.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

/**
 * Instalar NutriFit como PWA desde dentro de la propia app, en vez de
 * depender de que cada uno encuentre la opción en el menú del navegador.
 * Chrome/Edge/Android exponen un evento nativo (beforeinstallprompt) que se
 * puede disparar bajo demanda; Safari en iOS no lo soporta en absoluto —
 * ahí solo se puede guiar a "Compartir → Añadir a pantalla de inicio".
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    if (installed) return
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null) }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [installed])

  const canPromptNatively = !!deferredPrompt
  const needsIosInstructions = !canPromptNatively && isIos() && !installed

  const promptInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return {
    // Solo tiene sentido ofrecer el botón si de verdad se puede hacer algo
    // con él (prompt nativo, o instrucciones de iOS) y no está ya instalada.
    show: !installed && (canPromptNatively || needsIosInstructions),
    canPromptNatively, needsIosInstructions, promptInstall,
  }
}
