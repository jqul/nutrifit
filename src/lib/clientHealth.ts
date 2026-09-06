// Badges de salud del cliente ("semáforo") para la lista de clientes del
// nutricionista: un único indicador por cliente para detectar de un vistazo
// quién necesita atención — sin check-in reciente, factura por generar,
// buena racha, o simplemente activo. Prioridad de más a menos urgente:
// atención > facturación > racha > activo (solo se muestra el primero que
// aplique, como haría un semáforo real).

export type ClientHealthStatus = 'attention' | 'billing' | 'streak' | 'active'

export interface ClientHealth {
  status: ClientHealthStatus
  label: string
}

const INACTIVITY_THRESHOLD_DAYS = 3
const STREAK_THRESHOLD_DAYS = 3

function daysBetween(dateStr: string, referenceDate: Date): number {
  const d = new Date(dateStr + 'T00:00:00')
  return Math.round((referenceDate.getTime() - d.getTime()) / 86400000)
}

/**
 * ¿Hay un check-in o una respuesta de encuesta más reciente que la última
 * vez que el nutricionista revisó la ficha de este cliente? Si nunca se ha
 * revisado (lastReviewedAt null) pero ya existe actividad, cuenta como sin
 * revisar — no como "todo al día" por defecto.
 */
export function hasUnreviewedActivity(
  lastReviewedAt: string | null,
  lastCheckinDate: string | undefined,
  lastSurveySubmittedAt: string | undefined,
): boolean {
  if (!lastCheckinDate && !lastSurveySubmittedAt) return false
  if (!lastReviewedAt) return true
  const reviewed = new Date(lastReviewedAt).getTime()
  // El check-in solo trae fecha (sin hora) — se compara contra el INICIO
  // de ese día, no el final: si la revisión cae en algún momento del
  // mismo día (a cualquier hora), ya cuenta como revisado.
  if (lastCheckinDate && new Date(lastCheckinDate + 'T00:00:00').getTime() > reviewed) return true
  if (lastSurveySubmittedAt && new Date(lastSurveySubmittedAt).getTime() > reviewed) return true
  return false
}

export function computeClientHealth(client: {
  lastCheckin?: string
  streak?: number
  createdAt: number
  monthlyPrice: number | null
  // Algún biomarcador de la última analítica está fuera de rango — se
  // calcula fuera (necesita bloodMarkers.ts + las lecturas más recientes
  // por marcador) y se pasa ya resuelto para no acoplar este módulo a la
  // lógica clínica.
  hasBiomarkerAlert?: boolean
  // Hay un check-in o respuesta de encuesta más reciente que la última vez
  // que el nutricionista revisó la ficha de este cliente (clientes.last_reviewed_at).
  hasUnreviewedActivity?: boolean
}, hasCurrentPeriodInvoice: boolean, referenceDate = new Date()): ClientHealth {
  const daysSinceCheckin = client.lastCheckin ? daysBetween(client.lastCheckin, referenceDate) : null
  const daysSinceJoined = Math.floor((referenceDate.getTime() - client.createdAt) / 86400000)

  // Si el cliente se acaba de dar de alta, todavía no ha tenido ni ocasión
  // de hacer su primer check-in — no lo marcamos como "sin check-in" hasta
  // que pase el mismo margen de días que usamos para el resto de clientes.
  const tooNewToFlag = daysSinceJoined <= INACTIVITY_THRESHOLD_DAYS

  // Prioridad dentro de "atención" — de más a menos urgente: el riesgo de
  // abandono (sin check-in) es lo primero, porque es lo único de los tres
  // que compromete la relación con el cliente si no se actúa a tiempo; un
  // valor clínico fuera de rango importa pero rara vez es tan urgente como
  // para requerir contacto el mismo día; "tienes algo nuevo sin mirar" es
  // solo una cuestión de bandeja de entrada, la menos urgente de las tres.
  if (!tooNewToFlag && (daysSinceCheckin === null || daysSinceCheckin > INACTIVITY_THRESHOLD_DAYS)) {
    return {
      status: 'attention',
      label: daysSinceCheckin === null ? 'Sin check-ins todavía' : `Sin check-in hace ${daysSinceCheckin}d`,
    }
  }
  if (client.hasBiomarkerAlert) {
    return { status: 'attention', label: 'Analítica en alerta' }
  }
  if (client.hasUnreviewedActivity) {
    return { status: 'attention', label: 'Check-in o encuesta sin revisar' }
  }
  if (client.monthlyPrice != null && !hasCurrentPeriodInvoice) {
    return { status: 'billing', label: 'Plan por renovar' }
  }
  if ((client.streak || 0) >= STREAK_THRESHOLD_DAYS) {
    return { status: 'streak', label: `En racha · ${client.streak}d` }
  }
  return { status: 'active', label: 'Activo' }
}
