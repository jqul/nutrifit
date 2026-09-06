import { useState, useEffect } from 'react'
import { useInstallPrompt } from '../../lib/useInstallPrompt'
import { IosInstallHelpModal } from './InstallAppButton'
import { Download, X } from 'lucide-react'

const SEEN_KEY = 'nutrifit_install_banner_seen'

/**
 * Aviso discreto y de una sola vez para instalar la PWA — a diferencia de
 * InstallAppButton (que vive dentro de "Más opciones", solo lo ve quien va
 * a buscarlo ahí), este banner aparece solo la primera vez que alguien
 * entra, para no depender de que encuentre la opción por su cuenta.
 *
 * Se marca como "visto" en cuanto se muestra por primera vez — no vuelve a
 * aparecer en visitas siguientes, ni si se instala, ni si se descarta ni
 * si simplemente se ignora. Es un aviso de una vez, no una notificación
 * recurrente.
 */
export function InstallBanner() {
  const { show, canPromptNatively, needsIosInstructions, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)
  // Si no hay localStorage (modo privado, etc.) mejor no insistir en cada
  // visita — se trata como "ya visto" por defecto.
  const [alreadySeen] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return true }
  })

  useEffect(() => {
    if (!show || alreadySeen) return
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* modo privado — no pasa nada, solo no se recuerda para la próxima */ }
  }, [show, alreadySeen])

  if (!show || alreadySeen || dismissed) return null

  const handleClick = () => {
    if (canPromptNatively) promptInstall()
    else if (needsIosInstructions) setShowIosHelp(true)
  }

  return (
    <>
      <div className="bg-accent/10 border-b border-accent/20 px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
        <button onClick={handleClick} className="flex items-center gap-2 text-xs font-semibold text-accent text-left min-w-0">
          <Download className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Añade NutriFit a tu pantalla de inicio para entrar más rápido</span>
        </button>
        <button onClick={() => setDismissed(true)} aria-label="Cerrar aviso" className="text-muted hover:text-ink flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      <IosInstallHelpModal open={showIosHelp} onClose={() => setShowIosHelp(false)} />
    </>
  )
}
