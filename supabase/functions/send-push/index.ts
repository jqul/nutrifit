// Envía una notificación push real a las suscripciones de un nutricionista o cliente.
// Requiere los secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
// configurados en el proyecto de Supabase (Project Settings → Edge Functions → Secrets).
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

// Esta función la invoca directamente el navegador (supabase.functions.invoke),
// a diferencia de send-risk-reminders/send-survey-reminders que solo llama el
// cron por servidor — sin estas cabeceras el preflight OPTIONS falla por CORS
// y el push nunca llega a dispararse.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500, headers: corsHeaders })
  }

  try {
    const { nutricionistaId, clientId, title, body, url } = await req.json()
    if (!nutricionistaId && !clientId) {
      return new Response(JSON.stringify({ error: "nutricionistaId or clientId required" }), { status: 400, headers: corsHeaders })
    }

    let query = supabase.from("push_subscriptions").select("*")
    query = nutricionistaId ? query.eq("nutricionista_id", nutricionistaId) : query.eq("client_id", clientId)
    const { data: subs, error } = await query
    if (error) throw error

    const payload = JSON.stringify({ title: title || "NutriFit", body: body || "", url: url || "/" })

    const results = await Promise.allSettled(
      (subs || []).map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ).catch(async (err: any) => {
          // Suscripción caducada o inválida -> limpiar
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id)
          }
          throw err
        })
      )
    )

    const sent = results.filter((r) => r.status === "fulfilled").length
    return new Response(JSON.stringify({ sent, total: subs?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
