// Envía una notificación push real a las suscripciones de un nutricionista o cliente.
// Requiere los secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
// configurados en el proyecto de Supabase (Project Settings → Edge Functions → Secrets).
//
// Autorización: esta función usa SUPABASE_SERVICE_ROLE_KEY para leer
// push_subscriptions, así que salta RLS por completo — sin comprobar quién
// llama, cualquier usuario autenticado (o no) podría pedir un push para el
// nutricionistaId/clientId que quisiera. Por eso, antes de nada, se valida
// el JWT del que llama contra un cliente Supabase aparte (con la anon key,
// no la service role) y se comprueba que:
//   - si se pide push a un clientId, quien llama es EL NUTRICIONISTA dueño
//     de ese cliente (así es como lo usa hoy la app: CalendarTab,
//     DifusionTab, PlanDietaTab, SurveyManager),
//   - si se pide push a un nutricionistaId, quien llama es ESE MISMO
//     nutricionista o UN CLIENTE SUYO (así lo usa HoyTab al pedir cita).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import webpush from "npm:web-push@3.6.7"
import { createClient } from "jsr:@supabase/supabase-js@2"

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? ""
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? ""
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:soporte@nutrifit.app"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")

// Límites defensivos — esto acaba en una notificación nativa del sistema
// operativo, no en HTML, así que no hay riesgo de XSS, pero sí de spam con
// textos larguísimos o de "url" usada para abrir cualquier destino externo
// al pulsar la notificación.
function sanitizeText(v: unknown, maxLen: number): string {
  return typeof v === "string" ? v.slice(0, maxLen) : ""
}
function sanitizeUrl(v: unknown): string {
  return typeof v === "string" && v.startsWith("/") ? v.slice(0, 200) : "/"
}

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
    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim()
    if (!jwt) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: corsHeaders })

    const supabaseAsCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await supabaseAsCaller.auth.getUser(jwt)
    if (authErr || !user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: corsHeaders })

    const { nutricionistaId, clientId, title, body, url } = await req.json()
    if (!nutricionistaId && !clientId) {
      return new Response(JSON.stringify({ error: "nutricionistaId or clientId required" }), { status: 400, headers: corsHeaders })
    }

    if (clientId) {
      // Solo el nutricionista dueño de este cliente puede pedirle un push.
      const { data: cliente } = await supabase.from("clientes").select("nutricionista_id").eq("id", clientId).maybeSingle()
      if (!cliente || cliente.nutricionista_id !== user.id) {
        return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403, headers: corsHeaders })
      }
    } else if (user.id !== nutricionistaId) {
      // Push a un nutricionista: vale si quien llama es él mismo, o un cliente suyo.
      const { data: propioCliente } = await supabase.from("clientes")
        .select("id").eq("auth_user_id", user.id).eq("nutricionista_id", nutricionistaId).maybeSingle()
      if (!propioCliente) {
        return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403, headers: corsHeaders })
      }
    }

    let query = supabase.from("push_subscriptions").select("*")
    query = nutricionistaId ? query.eq("nutricionista_id", nutricionistaId) : query.eq("client_id", clientId)
    const { data: subs, error } = await query
    if (error) throw error

    const payload = JSON.stringify({
      title: sanitizeText(title, 100) || "NutriFit",
      body: sanitizeText(body, 300),
      url: sanitizeUrl(url),
    })

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
