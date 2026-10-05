import { describe, it, expect } from 'vitest'
// @ts-expect-error — script .mjs sin tipos
import { buildShared, SHARED_FILES } from '../../scripts/sync-edge-shared.mjs'

// Fuente (src/lib) y copias (carpeta de la función), leídas como texto.
const sources = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const copies = import.meta.glob('../../supabase/functions/send-nutricionista-alerts/shared/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const readSource = (name: string) => {
  const src = sources[`./${name}.ts`]
  if (src == null) throw new Error(`falta src/lib/${name}.ts`)
  return src
}
const expected = buildShared(readSource) as Record<string, string>
const copyOf = (file: string) => copies[`../../supabase/functions/send-nutricionista-alerts/shared/${file}`]

// La función programada send-nutricionista-alerts usa copias de estos ficheros
// de src/lib. Si cambias la lógica de alertas y no regeneras las copias, el
// aviso diario dejaría de coincidir con el Centro de control.
describe('copias de la lógica de alertas para la función programada', () => {
  it.each(Object.keys(expected))('%s coincide con la fuente (si falla: node scripts/sync-edge-shared.mjs)', (file) => {
    const copy = copyOf(file)
    expect(copy, `falta la copia ${file}`).toBeDefined()
    expect(copy.replace(/\r\n/g, '\n')).toBe(expected[file].replace(/\r\n/g, '\n'))
  })

  it('no deja imports sin extensión que Deno no resolvería', () => {
    for (const name of SHARED_FILES as string[]) {
      expect(expected[`${name}.ts`]).not.toMatch(/from '\.{1,2}\/[A-Za-z0-9_-]+'/)
    }
  })

  it('importa los tipos con import type, para no depender de la transpilación de Deno', () => {
    expect(expected['clientAlerts.ts']).toContain("import type { DailyCheckin, WeightEntry } from './types.ts'")
    expect(expected['alertDigest.ts']).toContain("import type { AlertKind } from './clientAlerts.ts'")
  })
})
