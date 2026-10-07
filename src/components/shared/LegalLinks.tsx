import { LEGAL_REVIEWED } from '../../legal/entity'
import { LegalSlug } from '../../legal/documents'

const LABEL: Record<LegalSlug, string> = {
  terminos: 'Condiciones de uso', privacidad: 'Privacidad', encargado: 'Encargado del tratamiento',
  clientes: 'Información para clientes', cookies: 'Cookies', aviso: 'Aviso legal',
}

/**
 * Enlaces a los textos legales. No se pintan hasta que los textos estén revisados (LEGAL_REVIEWED en
 * src/legal/entity.ts): no se enlaza públicamente a un borrador.
 */
export function LegalLinks({ slugs, className = '' }: { slugs: LegalSlug[]; className?: string }) {
  if (!LEGAL_REVIEWED) return null
  return (
    <nav aria-label="Textos legales" className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted ${className}`}>
      {slugs.map(s => <a key={s} href={`/?legal=${s}`} className="hover:text-ink underline-offset-2 hover:underline">{LABEL[s]}</a>)}
    </nav>
  )
}
