import { Fragment } from 'react'
import { Inline, parseMarkdown } from '../../lib/miniMarkdown'

function renderInline(parts: Inline[]) {
  return parts.map((p, i) => {
    if (p.type === 'bold') return <strong key={i} className="font-semibold text-ink">{p.text}</strong>
    if (p.type === 'link') return <a key={i} href={p.href} className="text-accent underline underline-offset-2">{p.text}</a>
    return <Fragment key={i}>{p.text}</Fragment>
  })
}

/** Un texto en el Markdown mínimo de la app (títulos, párrafos, listas, negrita y enlaces) con el estilo de lectura de NutriFit. */
export function MarkdownArticle({ source }: { source: string }) {
  const blocks = parseMarkdown(source)
  return (
    <article className="space-y-3 text-sm leading-relaxed text-muted">
      {blocks.map((b, i) => {
        if (b.type === 'h1') return <h1 key={i} className="text-3xl font-serif font-bold text-ink pt-2">{renderInline(b.inline)}</h1>
        if (b.type === 'h2') return <h2 key={i} className="text-lg font-serif font-bold text-ink pt-4">{renderInline(b.inline)}</h2>
        if (b.type === 'h3') return <h3 key={i} className="text-base font-semibold text-ink pt-2">{renderInline(b.inline)}</h3>
        if (b.type === 'hr') return <hr key={i} className="border-border my-6" />
        if (b.type === 'ul') return (
          <ul key={i} className="list-disc pl-5 space-y-1.5">
            {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
          </ul>
        )
        return <p key={i}>{renderInline(b.inline)}</p>
      })}
    </article>
  )
}
