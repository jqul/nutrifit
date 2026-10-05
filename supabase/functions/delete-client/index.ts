// Eliminación COMPLETA de un cliente (derecho de supresión, RGPD): sus ficheros
// del almacenamiento, su ficha con todo lo que cuelga de ella y su cuenta de acceso.
//
// Por qué hace falta una función: borrar la fila de `clientes` arrastra las 18
// tablas con sus datos (ON DELETE CASCADE), pero NO toca (a) los ficheros de los
// buckets `photos` y `lab-reports` —fotos de progreso, fotos de comidas, PDFs de
// analíticas— ni (b) la cuenta de acceso del cliente en auth.users (con su
// email). Los ficheros no se pueden borrar por SQL (hay un trigger que lo
// impide) y la cuenta solo con la API de administración, así que se hace aquí,
// con la service role, DESPUÉS de comprobar quién llama.
//
// Autorización: el JWT de quien llama se usa para leer la ficha con RLS; si no
// la ve (no es su nutricionista ni super-admin) responde 404 sin revelar nada.
//
// Orden: primero los ficheros, luego la ficha, por último la cuenta. Si borrar
// ficheros falla se para ANTES de tocar la base de datos, para poder reintentar
// (si se borrase antes la ficha, ya no habría forma de saber qué ficheros eran).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { CLIENT_FILE_BUCKETS, chunk, isUuid, listFilesRecursive, onlyUnderFolder, storagePathFromValue, uniquePaths } from "./storagePaths.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")

// La invoca el navegador (supabase.functions.invoke): sin estas cabeceras el preflight falla por CORS.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

/** Todos los ficheros de un bucket bajo una carpeta. */
const listFiles = (bucket: string, prefix: string) =>
  listFilesRecursive(async (p, offset, limit) => {
    const { data, error } = await admin.storage.from(bucket).list(p, { limit, offset })
    if (error) throw new Error(`No se pudo listar ${bucket}/${p}: ${error.message}`)
    return data ?? []
  }, prefix)

async function removeFiles(bucket: string, paths: string[]): Promise<number> {
  let removed = 0
  for (const batch of chunk(paths, 100)) {
    const { data, error } = await admin.storage.from(bucket).remove(batch)
    if (error) throw new Error(`No se pudieron borrar ficheros de ${bucket}: ${error.message}`)
    removed += data?.length ?? 0
  }
  return removed
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim()
    if (!jwt) return json({ error: "No autenticado" }, 401)

    const asCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await asCaller.auth.getUser(jwt)
    if (authErr || !user) return json({ error: "No autenticado" }, 401)

    const { clientId } = await req.json().catch(() => ({}))
    if (!isUuid(clientId)) return json({ error: "clientId inválido" }, 400)

    // RLS: solo su nutricionista (o un super-admin) ve esta ficha.
    const { data: client } = await asCaller.from("clientes")
      .select("id, nutricionista_id, auth_user_id").eq("id", clientId).maybeSingle()
    if (!client) return json({ error: "Cliente no encontrado" }, 404)

    // En modo personal la ficha es la propia cuenta del usuario: borrarla dejaría la
    // cuenta huérfana. Eso se trata aparte (ver PersonalModeShell), no desde aquí.
    if (client.auth_user_id && client.auth_user_id === client.nutricionista_id) {
      return json({ error: "Las fichas del modo personal no se eliminan desde aquí" }, 400)
    }

    // ── 1) Ficheros: todo lo que cuelga de la carpeta del cliente + las rutas que guardan sus filas ──
    const [{ data: photoRows }, { data: mealRows }, { data: labRows }] = await Promise.all([
      admin.from("progress_photos").select("front_url, side_url, back_url").eq("client_id", clientId),
      admin.from("meal_logs").select("photo_url").eq("client_id", clientId),
      admin.from("lab_reports").select("file_path").eq("client_id", clientId),
    ])
    const referenced: Record<string, (string | null)[]> = {
      "photos": [
        ...(photoRows ?? []).flatMap((r: Row) => [r.front_url, r.side_url, r.back_url]),
        ...(mealRows ?? []).map((r: Row) => r.photo_url),
      ].map((v) => storagePathFromValue(v, "photos")),
      "lab-reports": (labRows ?? []).map((r: Row) => storagePathFromValue(r.file_path, "lab-reports")),
    }

    let filesRemoved = 0
    for (const bucket of CLIENT_FILE_BUCKETS) {
      // Las rutas que guardan las filas solo cuentan si cuelgan de la carpeta de ESTE cliente (ver onlyUnderFolder).
      const paths = uniquePaths([...(await listFiles(bucket, clientId)), ...onlyUnderFolder(uniquePaths(referenced[bucket] ?? []), clientId)])
      filesRemoved += await removeFiles(bucket, paths)
    }

    // ── 2) La ficha: arrastra en cascada las 18 tablas con datos del cliente ──
    const { error: deleteErr } = await admin.from("clientes").delete().eq("id", clientId)
    if (deleteErr) throw new Error(`No se pudo borrar la ficha: ${deleteErr.message}`)

    // ── 3) Su cuenta de acceso, salvo que sea también la de un nutricionista ──
    // Si solo falla este último paso, lo ya borrado (ficheros y ficha) sigue borrado: se avisa en vez de dar error.
    let accountDeleted = false
    let accountError: string | undefined
    if (client.auth_user_id) {
      const { data: isNutri } = await admin.from("nutricionistas").select("uid").eq("uid", client.auth_user_id).maybeSingle()
      if (!isNutri) {
        const { error } = await admin.auth.admin.deleteUser(client.auth_user_id)
        if (error) accountError = error.message
        else accountDeleted = true
      }
    }

    return json({ ok: true, filesRemoved, accountDeleted, accountError })
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500)
  }
})
