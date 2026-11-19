import { useId } from 'react'
import { MIN_EVALUATION_REASON_CHARS } from '../../lib/planGuard'

/**
 * Declaración ESPECÍFICA de evaluación profesional, para lo que la app no puede determinar por sí misma (embarazo o lactancia con un
 * objetivo del que no se sabe si implica pérdida de peso). No es la casilla genérica de revisión: exige una declaración concreta y una
 * justificación escrita. Sigue siendo una declaración en pantalla, NO auditada y NO una validación de seguridad de la app.
 */
export const EVALUATION_TEXT =
  'Evaluación profesional específica, no auditada (la app no guarda esta declaración): declaro que he valorado, para esta persona y su situación actual de embarazo o lactancia, que este objetivo NO supone una pérdida de peso ni compromete sus necesidades, y que he revisado todas las señales de arriba. Esta declaración no es una validación de seguridad de la app.'

export function ProfessionalEvaluation({ checked, onChange, reason, onReasonChange }: {
  checked: boolean; onChange: (checked: boolean) => void; reason: string; onReasonChange: (reason: string) => void
}) {
  const id = useId()
  const missing = Math.max(0, MIN_EVALUATION_REASON_CHARS - reason.trim().length)
  return (
    <div className="space-y-2 rounded-xl border border-notice/40 bg-notice/10 p-3">
      <p className="text-xs font-semibold">Pendiente de evaluación profesional: la app no puede determinar si este objetivo implica pérdida de peso</p>
      <label htmlFor={`${id}-check`} className="flex items-start gap-2 text-xs cursor-pointer">
        <input id={`${id}-check`} type="checkbox" className="accent-accent mt-0.5" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span>{EVALUATION_TEXT}</span>
      </label>
      <div>
        <label htmlFor={`${id}-reason`} className="block text-xs font-semibold mb-1">Justificación de tu evaluación (obligatoria, mínimo {MIN_EVALUATION_REASON_CHARS} caracteres)</label>
        <textarea id={`${id}-reason`} value={reason} onChange={e => onReasonChange(e.target.value)} rows={2} maxLength={400}
          className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
        {missing > 0 && <p className="text-[11px] text-muted mt-0.5">Faltan {missing} caracteres. Lo que escribas aquí no se guarda en ningún registro.</p>}
      </div>
    </div>
  )
}
