import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
interface ModalProps { open: boolean; onClose: () => void; title?: string; children: ReactNode; maxWidth?: string }
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`bg-card w-full ${maxWidth} rounded-2xl border border-border shadow-2xl animate-slide-up flex flex-col overflow-hidden`}
        style={{ maxHeight: '85vh' }}>
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
            <h3 className="text-lg font-serif font-bold">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-alt text-muted hover:text-ink transition-colors"><X className="w-4 h-4" /></button>
          </div>
        )}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </div>
  )
}
