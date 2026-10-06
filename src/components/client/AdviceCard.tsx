import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { adviceNeedsCollapse } from '../../lib/advice'

/**
 * El consejo del nutricionista (o la nota propia en modo personal). Si es largo se ve plegado, con las dos
 * primeras líneas, y se despliega al tocarlo: antes ocupaba media pantalla en el móvil.
 */
export function AdviceCard({ advice, personalMode }: { advice: string; personalMode?: boolean }) {
  const [open, setOpen] = useState(false)
  const title = personalMode ? 'Tu nota' : 'Consejo de tu nutricionista'

  if (!adviceNeedsCollapse(advice)) {
    return (
      <div className="card-featured p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-accent mb-1.5">{title}</p>
        <p className="text-sm leading-relaxed">{advice}</p>
      </div>
    )
  }

  return (
    <div className="card-featured p-4">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left">
        <span className="text-xs font-bold uppercase tracking-wider text-accent">{title}</span>
        <span className="flex items-center gap-1 text-xs font-semibold text-accent flex-shrink-0">
          {open ? 'Ocultar' : 'Ver todo'}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      <p className={`text-sm leading-relaxed mt-1.5 whitespace-pre-line ${open ? '' : 'line-clamp-2'}`}>{advice}</p>
    </div>
  )
}
