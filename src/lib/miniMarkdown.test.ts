import { describe, it, expect } from 'vitest'
import { isSafeHref, parseInline, parseMarkdown } from './miniMarkdown'

describe('parseInline', () => {
  it('splits bold and links from plain text', () => {
    expect(parseInline('Hola **mundo** y [la web](/?legal=privacidad).')).toEqual([
      { type: 'text', text: 'Hola ' }, { type: 'bold', text: 'mundo' }, { type: 'text', text: ' y ' },
      { type: 'link', text: 'la web', href: '/?legal=privacidad' }, { type: 'text', text: '.' },
    ])
  })
  it('keeps only the text of a link that points somewhere unsafe', () => {
    for (const bad of ['javascript:alert(1)', '//evil.example', 'data:text/html,x', 'http://insecure.example']) {
      const parts = parseInline(`[clic](${bad})`)
      expect(parts.some(p => p.type === 'link'), bad).toBe(false)   // nunca un enlace
      expect(parts[0]).toEqual({ type: 'text', text: 'clic' })
    }
  })
  it('never turns raw HTML into anything but text', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ type: 'text', text: '<img src=x onerror=alert(1)>' }])
  })
  it('accepts own routes, https and mailto', () => {
    for (const ok of ['/', '/?legal=terminos', 'https://www.aepd.es', 'mailto:a@b.es']) expect(isSafeHref(ok), ok).toBe(true)
  })
})

describe('parseMarkdown', () => {
  const md = `# Título

Un párrafo en
dos líneas.

## Sección

- uno
- **dos**

---

Final`
  const blocks = parseMarkdown(md)
  it('reads headings, paragraphs, lists and separators', () => {
    expect(blocks.map(b => b.type)).toEqual(['h1', 'p', 'h2', 'ul', 'hr', 'p'])
  })
  it('joins the lines of a paragraph', () => {
    expect(blocks[1]).toEqual({ type: 'p', inline: [{ type: 'text', text: 'Un párrafo en dos líneas.' }] })
  })
  it('reads the items of a list with their inline formatting', () => {
    const list = blocks[3]
    expect(list.type === 'ul' && list.items).toEqual([[{ type: 'text', text: 'uno' }], [{ type: 'bold', text: 'dos' }]])
  })
  it('handles Windows line endings and empty input', () => {
    expect(parseMarkdown('# A\r\n\r\ntexto\r\n').map(b => b.type)).toEqual(['h1', 'p'])
    expect(parseMarkdown('')).toEqual([])
  })
})
