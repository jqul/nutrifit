// Recordatorio automático (vía cron diario) al NUTRICIONISTA sobre
// clientes en riesgo de abandono — a diferencia de send-risk-reminders
// (que avisa al propio cliente a los 3 días sin check-in), este avisa al
// profesional un día después (4 días) si el cliente sigue sin volver, para
// que pueda intervenir personalmente. Un único aviso por episodio de
// inactividad, agrupado por nutricionista (no uno por cliente, para no
// saturar). Reutiliza el mismo mecanismo de Web Push que send-push.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import webpush from "npm:web-push@3.6.7"
import { createClient } from "jsr:@supabase/supabase-js@2"

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? ""
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:soporte@nutrifit.app"

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
)

// Un día después del recordatorio al propio cliente (send-risk-reminders
// actúa a los 3 días) — si para entonces sigue sin volver, es cuando de
// verdad conviene que el nutricionista lo sepa y pueda escribirle.
const NUTRICIONISTA_ALERT_DAYS = 4

function daysAgoISO(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500 })
  }

  try {
    const targetDate = daysAgoISO(NUTRICIONISTA_ALERT_DAYS)

    const { data: clients, error: clientsErr } = await supabase
      .from("clientes").select("id, name, surname, nutricionista_id, created_at")
    if (clientsErr) throw clientsErr

    const { data: checkins, error: checkinsErr } = await supabase
      .from("daily_checkins").select("client_id, date")
    if (checkinsErr) throw checkinsErr

    const lastCheckinByClient = new Map<string, string>()
    for (const c of checkins || []) {
      const prev = lastCheckinByClient.get(c.client_id)
      if (!prev || c.date > prev) lastCheckinByClient.set(c.client_id, c.date)
    }

    const atRisk = (clients || []).filter((c) => {
      const last = lastCheckinByClient.get(c.id)
      if (last) return last === targetDate
      // Sin check-ins nunca: avisar una vez, cuando lleve exactamente
      // NUTRICIONISTA_ALERT_DAYS días de alta.
      return (c.created_at as string).slice(0, 10) === targetDate
    })

    if (atRisk.length === 0) {
      return new Response(JSON.stringify({ sent: 0, atRisk: 0 }), { headers: { "Content-Type": "application/json" } })
    }

    const byNutricionista = new Map<string, string[]>()
    for (const c of atRisk) {
      const name = `${c.name} ${c.surname}`.trim()
      const list = byNutricionista.get(c.nutricionista_id) || []
      list.push(name)
      byNutricionista.set(c.nutricionista_id, list)
    }

    let totalSent = 0
    for (const [nutricionistaId, names] of byNutricionista) {
      const { data: subs } = await supabase
        .from("push_subscriptions").select("*").eq("nutricionista_id", nutricionistaId).is("client_id", null)
      if (!subs?.length) continue

      const body = names.length === 1
        ? `${names[0]} lleva ${NUTRICIONISTA_ALERT_DAYS} días sin check-in.`
        : `${names.length} clientes llevan ${NUTRICIONISTA_ALERT_DAYS} días sin check-in: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "..." : ""}`

      const payload = JSON.stringify({ title: "Clientes en riesgo 🚨", body, url: "/" })

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

    return new Response(JSON.stringify({ sent: totalSent, atRisk: atRisk.length, nutricionistas: byNutricionista.size }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
