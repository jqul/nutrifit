import { describe, it, expect } from 'vitest'
// @ts-expect-error — script .mjs sin tipos
import { buildShared, FUNCTION_TARGETS } from '../../scripts/sync-edge-shared.mjs'

// Fuente (src/lib) y copias (carpeta de cada función), leídas como texto.
const sources = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const copies = import.meta.glob('../../supabase/functions/*/shared/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const readSource = (name: string) => {
  const src = sources[`./${name}.ts`]
  if (src == null) throw new Error(`falta src/lib/${name}.ts`)
  return src
}
const targets = FUNCTION_TARGETS as Record<string, string[]>
const expectedFor = (fn: string) => buildShared(fn, readSource) as Record<string, string>
const copyOf = (fn: string, file: string) => copies[`../../supabase/functions/${fn}/shared/${file}`]

// Las funciones programadas usan copias de ficheros de src/lib (la lógica de
// alertas, la lectura paginada). Si cambias la fuente y no regeneras las copias,
// la función desplegada dejaría de coincidir con la app.
describe.each(Object.keys(targets))('copias de src/lib en %s', (fn) => {
  const expected = expectedFor(fn)

  it.each(Object.keys(expected))('%s coincide con la fuente (si falla: node scripts/sync-edge-shared.mjs)', (file) => {
    const copy = copyOf(fn, file)
    expect(copy, `falta la copia ${file}`).toBeDefined()
    expect(copy.replace(/\r\n/g, '\n')).toBe(expected[file].replace(/\r\n/g, '\n'))
  })

  it('no hay copias de más en la carpeta', () => {
    const present = Object.keys(copies).filter(k => k.startsWith(`../../supabase/functions/${fn}/shared/`)).map(k => k.split('/').pop())
    expect(present.sort()).toEqual(Object.keys(expected).sort())
  })

  it('no deja imports sin extensión que Deno no resolvería', () => {
    for (const name of targets[fn]) {
      expect(expected[`${name}.ts`]).not.toMatch(/from '\.{1,2}\/[A-Za-z0-9_-]+'/)
    }
  })
})

describe('imports de tipos', () => {
  it('se importan con import type, para no depender de la transpilación de Deno', () => {
    const e = expectedFor('send-nutricionista-alerts')
    expect(e['clientAlerts.ts']).toContain("import type { DailyCheckin, WeightEntry } from './types.ts'")
    expect(e['alertDigest.ts']).toContain("import type { AlertKind } from './clientAlerts.ts'")
    expect(e['activitySummary.ts']).toContain("import type { WeightEntry } from './types.ts'")
  })

  it('las funciones que solo paginan no necesitan los tipos de la app', () => {
    expect(Object.keys(expectedFor('send-risk-reminders'))).toEqual(['fetchAll.ts'])
  })
})
