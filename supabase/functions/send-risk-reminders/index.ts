// Recordatorio automático (vía cron diario) a clientes que llevan exactamente
// 3 días sin registrar check-in — un único aviso por episodio de inactividad,
// no un spam diario. Reutiliza el mismo mecanismo de Web Push que send-push.
//
// Solo la llama el propio cron (ver migración de invocación) — a diferencia
// de send-push, que invoca el navegador del usuario con su JWT. Como usa
// SUPABASE_SERVICE_ROLE_KEY (salta RLS) y no tiene un usuario al que atarse,
// se protege con un secreto compartido en vez de un JWT: hace falta la cabecera
// x-cron-secret con el valor de CRON_SECRET (Project Settings → Edge Functions
// → Secrets). Si CRON_SECRET no está configurado, la función rechaza todo
// (fail-closed) en vez de quedar abierta.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import webpush from "npm:web-push@3.6.7"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Recorta espacios/saltos de línea y comillas que se cuelan al pegar un secreto en el dashboard.
const env = (k: string) => (Deno.env.get(k) ?? "").trim().replace(/^["']+|["']+$/g, "")
const VAPID_PUBLIC_KEY = env("VAPID_PUBLIC_KEY")
const VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY")
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:soporte@nutrifit.app"
const CRON_SECRET = env("CRON_SECRET")

// Si las claves están mal formadas no se tumba el worker: se devuelve el motivo en la respuesta.
let vapidError = ""
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) }
  catch (e) { vapidError = String(e) }
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
)

function daysAgoISO(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

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
    const targetDate = daysAgoISO(3) // hace exactamente 3 días

    const { data: clients, error: clientsErr } = await supabase
      .from("clientes").select("id, name, created_at")
    if (clientsErr) throw clientsErr

    const { data: checkins, error: checkinsErr } = await supabase
      .from("daily_checkins").select("client_id, date")
    if (checkinsErr) throw checkinsErr

    const lastCheckinByClient = new Map<string, string>()
    for (const c of checkins || []) {
      const prev = lastCheckinByClient.get(c.client_id)
      if (!prev || c.date > prev) lastCheckinByClient.set(c.client_id, c.date)
    }

    const atRiskIds = (clients || [])
      .filter((c) => {
        const last = lastCheckinByClient.get(c.id)
        if (last) return last === targetDate
        // Sin check-ins nunca: avisar una vez si el cliente ya lleva 3 días de alta.
        return (c.created_at as string).slice(0, 10) === targetDate
      })
      .map((c) => c.id)

    if (atRiskIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, atRisk: 0 }), { headers: { "Content-Type": "application/json" } })
    }

    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions").select("*").in("client_id", atRiskIds)
    if (subsErr) throw subsErr

    const payload = JSON.stringify({
      title: "¿Cómo vas? 👋",
      body: "Llevas unos días sin registrar tu check-in — vuelve a la app cuando puedas.",
      url: "/",
    })

    const results = await Promise.allSettled(
      (subs || []).map((sub) =>
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

    const sent = results.filter((r) => r.status === "fulfilled").length
    return new Response(JSON.stringify({ sent, atRisk: atRiskIds.length }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
