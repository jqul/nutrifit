import { useState } from 'react'
import { CheckCircle2, Eye } from 'lucide-react'
import { reviewLabel } from '../../../lib/reviewStatus'

/**
 * Estado de revisión de la ficha. Abrir Seguimiento no la marca como revisada: es una acción del nutricionista, con este
 * botón, para que el aviso del inicio ("check-in o encuesta sin revisar") signifique que de verdad alguien lo ha mirado.
 */
export function RevisionBar({ review }: {
  review: { unreviewed: boolean; lastReviewedAt: string | null; onMark: () => void | Promise<void> }
}) {
  const [saving, setSaving] = useState(false)
  const mark = async () => {
    setSaving(true)
    try { await review.onMark() } finally { setSaving(false) }
  }

  if (review.unreviewed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-notice/40 bg-notice/10 px-4 py-3">
        <p className="text-sm flex items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 text-notice flex-shrink-0" />
          <span><span className="font-semibold">Actividad nueva sin revisar.</span>{' '}
            <span className="text-muted">Mira el check-in o la encuesta y márcalo cuando lo hayas revisado.</span></span>
        </p>
        <button type="button" onClick={mark} disabled={saving}
          className="px-3.5 py-2 rounded-lg bg-ink text-white text-sm font-semibold disabled:opacity-50 flex-shrink-0">
          {saving ? 'Guardando…' : 'Marcar como revisado'}
        </button>
      </div>
    )
  }
  return (
    <p className="text-xs text-muted flex items-center gap-1.5 px-1">
      <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> {reviewLabel(review.lastReviewedAt)} · no hay actividad nueva pendiente
    </p>
  )
}
