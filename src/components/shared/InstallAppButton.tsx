import { useState } from 'react'
import { useInstallPrompt } from '../../lib/useInstallPrompt'
import { Modal } from './Modal'
import { Download, Share, SquarePlus } from 'lucide-react'

/** Botón "Instalar app" — se oculta solo si ya está instalada o si el
 * navegador no ofrece ninguna vía (ni prompt nativo ni instrucciones de
 * iOS aplicables), así que es seguro montarlo siempre sin comprobar nada
 * desde fuera. */
export function InstallAppButton({ variant = 'button' }: { variant?: 'button' | 'link' }) {
  const { show, canPromptNatively, needsIosInstructions, promptInstall } = useInstallPrompt()
  const [showIosHelp, setShowIosHelp] = useState(false)

  if (!show) return null

  const handleClick = () => {
    if (canPromptNatively) promptInstall()
    else if (needsIosInstructions) setShowIosHelp(true)
  }

  const className = variant === 'link'
    ? 'flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink transition-colors'
    : 'flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:border-accent hover:text-accent transition-colors'

  return (
    <>
      <button onClick={handleClick} className={className}>
        <Download className="w-4 h-4" /> Instalar app
      </button>
      <Modal open={showIosHelp} onClose={() => setShowIosHelp(false)} title="Instalar NutriFit">
        <div className="space-y-4 text-sm">
          <p className="text-muted">En Safari (no funciona desde Chrome en iPhone):</p>
          <div className="flex items-center gap-3 bg-bg-alt rounded-xl p-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-xs">1</span>
            <span className="flex items-center gap-1.5">Toca <Share className="w-4 h-4 inline text-accent" /> <strong>Compartir</strong>, abajo del todo</span>
          </div>
          <div className="flex items-center gap-3 bg-bg-alt rounded-xl p-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-xs">2</span>
            <span className="flex items-center gap-1.5">Elige <SquarePlus className="w-4 h-4 inline text-accent" /> <strong>Añadir a pantalla de inicio</strong></span>
          </div>
        </div>
      </Modal>
    </>
  )
}
