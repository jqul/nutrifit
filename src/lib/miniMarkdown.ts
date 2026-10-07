// Un Markdown mínimo para los textos legales (src/legal/*.md): títulos, párrafos, listas, separadores,
// **negrita** y [enlaces](url). Sin dependencias y sin HTML en bruto: todo lo que no se reconoce sale como texto,
// así que un texto raro nunca puede inyectar nada en la página.

export type Inline = { type: 'text'; text: string } | { type: 'bold'; text: string } | { type: 'link'; text: string; href: string }
export type Block =
  | { type: 'h1' | 'h2' | 'h3'; inline: Inline[] }
  | { type: 'p'; inline: Inline[] }
  | { type: 'ul'; items: Inline[][] }
  | { type: 'hr' }

/** Solo se enlaza a rutas de la propia web, a https y a correos. */
export const isSafeHref = (href: string) => /^(\/|https:\/\/|mailto:)/.test(href) && !/^\/\//.test(href)

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) })
    if (m[1] != null) out.push({ type: 'bold', text: m[1] })
    else if (isSafeHref(m[3])) out.push({ type: 'link', text: m[2], href: m[3] })
    else out.push({ type: 'text', text: m[2] })   // enlace no permitido: solo su texto
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) })
  return out
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  let list: Inline[][] | null = null
  const flushParagraph = () => { if (paragraph.length) { blocks.push({ type: 'p', inline: parseInline(paragraph.join(' ')) }); paragraph = [] } }
  const flushList = () => { if (list) { blocks.push({ type: 'ul', items: list }); list = null } }

  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const item = /^[-*]\s+(.*)$/.exec(line)
    if (!line.trim()) { flushParagraph(); flushList(); continue }
    if (heading) { flushParagraph(); flushList(); blocks.push({ type: `h${heading[1].length}` as 'h1' | 'h2' | 'h3', inline: parseInline(heading[2]) }); continue }
    if (/^-{3,}$/.test(line.trim())) { flushParagraph(); flushList(); blocks.push({ type: 'hr' }); continue }
    if (item) { flushParagraph(); (list ??= []).push(parseInline(item[1])); continue }
    flushList()
    paragraph.push(line.trim())
  }
  flushParagraph(); flushList()
  return blocks
}
