import { AlertTriangle, Receipt, Flame, CheckCircle2 } from 'lucide-react'
import { ClientHealthStatus } from '../../lib/clientHealth'
import { WeightTone } from '../../lib/clientListSummary'

// Estado de salud del cliente ("semáforo"): icono + color por estado — ver
// computeClientHealth para la prioridad entre estados. `stripe` es la franja
// lateral de las filas de la lista: solo los estados que piden acción la llevan.
export const HEALTH_BADGE: Record<ClientHealthStatus, { icon: typeof AlertTriangle; pill: string; stripe: string }> = {
  attention: { icon: AlertTriangle, pill: 'text-warn bg-warn/10', stripe: 'border-l-warn' },
  billing: { icon: Receipt, pill: 'text-notice bg-notice/10', stripe: 'border-l-notice' },
  streak: { icon: Flame, pill: 'text-accent bg-accent/10', stripe: 'border-l-transparent' },
  active: { icon: CheckCircle2, pill: 'text-ok bg-ok/10', stripe: 'border-l-transparent' },
}

export const TONE_CLASS: Record<WeightTone, string> = { good: 'text-ok', bad: 'text-warn', neutral: 'text-muted' }
