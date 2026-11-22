// Texto del aviso al PROFESIONAL cuando una clienta vincula su cuenta (o pide vincularla y hay que aprobarla). Función pura, probada en
// src/lib/notifyClientLink.test.ts. Contiene SOLO: nombre de la ficha, fecha y método de verificación. Nunca datos clínicos, ni emails, ni tokens.

export interface LinkNotification {
  kind: "linked" | "pending_approval"
  method: string
  occurredAt: string
  clientName: string
}

const TIME_ZONE = "Europe/Madrid"
const METHODS: Record<string, string> = {
  email_verificado: "email verificado",
  aprobacion_profesional: "aprobada por ti",
  solicitud_pendiente_aprobacion: "pendiente de tu aprobación",
}

const cleanName = (n: string) => n.replace(/[\r\n]+/g, " ").trim().slice(0, 60) || "Una clienta"

export function buildLinkMessage(n: LinkNotification): { title: string; body: string; url: string } {
  const when = new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(n.occurredAt))
  const name = cleanName(n.clientName)
  if (n.kind === "pending_approval") {
    return { title: "Solicitud de vinculación", body: `${name} ha pedido vincular su cuenta (${when}). Necesita tu aprobación en su ficha.`, url: "/" }
  }
  return { title: "Cuenta vinculada", body: `${name} ha vinculado su cuenta (${when}) · ${METHODS[n.method] ?? "verificada"}.`, url: "/" }
}
