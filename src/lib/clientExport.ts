// Exportación completa de los datos de un cliente (derecho de acceso y portabilidad,
// RGPD). Reúne TODAS las tablas donde guardamos datos suyos —no solo las evidentes—
// más enlaces temporales a sus ficheros (fotos, analíticas en PDF).
//
// Es una función pura con una "fuente" inyectable (ExportSource) para poder probarla
// con una base falsa. Si falla cualquier tabla se lanza un error en vez de entregar un
// archivo incompleto en silencio: un export a medias es peor que ninguno.
import { ClientData } from '../types'
import { storagePathFromValue } from '../../supabase/functions/delete-client/storagePaths'

type Row = Record<string, unknown>

export interface ExportTable {
  table: string
  /** Columna por la que se ordena (además de `id`) para paginar con estabilidad. */
  order: string
}

/**
 * Tablas con datos del cliente (columna client_id). Un test comprueba que cada
 * tabla con client_id de las migraciones está aquí o en EXPORT_EXCLUDED, para que
 * una tabla nueva no se quede fuera sin que nadie lo decida.
 */
export const EXPORT_TABLES: ExportTable[] = [
  { table: 'anamnesis', order: 'completed_at' },
  { table: 'appointments', order: 'start_at' },
  { table: 'blood_markers', order: 'date' },
  { table: 'client_clinical_notes', order: 'date' },
  { table: 'client_reviews', order: 'week_start' },
  { table: 'cycle_logs', order: 'start_date' },
  { table: 'daily_checkins', order: 'date' },
  { table: 'diet_plan_changes', order: 'changed_at' },
  { table: 'diet_plan_versions', order: 'version_number' },
  { table: 'diet_plans', order: 'created_at' },
  { table: 'invoices', order: 'created_at' },
  { table: 'lab_reports', order: 'date' },
  { table: 'meal_logs', order: 'created_at' },
  { table: 'progress_photos', order: 'date' },
  { table: 'survey_responses', order: 'submitted_at' },
  { table: 'weight_logs', order: 'date' },
]

/** Tablas con client_id que NO se exportan, y por qué. */
export const EXPORT_EXCLUDED: Record<string, string> = {
  push_subscriptions: 'Datos técnicos del dispositivo para las notificaciones, sin contenido del cliente.',
  nutricionista_alert_state: 'Estado interno de los avisos al nutricionista; no contiene datos del cliente.',
}

export interface ExportSource {
  /** Todas las filas de `table` cuyo `column` esté en `values` (la fuente se encarga de paginar). */
  rows(table: string, column: string, values: string[], order: string): Promise<Row[]>
  /** Enlaces temporales a ficheros de un bucket; signedUrl null si no se pudo firmar. */
  signedUrls(bucket: string, paths: string[], expiresInSeconds: number): Promise<{ path: string; signedUrl: string | null }[]>
}

export interface ExportFile { bucket: string; path: string; tipo: string; enlace: string | null }

export interface ClientExportBundle {
  formato: 'nutrifit-export-v2'
  exportedAt: string
  aviso: string
  client: ClientData
  datos: Record<string, Row[]>
  planesDeDieta: (Row & { comidas: Row[]; suplementos: Row[] })[]
  encuestas: Row[]
  archivos: ExportFile[]
  noIncluido: Record<string, string>
}

export const FILE_LINK_DAYS = 7

const chunked = <T,>(xs: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out }

export async function collectClientExport(client: ClientData, src: ExportSource, now = new Date()): Promise<ClientExportBundle> {
  const failed: string[] = []
  const guard = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn() } catch { failed.push(label); return fallback }
  }

  // 1) Todas las tablas con client_id.
  const datos: Record<string, Row[]> = {}
  await Promise.all(EXPORT_TABLES.map(async ({ table, order }) => {
    datos[table] = await guard(table, () => src.rows(table, 'client_id', [client.id], order), [])
  }))

  // 2) Planes con sus comidas, alimentos y suplementos (cuelgan de plan_id / meal_id).
  const plans = datos.diet_plans ?? []
  const planIds = plans.map(p => String(p.id))
  const meals = planIds.length ? await guard('diet_meals', () => src.rows('diet_meals', 'plan_id', planIds, 'sort_order'), []) : []
  const supplements = planIds.length ? await guard('diet_supplements', () => src.rows('diet_supplements', 'plan_id', planIds, 'name'), []) : []
  const mealIds = meals.map(m => String(m.id))
  const items = mealIds.length ? await guard('diet_meal_items', () => src.rows('diet_meal_items', 'meal_id', mealIds, 'sort_order'), []) : []
  const planesDeDieta = plans.map(p => ({
    ...p,
    comidas: meals.filter(m => m.plan_id === p.id).map(m => ({ ...m, alimentos: items.filter(i => i.meal_id === m.id) })),
    suplementos: supplements.filter(s => s.plan_id === p.id),
  }))

  // 3) Definición de las encuestas que contestó (sus respuestas solo se entienden con ellas).
  const surveyIds = [...new Set((datos.survey_responses ?? []).map(r => String(r.survey_id)))]
  const encuestas = surveyIds.length ? await guard('custom_surveys', () => src.rows('custom_surveys', 'id', surveyIds, 'created_at'), []) : []

  // 4) Ficheros: fotos de progreso y de comidas, PDFs de analíticas.
  const wanted: { bucket: string; path: string; tipo: string }[] = []
  const add = (bucket: string, value: unknown, tipo: string) => {
    const path = storagePathFromValue(value, bucket)
    if (path) wanted.push({ bucket, path, tipo })
  }
  for (const r of datos.progress_photos ?? []) {
    add('photos', r.front_url, `foto de progreso (frontal) ${r.date}`)
    add('photos', r.side_url, `foto de progreso (perfil) ${r.date}`)
    add('photos', r.back_url, `foto de progreso (espalda) ${r.date}`)
  }
  for (const r of datos.meal_logs ?? []) add('photos', r.photo_url, `foto de comida ${r.date} · ${r.meal_name}`)
  for (const r of datos.lab_reports ?? []) add('lab-reports', r.file_path, `informe de analítica ${r.date}`)

  const archivos: ExportFile[] = []
  for (const bucket of ['photos', 'lab-reports']) {
    const ofBucket = wanted.filter(w => w.bucket === bucket)
    for (const batch of chunked(ofBucket, 100)) {
      const signed = await guard(`enlaces de ${bucket}`, () => src.signedUrls(bucket, batch.map(b => b.path), FILE_LINK_DAYS * 86400), [])
      for (const w of batch) archivos.push({ ...w, enlace: signed.find(s => s.path === w.path)?.signedUrl ?? null })
    }
  }

  if (failed.length > 0) {
    throw new Error(`No se pudo exportar de forma completa. Falló: ${[...new Set(failed)].join(', ')}`)
  }

  return {
    formato: 'nutrifit-export-v2',
    exportedAt: now.toISOString(),
    aviso: `Copia de los datos de ${client.name} ${client.surname} guardados en NutriFit. Los enlaces de "archivos" caducan a los ${FILE_LINK_DAYS} días: descárgalos al momento.`,
    client,
    datos,
    planesDeDieta,
    encuestas,
    archivos,
    noIncluido: EXPORT_EXCLUDED,
  }
}
