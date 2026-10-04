import { useState, useEffect, useRef, ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'

export interface ActionMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  title?: string
}

/**
 * Menú desplegable de acciones secundarias (se abre hacia arriba: vive en una
 * barra fija al pie de la pantalla). Se cierra al elegir una opción, al pulsar
 * fuera o con Escape. Sirve para que la acción principal (Guardar) sea el
 * único botón con peso y el resto de acciones no compitan con el contenido.
 */
export function ActionMenu({ label, items }: { label: string; items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-ink hover:bg-bg-alt transition-colors">
        <MoreHorizontal className="w-4 h-4" /> {label}
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full mb-2 right-0 sm:right-auto sm:left-0 w-64 max-w-[calc(100vw-3rem)] card shadow-lg p-1.5 z-20">
          {items.map(item => (
            <button key={item.label} type="button" role="menuitem" title={item.title}
              onClick={() => { setOpen(false); item.onClick() }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left text-ink hover:bg-bg-alt transition-colors">
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
