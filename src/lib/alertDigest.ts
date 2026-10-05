// Automatizaciones: aviso diario al NUTRICIONISTA (nunca al cliente) con las
// alertas que acaban de aparecer. Un solo push-resumen, no uno por alerta, y
// cada alerta se avisa una vez: solo vuelve a avisar si desaparece y reaparece.
// Esta lógica es pura; la usa la función programada send-nutricionista-alerts
// (copiada a supabase/functions/send-nutricionista-alerts/shared/ por
// scripts/sync-edge-shared.mjs) y la pantalla Ajustes → Avisos.
import { AlertKind } from './clientAlerts'

export interface AutomationSettings {
  /** Qué tipos de alerta quiere recibir; los que no aparezcan cuentan como activados. */
  kinds?: Partial<Record<AlertKind, boolean>>
  /** Recordatorio de las citas de mañana; activado salvo que se desactive. */
  appointments_tomorrow?: boolean
}

export const ALERT_KINDS: AlertKind[] = ['weight_stalled', 'high_hunger', 'low_energy', 'low_adherence', 'no_weigh_in', 'goal_reached']

export function isKindEnabled(settings: AutomationSettings | null | undefined, kind: AlertKind): boolean {
  return settings?.kinds?.[kind] !== false
}

export function isAppointmentReminderEnabled(settings: AutomationSettings | null | undefined): boolean {
  return settings?.appointments_tomorrow !== false
}

/** Una alerta activa de un cliente concreto. */
export interface ActiveAlert { clientId: string; clientName: string; kind: AlertKind; label: string }

export const alertKey = (a: { clientId: string; kind: AlertKind }) => `${a.clientId}:${a.kind}`

export interface NotificationPlan {
  /** Alertas nuevas que hay que avisar hoy. */
  toNotify: ActiveAlert[]
  /** Claves ya avisadas que dejaron de estar activas: se olvidan para poder avisar si reaparecen. */
  keysToClear: string[]
}

/**
 * Compara las alertas activas hoy con las ya avisadas. Una alerta de un tipo
 * desactivado no cuenta (así, al reactivarlo, avisará de lo que siga activo).
 */
export function planAlertNotifications(
  active: ActiveAlert[], alreadyNotified: Set<string>, settings: AutomationSettings | null | undefined,
): NotificationPlan {
  const enabled = active.filter(a => isKindEnabled(settings, a.kind))
  const activeKeys = new Set(enabled.map(alertKey))
  return {
    toNotify: enabled.filter(a => !alreadyNotified.has(alertKey(a))),
    keysToClear: [...alreadyNotified].filter(k => !activeKeys.has(k)),
  }
}

export interface TomorrowAppointment { time: string; clientName: string | null; title: string }

export interface Digest { title: string; body: string }

const MAX_CLIENTS = 3

/** Texto del push-resumen, o null si no hay nada que contar. */
export function buildDigest(newAlerts: ActiveAlert[], appointmentsTomorrow: TomorrowAppointment[]): Digest | null {
  const lines: string[] = []

  if (newAlerts.length > 0) {
    const byClient = new Map<string, { name: string; labels: string[] }>()
    for (const a of newAlerts) {
      const entry = byClient.get(a.clientId) ?? { name: a.clientName, labels: [] }
      entry.labels.push(a.label)
      byClient.set(a.clientId, entry)
    }
    const clients = [...byClient.values()]
    const shown = clients.slice(0, MAX_CLIENTS).map(c => `${c.name} (${c.labels.join(', ')})`)
    const extra = clients.length - MAX_CLIENTS
    lines.push(shown.join(' · ') + (extra > 0 ? ` · +${extra} más` : ''))
  }

  if (appointmentsTomorrow.length > 0) {
    const n = appointmentsTomorrow.length
    const first = appointmentsTomorrow.slice(0, 2).map(a => `${a.time} ${a.clientName ?? a.title}`).join(', ')
    lines.push(`Mañana: ${n} ${n === 1 ? 'cita' : 'citas'} (${first}${n > 2 ? ', …' : ''})`)
  }

  if (lines.length === 0) return null

  const clientCount = new Set(newAlerts.map(a => a.clientId)).size
  const title = clientCount > 0
    ? `${clientCount} ${clientCount === 1 ? 'cliente con avisos nuevos' : 'clientes con avisos nuevos'}`
    : 'Tienes citas mañana'
  return { title, body: lines.join('\n') }
}
