// Recordatorio automático (vía cron diario) al nutricionista sobre
// clientes con precio mensual configurado a los que todavía no se les ha
// generado la factura de este mes — solo actúa el día 1 de cada mes para
// no avisar cada día del mismo periodo. Va al nutricionista, no al
// cliente: generar la factura es una acción suya. Reutiliza el mismo
// mecanismo de Web Push que send-push.
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
    if (now.getUTCDate() !== 1) {
      return new Response(JSON.stringify({ sent: 0, reason: "not the 1st of the month" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    const period = monthKey(now)

    const { data: clients, error: clientsErr } = await supabase
      .from("clientes").select("id, nutricionista_id").not("monthly_price", "is", null)
    if (clientsErr) throw clientsErr
    if (!clients?.length) {
      return new Response(JSON.stringify({ sent: 0, pending: 0 }), { headers: { "Content-Type": "application/json" } })
    }

    const { data: invoices, error: invoicesErr } = await supabase
      .from("invoices").select("client_id").eq("period", period)
    if (invoicesErr) throw invoicesErr
    const invoiced = new Set((invoices || []).map((i) => i.client_id))

    const pendingByNutricionista = new Map<string, number>()
    for (const c of clients) {
      if (invoiced.has(c.id)) continue
      pendingByNutricionista.set(c.nutricionista_id, (pendingByNutricionista.get(c.nutricionista_id) || 0) + 1)
    }
    if (pendingByNutricionista.size === 0) {
      return new Response(JSON.stringify({ sent: 0, pending: 0 }), { headers: { "Content-Type": "application/json" } })
    }

    let totalSent = 0
    for (const [nutricionistaId, count] of pendingByNutricionista) {
      const { data: subs } = await supabase
        .from("push_subscriptions").select("*").eq("nutricionista_id", nutricionistaId).is("client_id", null)
      if (!subs?.length) continue

      const payload = JSON.stringify({
        title: "Facturación pendiente 💳",
        body: `${count} cliente${count === 1 ? "" : "s"} con precio mensual todavía sin factura de este mes.`,
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

    return new Response(JSON.stringify({ sent: totalSent, nutricionistas: pendingByNutricionista.size }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
