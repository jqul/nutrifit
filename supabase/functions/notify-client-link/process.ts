// Lógica de reparto de los avisos de vinculación, sin dependencias de Deno ni de Supabase (se inyectan): así se prueba con dobles en
// src/lib/notifyClientLinkProceso.test.ts. index.ts solo conecta estas dependencias con Supabase y web-push.
import { buildLinkMessage } from "./message.ts"

export interface LinkNotificationRow {
  id: number
  nutricionista_id: string
  client_id: string
  kind: "linked" | "pending_approval"
  method: string
  occurred_at: string
}
export interface PushSub { id: string; endpoint: string; p256dh: string; auth: string }

export interface Deps {
  /** Reserva (arrendamiento) hasta `limit` avisos pendientes: dos ejecuciones simultáneas nunca reciben el mismo. */
  take(limit: number): Promise<LinkNotificationRow[]>
  clientName(clientId: string): Promise<string>
  /** Suscripciones push del PROFESIONAL destinatario (nunca de la clienta). */
  subscriptions(nutricionistaId: string): Promise<PushSub[]>
  /** Rechaza con { statusCode } si el servicio de push rechaza el envío. */
  send(sub: PushSub, payload: string): Promise<void>
  removeSubscription(id: string): Promise<void>
  finish(id: number, sent: boolean, error: string | null): Promise<void>
}

export interface Summary { taken: number; sent: number; withoutDevices: number; failed: number }

const GONE = (e: unknown) => { const c = (e as { statusCode?: number } | null)?.statusCode; return c === 404 || c === 410 }

export async function processNotifications(deps: Deps, limit = 50): Promise<Summary> {
  const rows = await deps.take(limit)
  const summary: Summary = { taken: rows.length, sent: 0, withoutDevices: 0, failed: 0 }
  for (const n of rows) {
    try {
      const [name, allSubs] = await Promise.all([deps.clientName(n.client_id), deps.subscriptions(n.nutricionista_id)])
      // Un mismo dispositivo suscrito dos veces recibe UN aviso.
      const subs = [...new Map(allSubs.map((s) => [s.endpoint, s])).values()]
      if (subs.length === 0) {
        // Sin dispositivos no hay a quién avisar: se da por tratado (la solicitud y el historial siguen en la ficha de la clienta).
        await deps.finish(n.id, true, "sin suscripciones push")
        summary.withoutDevices++
        continue
      }
      const payload = JSON.stringify(buildLinkMessage({ kind: n.kind, method: n.method, occurredAt: n.occurred_at, clientName: name }))
      const results = await Promise.allSettled(subs.map(async (sub) => {
        try { await deps.send(sub, payload) } catch (e) { if (GONE(e)) await deps.removeSubscription(sub.id); throw e }
      }))
      if (results.some((r) => r.status === "fulfilled")) { await deps.finish(n.id, true, null); summary.sent++ }
      else { await deps.finish(n.id, false, "ningún dispositivo aceptó el aviso"); summary.failed++ }
    } catch (e) {
      // Un aviso con problemas no impide los demás; queda sin enviar y se reintenta al caducar su reserva (máximo 5 intentos).
      await deps.finish(n.id, false, String(e).slice(0, 200))
      summary.failed++
    }
  }
  return summary
}
