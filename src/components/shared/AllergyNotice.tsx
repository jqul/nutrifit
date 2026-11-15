import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ALLERGY_NOTICE_CLIENT, ALLERGY_NOTICE_PRO, CoverageAudience, allergyCoverage, coverageLine } from '../../lib/allergyCoverage'

/**
 * Aviso de que la comprobación de alérgenos es orientativa, con una línea por cada alergia escrita que dice qué se comprueba
 * y qué no. Solo sale si el cliente tiene alguna alergia escrita. No es una garantía: nunca dice que algo sea seguro o apto.
 * `compact` enseña solo el aviso general (para sitios pequeños como las hojas de sustituciones o de recetas).
 */
export function AllergyNotice({ allergies, audience, compact = false }: { allergies: string | null | undefined; audience: CoverageAudience; compact?: boolean }) {
  const coverage = useMemo(() => allergyCoverage(allergies), [allergies])
  if (coverage.items.length === 0) return null
  return (
    <div role="note" aria-label="Aviso sobre la comprobación de alérgenos" className="rounded-xl border border-notice/30 bg-notice/10 px-3 py-2.5 text-xs text-ink space-y-1.5">
      <p className="flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-notice" aria-hidden />
        <span>{audience === 'pro' ? ALLERGY_NOTICE_PRO : ALLERGY_NOTICE_CLIENT}</span>
      </p>
      {!compact && (
        <ul className="space-y-1 pl-6 list-disc text-muted">
          {coverage.items.map((item, i) => <li key={i}>{coverageLine(item, audience)}</li>)}
        </ul>
      )}
    </div>
  )
}
