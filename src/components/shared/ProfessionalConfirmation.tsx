import { useId } from 'react'

/**
 * Texto de la casilla de confirmación. Es una confirmación VISUAL: no se guarda en ningún sitio, no queda en el historial ni en ningún
 * registro de auditoría. El texto lo dice expresamente para que nadie la tome por una validación trazada.
 */
export const CONFIRMATION_TEXT =
  'Confirmación visual en pantalla, no auditada (la app no guarda que la hayas marcado): he revisado las señales de arriba y asumo este objetivo con mi criterio profesional.'

export function ProfessionalConfirmation({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-xs cursor-pointer">
      <input id={id} type="checkbox" className="accent-accent mt-0.5" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{CONFIRMATION_TEXT}</span>
    </label>
  )
}
