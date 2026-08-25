import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

// Hoja inferior táctil (a diferencia de Modal, que es un diálogo centrado) —
// para interacciones rápidas y frecuentes en el modo cliente, como elegir un
// sustituto de un alimento, que se sienten mejor deslizándose desde abajo.
interface BottomSheetProps { open: boolean; onClose: () => void; title?: string; children: ReactNode }
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-card w-full max-w-xl rounded-t-2xl border-t border-x border-border shadow-2xl animate-slide-up flex flex-col overflow-hidden"
        style={{ maxHeight: '80vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-2.5 flex-shrink-0" />
        {title && (
          <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-border flex-shrink-0">
            <h3 className="text-base font-serif font-bold">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-alt text-muted hover:text-ink transition-colors"><X className="w-4 h-4" /></button>
          </div>
        )}
        <div className="p-5 overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </div>
  )
}
