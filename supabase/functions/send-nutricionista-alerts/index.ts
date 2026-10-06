// Aviso automático (vía cron diario) al NUTRICIONISTA con las alertas NUEVAS de
// sus clientes — peso estancado, hambre alta, energía baja, adherencia baja, sin
// pesar, objetivo alcanzado — y sus citas de mañana. NUNCA escribe al cliente.
//
// Un único push-resumen por nutricionista, no uno por alerta, y cada alerta se
// avisa una sola vez (estado en nutricionista_alert_state): solo vuelve a avisar
// si la alerta desaparece y reaparece. Cada nutricionista elige qué tipos recibir
// en Ajustes → Avisos (tabla nutricionista_automations; sin fila = todo activado).
//
// La lógica de las alertas es la MISMA que la del Centro de control de la app:
// shared/ son copias generadas de src/lib (node scripts/sync-edge-shared.mjs) y
// un test falla si se desincronizan.
//
// No cubre la inactividad (sin check-in): de eso ya se ocupa
// send-nutricionista-risk-alerts.
//
// POST con { "dryRun": true } calcula y devuelve los avisos SIN enviar ni guardar nada.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import webpush from "npm:web-push@3.6.7"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { computeClientAlerts } from "./shared/clientAlerts.ts"
import {
  ActiveAlert, TomorrowAppointment, alertKey, buildDigest, isAppointmentReminderEnabled, planAlertNotifications,
} from "./shared/alertDigest.ts"
import type { AutomationSettings } from "./shared/alertDigest.ts"
import type { DailyCheckin, WeightEntry } from "./shared/types.ts"
import { fetchAllRows, fetchAllRowsForIds } from "./shared/fetchAll.ts"
import { HISTORY_WINDOW_DAYS, weightsWithBounds } from "./shared/activitySummary.ts"
import type { ActivitySummary } from "./shared/activitySummary.ts"

// Recorta espacios/saltos de línea y comillas que se cuelan al pegar un secreto en el dashboard.
const env = (k: string) => (Deno.env.get(k) ?? "").trim().replace(/^["']+|["']+$/g, "")
const VAPID_PUBLIC_KEY = env("VAPID_PUBLIC_KEY")
const VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY")
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:soporte@nutrifit.app"
// Solo la llama el propio cron — mismo mecanismo y misma variable que el resto de funciones programadas.
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

// Las citas de "mañana" y su hora se calculan en la zona horaria del producto.
const TIME_ZONE = "Europe/Madrid"
const CHECKIN_WINDOW_DAYS = 21

const dayInTz = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d) // YYYY-MM-DD
const timeInTz = (d: Date) => new Intl.DateTimeFormat("es-ES", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(d)

function tomorrowInTz(): string {
  const [y, m, d] = dayInTz(new Date()).split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

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

  const body = await req.json().catch(() => ({}))
  const dryRun = body?.dryRun === true

  try {
    // Solo se calcula para quien puede recibir el aviso: nutricionistas con push activado.
    const subs = await fetchAllRows<Row>((from, to) =>
      supabase.from("push_subscriptions").select("*").is("client_id", null).not("nutricionista_id", "is", null).order("id").range(from, to))
    const subsByNutri = new Map<string, Row[]>()
    for (const s of subs || []) {
      const list = subsByNutri.get(s.nutricionista_id) || []
      list.push(s)
      subsByNutri.set(s.nutricionista_id, list)
    }

    const summary: Row[] = []
    for (const [nutricionistaId, nutriSubs] of subsByNutri) {
      try {
        summary.push(await processNutricionista(nutricionistaId, nutriSubs, dryRun))
      } catch (err) {
        // Un nutricionista con problemas no debe impedir los avisos de los demás.
        summary.push({ nutricionistaId, error: String(err) })
      }
    }

    return new Response(JSON.stringify({ dryRun, nutricionistas: summary.length, summary }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

async function processNutricionista(nutricionistaId: string, nutriSubs: Row[], dryRun: boolean): Promise<Row> {
  const { data: settingsRow } = await supabase
    .from("nutricionista_automations").select("settings").eq("nutricionista_id", nutricionistaId).maybeSingle()
  const settings = (settingsRow?.settings ?? {}) as AutomationSettings

  // Los clientes dados de baja (baja_at) no generan avisos.
  const clients = await fetchAllRows<Row>((from, to) =>
    supabase.from("clientes").select("id, name, surname, goal, goal_weight_kg, created_at")
      .eq("nutricionista_id", nutricionistaId).is("baja_at", null).order("id").range(from, to))

  // ── Alertas activas de cada cliente (misma lógica que la app) ──
  const active: ActiveAlert[] = []
  let alreadyNotified = new Set<string>()
  if (clients?.length) {
    const ids = clients.map((c: Row) => c.id)
    // PostgREST corta en silencio a 1.000 filas por consulta: todo se pagina (con orden estable)
    // y los ids se trocean. Los pesajes se piden solo de la ventana reciente; el primero y el
    // último de la historia (objetivo alcanzado, "sin pesar") vienen del resumen por cliente.
    const [checkinRows, weightRows, stateRows, activityRows] = await Promise.all([
      fetchAllRowsForIds<Row>(ids, (chunk, from, to) =>
        supabase.from("daily_checkins")
          .select("id, client_id, date, followed_plan, hunger, energy, mood, water_l, bristol_scale, bloating, abdominal_pain")
          .in("client_id", chunk).gte("date", isoDaysAgo(CHECKIN_WINDOW_DAYS)).order("date").order("id").range(from, to)),
      fetchAllRowsForIds<Row>(ids, (chunk, from, to) =>
        supabase.from("weight_logs").select("id, client_id, date, weight_kg")
          .in("client_id", chunk).gte("date", isoDaysAgo(HISTORY_WINDOW_DAYS)).order("date").order("id").range(from, to)),
      fetchAllRowsForIds<Row>(ids, (chunk, from, to) =>
        supabase.from("nutricionista_alert_state").select("client_id, kind")
          .in("client_id", chunk).order("client_id").order("kind").range(from, to)),
      fetchAllRows<ActivitySummary>((from, to) =>
        supabase.rpc("clients_activity_summary", { p_client_ids: ids }).range(from, to)),
    ])
    const activityBy = new Map<string, ActivitySummary>(activityRows.map((a) => [a.client_id, a]))

    const checkinsBy = new Map<string, DailyCheckin[]>()
    for (const r of checkinRows || []) {
      const list = checkinsBy.get(r.client_id) || []
      list.push({
        id: `${r.client_id}-${r.date}`, clientId: r.client_id, date: r.date, followedPlan: r.followed_plan,
        hunger: r.hunger, energy: r.energy, mood: r.mood, waterL: r.water_l, notes: "",
        bristolScale: r.bristol_scale, bloating: r.bloating, abdominalPain: r.abdominal_pain,
      })
      checkinsBy.set(r.client_id, list)
    }
    const weightsBy = new Map<string, WeightEntry[]>()
    for (const r of weightRows || []) {
      const list = weightsBy.get(r.client_id) || []
      list.push({ id: `${r.client_id}-${r.date}`, clientId: r.client_id, date: r.date, weightKg: Number(r.weight_kg), note: "" })
      weightsBy.set(r.client_id, list)
    }

    const today = new Date()
    for (const c of clients) {
      const alerts = computeClientAlerts({
        checkins: checkinsBy.get(c.id) || [], weights: weightsWithBounds(c.id, weightsBy.get(c.id) || [], activityBy.get(c.id)),
        goal: c.goal, goalWeightKg: c.goal_weight_kg != null ? Number(c.goal_weight_kg) : null,
        createdAt: new Date(c.created_at).getTime(),
      }, today)
      for (const a of alerts) {
        active.push({ clientId: c.id, clientName: c.name, kind: a.kind, label: a.label })
      }
    }

    alreadyNotified = new Set<string>((stateRows || []).map((r: Row) => alertKey({ clientId: r.client_id, kind: r.kind })))
  }

  const plan = planAlertNotifications(active, alreadyNotified, settings)

  // ── Citas de mañana ──
  const appointmentsTomorrow: TomorrowAppointment[] = []
  if (isAppointmentReminderEnabled(settings)) {
    const tomorrow = tomorrowInTz()
    const lo = new Date(`${tomorrow}T00:00:00Z`); lo.setUTCHours(lo.getUTCHours() - 3)
    const hi = new Date(`${tomorrow}T23:59:59Z`); hi.setUTCHours(hi.getUTCHours() + 3)
    const { data: appts, error: apptErr } = await supabase
      .from("appointments").select("title, client_id, start_at, status")
      .eq("nutricionista_id", nutricionistaId).neq("status", "cancelada")
      .gte("start_at", lo.toISOString()).lte("start_at", hi.toISOString()).order("start_at")
    if (apptErr) throw apptErr
    const nameById = new Map((clients || []).map((c: Row) => [c.id, `${c.name} ${c.surname}`.trim()]))
    for (const a of appts || []) {
      const start = new Date(a.start_at)
      if (dayInTz(start) !== tomorrow) continue
      appointmentsTomorrow.push({ time: timeInTz(start), clientName: a.client_id ? nameById.get(a.client_id) ?? null : null, title: a.title })
    }
  }

  const digest = buildDigest(plan.toNotify, appointmentsTomorrow)

  const result: Row = {
    nutricionistaId, activeAlerts: active.length, newAlerts: plan.toNotify.length, toClear: plan.keysToClear.length,
    appointmentsTomorrow: appointmentsTomorrow.length, digest,
  }
  if (dryRun) return result

  // ── Envío y estado ──
  let delivered = 0
  if (digest) {
    const payload = JSON.stringify({ title: digest.title, body: digest.body, url: "/" })
    const results = await Promise.allSettled(
      nutriSubs.map((sub) =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
          // deno-lint-ignore no-explicit-any
          .catch(async (err: any) => {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id)
            }
            throw err
          })
      ),
    )
    delivered = results.filter((r) => r.status === "fulfilled").length
  }
  result.delivered = delivered

  // Las alertas solo se marcan como avisadas si el aviso llegó a algún dispositivo;
  // si no, se reintenta mañana en vez de perderlas.
  if (plan.toNotify.length > 0 && delivered > 0) {
    const { error } = await supabase.from("nutricionista_alert_state").upsert(
      plan.toNotify.map((a) => ({ client_id: a.clientId, kind: a.kind })), { onConflict: "client_id,kind", ignoreDuplicates: true })
    if (error) throw error
  }
  // Lo que dejó de estar activo se olvida (siempre), para avisar si reaparece.
  for (const key of plan.keysToClear) {
    const [clientId, kind] = key.split(":")
    await supabase.from("nutricionista_alert_state").delete().eq("client_id", clientId).eq("kind", kind)
  }
  return result
}
