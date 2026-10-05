import { ReactNode } from 'react'

/** Cabecera común de las herramientas del nutricionista (Conversor,
 * Micronutrientes): mismo título, descripción y espaciado en las dos, para
 * que se lean como parte de un mismo grupo y no como pantallas sueltas. */
export function ToolHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h1 className="text-2xl font-serif font-bold">{title}</h1>
      <p className="text-sm text-muted">{children}</p>
    </div>
  )
}
