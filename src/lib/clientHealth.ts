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

export function computeClientHealth(client: {
  lastCheckin?: string
  streak?: number
  createdAt: number
  monthlyPrice: number | null
}, hasCurrentPeriodInvoice: boolean, referenceDate = new Date()): ClientHealth {
  const daysSinceCheckin = client.lastCheckin ? daysBetween(client.lastCheckin, referenceDate) : null
  const daysSinceJoined = Math.floor((referenceDate.getTime() - client.createdAt) / 86400000)

  // Si el cliente se acaba de dar de alta, todavía no ha tenido ni ocasión
  // de hacer su primer check-in — no lo marcamos como "sin check-in" hasta
  // que pase el mismo margen de días que usamos para el resto de clientes.
  const tooNewToFlag = daysSinceJoined <= INACTIVITY_THRESHOLD_DAYS
  if (!tooNewToFlag && (daysSinceCheckin === null || daysSinceCheckin > INACTIVITY_THRESHOLD_DAYS)) {
    return {
      status: 'attention',
      label: daysSinceCheckin === null ? 'Sin check-ins todavía' : `Sin check-in hace ${daysSinceCheckin}d`,
    }
  }
  if (client.monthlyPrice != null && !hasCurrentPeriodInvoice) {
    return { status: 'billing', label: 'Plan por renovar' }
  }
  if ((client.streak || 0) >= STREAK_THRESHOLD_DAYS) {
    return { status: 'streak', label: `En racha · ${client.streak}d` }
  }
  return { status: 'active', label: 'Activo' }
}
