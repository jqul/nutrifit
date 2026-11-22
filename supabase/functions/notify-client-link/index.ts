// Avisa al PROFESIONAL (push) cuando una ficha se vincula a una cuenta, o cuando hay una solicitud pendiente de su aprobación.
// Lee la bandeja de salida client_link_notifications (la rellena la base de datos al registrar el evento; ver 0077_vinculacion_segura.sql) con
// ARRENDAMIENTO (take_link_notifications / finish_link_notification: dos ejecuciones simultáneas no reciben el mismo aviso, y uno que falla se
// reintenta hasta 5 veces). Sin información clínica: solo ficha, fecha y método de verificación (ver message.ts). La lógica está en process.ts.
//
// POST sin cuerpo. Solo la llama el cron (cabecera x-cron-secret), igual que el resto de funciones programadas:
// se programa CLONANDO el comando de un job que ya funciona (no se escribe el secreto en SQL), p. ej. cada 5 minutos:
//   do $$ declare cmd text; begin
//     select command into cmd from cron.job where jobname = 'nutrifit-nutricionista-alerts-daily';
//     cmd := replace(cmd, 'send-nutricionista-alerts', 'notify-client-link');
//     perform cron.schedule('nutrifit-notify-client-link', '*/5 * * * *', cmd);
//   end $$;
// (Pendiente de crear al desplegar la función; NO lo hace ninguna migración.) Mientras no exista, el profesional ve igualmente la solicitud y el
// historial en la ficha de la clienta: el push es un aviso adicional, no la única vía.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import webpush from "npm:web-push@3.6.7"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { processNotifications, type Deps } from "./process.ts"

const env = (k: string) => (Deno.env.get(k) ?? "").trim().replace(/^["']+|["']+$/g, "")
const VAPID_PUBLIC_KEY = env("VAPID_PUBLIC_KEY")
const VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY")
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:soporte@nutrifit.app"
const CRON_SECRET = env("CRON_SECRET")

let vapidError = ""
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) } catch (e) { vapidError = String(e) }
}
const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")

const deps: Deps = {
  async take(limit) {
    const { data, error } = await supabase.rpc("take_link_notifications", { p_limit: limit })
    if (error) throw error
    return data ?? []
  },
  async clientName(clientId) {
    const { data } = await supabase.from("clientes").select("name, surname").eq("id", clientId).maybeSingle()
    return [data?.name, data?.surname].filter(Boolean).join(" ")
  },
  async subscriptions(nutricionistaId) {
    const { data, error } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("nutricionista_id", nutricionistaId).is("client_id", null)
    if (error) throw error
    return data ?? []
  },
  async send(sub, payload) {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
  },
  async removeSubscription(id) {
    await supabase.from("push_subscriptions").delete().eq("id", id)
  },
  async finish(id, sent, error) {
    await supabase.rpc("finish_link_notification", { p_id: id, p_sent: sent, p_error: error })
  },
}

Deno.serve(async (req: Request) => {
  // Fail-closed: sin CRON_SECRET configurado, la función no responde a nadie.
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return new Response("Unauthorized", { status: 401 })
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || vapidError) {
    return new Response(JSON.stringify({ error: vapidError || "VAPID keys not configured" }), { status: 500 })
  }
  try {
    return new Response(JSON.stringify(await processNotifications(deps)), { headers: { "Content-Type": "application/json" } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
