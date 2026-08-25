import { useState } from 'react'
import { Calculator, X } from 'lucide-react'
import { ConversorTab } from './ConversorTab'

/** Botón flotante + panel lateral con el conversor de alimentos, para
 * usarlo sin salir de donde se está montando el plan (PlanDietaTab) o una
 * plantilla (PlantillasTab) — antes solo existía como pestaña propia del
 * dashboard, lo que obligaba a abandonar el cliente/plantilla que se
 * estaba editando solo para consultar una equivalencia o una sustitución. */
export function FoodConverterDrawer({ nutricionistaId, demoMode }: { nutricionistaId?: string; demoMode?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* En modo demo hay además un aviso fijo al pie de página (DemoCTA, en
          App.tsx) que en móvil puede ocupar dos líneas — con bottom-6 el FAB
          quedaba justo detrás y era imposible de tocar. Se sube más en ese
          caso para no solaparse con él. */}
      <button onClick={() => setOpen(true)} title="Conversor de alimentos"
        className={`fixed ${demoMode ? 'bottom-24' : 'bottom-6'} right-6 z-40 w-14 h-14 rounded-full bg-ink text-white shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity`}>
        <Calculator className="w-6 h-6" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="bg-bg w-full max-w-md h-full overflow-y-auto shadow-2xl animate-slide-in-right">
            <div className="sticky top-0 bg-bg/95 backdrop-blur-sm z-10 flex justify-end px-3 pt-3">
              <button onClick={() => setOpen(false)} className="p-2 rounded-full bg-card border border-border shadow hover:bg-bg-alt text-muted hover:text-ink transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 pb-4">
              <ConversorTab nutricionistaId={nutricionistaId} demoMode={demoMode} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
