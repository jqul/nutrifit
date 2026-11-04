// Recordatorio automático (vía cron cada 15 min) de una cita confirmada que empieza
// dentro de 23–25 horas, al cliente que la tiene — para reducir las ausencias sin que
// el nutricionista tenga que escribir a mano. reminder_sent_at marca que ya se avisó
// de esa cita (una vez, nunca por periodo, a diferencia de los otros recordatorios).
// Reutiliza el mismo mecanismo de Web Push que send-push.
//
// Solo la llama el propio cron — ver la nota de CRON_SECRET en
// send-risk-reminders/index.ts (mismo mecanismo, misma variable).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import webpush from "npm:web-push@3.6.7"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { fetchAllRows } from "./shared/fetchAll.ts"

const env = (k: string) => (Deno.env.get(k) ?? "").trim().replace(/^["']+|["']+$/g, "")
const VAPID_PUBLIC_KEY = env("VAPID_PUBLIC_KEY")
const VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY")
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:soporte@nutrifit.app"
const CRON_SECRET = env("CRON_SECRET")

let vapidError = ""
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) }
  catch (e) { vapidError = `${String(e)} (longitud guardada: pública=${VAPID_PUBLIC_KEY.length}, privada=${VAPID_PRIVATE_KEY.length}; esperadas 87 y 43)` }
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
)

interface AppointmentRow { id: string; client_id: string | null; title: string; start_at: string }

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  // Fail-closed: sin CRON_SECRET configurado, la función no responde a nadie.
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 })
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500 })
  }
  if (vapidError) {
    return new Response(JSON.stringify({ error: "VAPID keys invalid: " + vapidError }), { status: 500 })
  }

  try {
    const now = Date.now()
    // Ventana de 2h, barrida cada 15 min: toda cita que entre en ella se coge una vez
    // (reminder_sent_at la marca), sin depender de que el cron caiga en un minuto exacto.
    const windowStart = new Date(now + 23 * 3600_000).toISOString()
    const windowEnd = new Date(now + 25 * 3600_000).toISOString()

    const appointments = await fetchAllRows<AppointmentRow>((from, to) =>
      supabase.from("appointments").select("id, client_id, title, start_at")
        .eq("status", "confirmada").not("client_id", "is", null)
        .gte("start_at", windowStart).lt("start_at", windowEnd)
        .is("reminder_sent_at", null)
        .order("id").range(from, to))
    if (!appointments.length) {
      return new Response(JSON.stringify({ sent: 0, appointments: 0 }), { headers: { "Content-Type": "application/json" } })
    }

    let totalSent = 0
    for (const appt of appointments) {
      const { data: subs } = await supabase
        .from("push_subscriptions").select("*").eq("client_id", appt.client_id as string)
      if (subs?.length) {
        // Hora en la zona horaria del mercado principal de NutriFit (España) — la cita no
        // lleva la zona horaria del cliente guardada, así que es una asunción, no un dato.
        const hora = new Date(appt.start_at).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" })
        const payload = JSON.stringify({
          title: "Recuerda tu cita 📅",
          body: `${appt.title || "Cita"} — mañana a las ${hora}`,
          url: "/",
        })
        const results = await Promise.allSettled(
          subs.map((sub) =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            ).catch(async (err: any) => {
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                await supabase.from("push_subscriptions").delete().eq("id", sub.id)
              }
              throw err
            })
          )
        )
        totalSent += results.filter((r) => r.status === "fulfilled").length
      }
      // Se marca "ya avisado" aunque el cliente no tenga ninguna suscripción push activa:
      // lo que cuenta es que ya pasó por la ventana de 23-25h, no si llegó a entregarse.
      await supabase.from("appointments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", appt.id)
    }

    return new Response(JSON.stringify({ sent: totalSent, appointments: appointments.length }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
