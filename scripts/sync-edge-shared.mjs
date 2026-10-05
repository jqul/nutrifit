// Copia a las funciones programadas el MISMO código de src/lib que usa la app
// (las alertas, para que el aviso diario al nutricionista y el Centro de control
// nunca puedan discrepar; la lectura paginada, para no caer en el corte de 1.000 filas). Las funciones de Supabase corren
// en Deno, que exige extensión en los imports relativos y no entiende '../types'
// de la app, así que se generan copias con esos imports ajustados.
//
//   node scripts/sync-edge-shared.mjs          → regenera las copias
//
// src/lib/edgeShared.test.ts falla si las copias no coinciden con la fuente,
// así que olvidarse de regenerarlas no pasa desapercibido.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const SOURCE_DIR = join(root, 'src/lib')
export const FUNCTIONS_DIR = join(root, 'supabase/functions')

// Qué ficheros de src/lib copia cada función (en orden de dependencia). Solo se
// copia lo que usa: las que no necesitan los tipos de la app no reciben types.ts.
export const FUNCTION_TARGETS = {
  'send-nutricionista-alerts': ['date', 'adherence', 'checkinSignals', 'weightProgress', 'clientAlerts', 'alertDigest', 'fetchAll', 'activitySummary'],
  'send-risk-reminders': ['fetchAll'],
  'send-nutricionista-risk-alerts': ['fetchAll'],
  'send-billing-reminders': ['fetchAll'],
}
export const targetDir = (fn) => join(FUNCTIONS_DIR, fn, 'shared')

const HEADER = '// GENERADO por scripts/sync-edge-shared.mjs a partir de src/lib/{name}.ts — NO EDITAR A MANO.\n'

// Solo los tipos que usan estos ficheros (en la app viven en src/types/index.ts).
const TYPES = `${HEADER.replace('src/lib/{name}.ts', 'src/types/index.ts (subconjunto)')}export type FollowedPlan = 'si' | 'parcial' | 'no'

export interface DailyCheckin {
  id: string
  clientId: string
  date: string
  followedPlan: FollowedPlan
  hunger: number
  energy: number
  mood: number
  waterL: number | null
  notes: string
  bristolScale?: number | null
  bloating?: number | null
  abdominalPain?: number | null
}

export interface WeightEntry {
  id: string
  clientId: string
  date: string
  weightKg: number
  note: string
}
`

/** Adapta un fichero de src/lib a Deno: imports con extensión y de solo tipos explícitos. */
export function toDeno(name, source) {
  const body = source
    .replace(/\r\n/g, '\n')
    // tipos de la app → el subconjunto generado
    .replace(/import \{([^}]*)\} from '\.\.\/types'/g, "import type {$1} from './types.ts'")
    // imports relativos: Deno necesita la extensión
    .replace(/from '(\.\/[A-Za-z0-9_-]+)'/g, "from '$1.ts'")
    // alertDigest solo importa un tipo de clientAlerts
    .replace(/import \{ AlertKind \} from '\.\/clientAlerts\.ts'/, "import type { AlertKind } from './clientAlerts.ts'")
  return HEADER.replace('{name}', name) + body
}

/** Mapa nombre de fichero → contenido que debe tener en la carpeta de la función. */
export function buildShared(fn, readSource = (n) => readFileSync(join(SOURCE_DIR, `${n}.ts`), 'utf8')) {
  const files = FUNCTION_TARGETS[fn]
  if (!files) throw new Error(`función desconocida: ${fn}`)
  const out = {}
  // Solo se genera types.ts si algún fichero copiado importa los tipos de la app.
  const sources = Object.fromEntries(files.map((n) => [n, readSource(n)]))
  if (Object.values(sources).some((s) => s.includes("from '../types'"))) out['types.ts'] = TYPES
  for (const name of files) out[`${name}.ts`] = toDeno(name, sources[name])
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const fn of Object.keys(FUNCTION_TARGETS)) {
    const dir = targetDir(fn)
    mkdirSync(dir, { recursive: true })
    for (const [file, content] of Object.entries(buildShared(fn))) writeFileSync(join(dir, file), content)
    console.log(`Copias generadas en ${dir}`)
  }
}
