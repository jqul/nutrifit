// Recordatorio automático (vía cron diario) de encuestas recurrentes
// (semanales/mensuales) pendientes. Solo actúa en el día en que arranca un
// periodo nuevo (lunes para semanales, día 1 para mensuales) para no avisar
// cada día del mismo periodo — reutiliza el mecanismo de Web Push de send-push.
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

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500 })
  }

  try {
    const now = new Date()
    const isMonday = now.getUTCDay() === 1
    const isFirstOfMonth = now.getUTCDate() === 1

    const dueFrequencies: ("weekly" | "monthly")[] = []
    if (isMonday) dueFrequencies.push("weekly")
    if (isFirstOfMonth) dueFrequencies.push("monthly")

    if (dueFrequencies.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "not a period boundary day" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    const { data: surveys, error: surveysErr } = await supabase
      .from("custom_surveys").select("*").eq("active", true).in("frequency", dueFrequencies)
    if (surveysErr) throw surveysErr
    if (!surveys?.length) {
      return new Response(JSON.stringify({ sent: 0, surveys: 0 }), { headers: { "Content-Type": "application/json" } })
    }

    let totalSent = 0
    for (const survey of surveys) {
      const periodKey = survey.frequency === "weekly" ? isoWeekKey(now) : monthKey(now)

      const { data: clients, error: clientsErr } = await supabase
        .from("clientes").select("id").eq("nutricionista_id", survey.nutricionista_id)
      if (clientsErr) throw clientsErr
      if (!clients?.length) continue

      const { data: existingResponses } = await supabase
        .from("survey_responses").select("client_id")
        .eq("survey_id", survey.id).eq("period_key", periodKey)
      const answered = new Set((existingResponses || []).map((r) => r.client_id))
      const pendingClientIds = clients.map((c) => c.id).filter((id) => !answered.has(id))
      if (pendingClientIds.length === 0) continue

      const { data: subs } = await supabase
        .from("push_subscriptions").select("*").in("client_id", pendingClientIds)
      if (!subs?.length) continue

      const payload = JSON.stringify({
        title: "Nueva encuesta disponible 📋",
        body: `"${survey.name}" te está esperando — tómate un minuto para rellenarla.`,
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

    return new Response(JSON.stringify({ sent: totalSent, surveys: surveys.length }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
