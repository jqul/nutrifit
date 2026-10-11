import { describe, expect, it } from 'vitest'
import { searchHelp } from './helpSearch'
import { HELP_TOPICS } from '../help/topics'

const topics = [
  { slug: 'a', title: 'Clientes', raw: '# Clientes\n\n## Crear un cliente\n\nPulsa **Nuevo cliente** y rellena el peso.\n\n## Dar de baja\n\nEn el Perfil, **Dar de baja**.' },
  { slug: 'b', title: 'Planes', raw: '# Planes\n\n## Guardar\n\nPulsa **Guardar plan**. El peso no cambia.' },
]

describe('searchHelp', () => {
  it('finds the section that talks about it, ignoring accents and case', () => {
    const hits = searchHelp(topics, 'BAJA')
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ slug: 'a', heading: 'Dar de baja', topicTitle: 'Clientes' })
  })
  it('needs every word, and puts the sections whose title matches first', () => {
    expect(searchHelp(topics, 'guardar plan').map(h => h.heading)).toEqual(['Guardar'])
    expect(searchHelp(topics, 'peso').map(h => h.slug)).toEqual(['a', 'b'])
    expect(searchHelp(topics, 'crear cliente')[0].heading).toBe('Crear un cliente')
  })
  it('returns nothing for an empty or too short search or when nothing matches', () => {
    expect(searchHelp(topics, '')).toEqual([])
    expect(searchHelp(topics, 'a')).toEqual([])
    expect(searchHelp(topics, 'de')).toEqual([])
    expect(searchHelp(topics, 'zzzz')).toEqual([])
  })
  it('works on the real guide', () => {
    const hits = searchHelp(HELP_TOPICS, 'historial de peso')
    expect(hits.some(h => h.slug === 'clientes')).toBe(true)
  })
})

describe('the guide itself', () => {
  it('has unique slugs and every topic starts with a title and has content', () => {
    expect(new Set(HELP_TOPICS.map(t => t.slug)).size).toBe(HELP_TOPICS.length)
    for (const t of HELP_TOPICS) {
      expect(t.raw.trimStart().startsWith('# '), t.slug).toBe(true)
      expect(t.raw.length, t.slug).toBeGreaterThan(300)
    }
  })
  it('does not leave template placeholders for the legal data', () => {
    for (const t of HELP_TOPICS) expect(t.raw, t.slug).not.toMatch(/\{\{(titular|nif|domicilio|email|plazo)/)
  })
})
