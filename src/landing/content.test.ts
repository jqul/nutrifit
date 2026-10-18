import { describe, expect, it } from 'vitest'
import { FAQ, FEATURE_GROUPS, FINAL_CTA, HERO, PAINS, STEPS } from './content'

const allText = [
  HERO.eyebrow, HERO.titleLine1, HERO.titleAccent, HERO.titleLine2, HERO.subtitle, ...HERO.proof,
  ...PAINS.flatMap(p => [p.title, p.text]), ...STEPS.flatMap(s => [s.title, s.text]),
  ...FEATURE_GROUPS.flatMap(g => [g.label, g.title, ...g.items.flatMap(i => [i.title, i.text])]),
  ...FAQ.flatMap(f => [f.q, f.a]), FINAL_CTA.title, FINAL_CTA.text,
].join('\n')

describe('landing content', () => {
  it('does not mention prices, payments or free offers (that is not decided or does not exist)', () => {
    expect(allText).not.toContain('€')
    for (const pattern of [/\beuros?\b/i, /\bprecios?\b/i, /\btarifas?\b/i, /\bgratis\b/i, /\bgratuit/i, /\bstripe\b/i, /\btarjeta\b/i, /\bsuscripci/i, /\bpor mes\b/i, /\bal mes\b/i]) {
      expect(allText, String(pattern)).not.toMatch(pattern)
    }
  })
  it('does not make up numbers, testimonials or "trusted by" claims', () => {
    expect(allText).not.toMatch(/\d+\s?%/)
    expect(allText).not.toMatch(/\d{2,}\s+(nutricionistas|clientes|usuarios|profesionales)/i)
    for (const word of ['testimonio', 'confían', 'confia', 'miles de', 'el mejor', 'líder', 'garantiz', 'certificad']) {
      expect(allText.toLowerCase(), word).not.toContain(word)
    }
  })
  it('has three groups of six features, three pains, three steps and complete questions', () => {
    expect(FEATURE_GROUPS.map(g => g.items.length)).toEqual([6, 6, 6])
    expect(PAINS).toHaveLength(3)
    expect(STEPS).toHaveLength(3)
    for (const f of FAQ) { expect(f.q.endsWith('?')).toBe(true); expect(f.a.length).toBeGreaterThan(40) }
  })
  it('has unique titles inside the page, so nothing is repeated by accident', () => {
    const titles = [...PAINS.map(p => p.title), ...STEPS.map(s => s.title), ...FEATURE_GROUPS.flatMap(g => g.items.map(i => i.title))]
    expect(new Set(titles).size).toBe(titles.length)
  })
})
