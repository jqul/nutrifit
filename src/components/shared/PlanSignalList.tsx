import { AlertTriangle, Ban, Info } from 'lucide-react'
import { EvidenceBasis, PlanSignal, SignalSeverity } from '../../lib/planSafety'

const BASIS_LABEL: Record<EvidenceBasis, string> = {
  aritmetica: 'aritmética',
  evidencia_solida: 'evidencia sólida',
  evidencia_limitada: 'evidencia limitada',
  decision_de_producto: 'decisión de producto',
}
const SEVERITY_LABEL: Record<SignalSeverity, string> = { bloqueo: 'No se calcula', revision: 'Pide revisión profesional', advertencia: 'Aviso', info: 'Nota' }
const STYLE: Record<SignalSeverity, string> = {
  bloqueo: 'border-warn/40 bg-warn/10',
  revision: 'border-notice/40 bg-notice/10',
  advertencia: 'border-border bg-bg',
  info: 'border-border/60 bg-bg',
}

/**
 * Señales del motor de evaluación del plan (planSafety.ts): qué se ha detectado, en qué se apoya cada una y qué hacer.
 * Ninguna dice que algo sea «seguro»: distinguen entre no calcular, pedir revisión y avisar.
 */
export function PlanSignalList({ signals, showInfo = false }: { signals: PlanSignal[]; showInfo?: boolean }) {
  const shown = showInfo ? signals : signals.filter(s => s.severity !== 'info')
  if (shown.length === 0) return null
  return (
    <ul className="space-y-1.5" aria-label="Señales sobre el cálculo">
      {shown.map((s, i) => (
        <li key={`${s.code}-${i}`} className={`rounded-xl border px-3 py-2 text-xs ${STYLE[s.severity]}`}>
          <p className="flex items-start gap-2 font-semibold">
            {s.severity === 'bloqueo' ? <Ban className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-warn" aria-hidden />
              : s.severity === 'info' ? <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-muted" aria-hidden />
              : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-notice" aria-hidden />}
            <span><span className="sr-only">{SEVERITY_LABEL[s.severity]}: </span>{s.title}</span>
          </p>
          <p className="text-muted mt-0.5 pl-5">{s.explanation}</p>
          <p className="text-[11px] text-muted/80 mt-0.5 pl-5">{SEVERITY_LABEL[s.severity]} · base: {BASIS_LABEL[s.basis]}</p>
        </li>
      ))}
    </ul>
  )
}
