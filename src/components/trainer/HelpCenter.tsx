import { useMemo, useState } from 'react'
import { Search, ChevronRight } from 'lucide-react'
import { HELP_TOPICS } from '../../help/topics'
import { searchHelp } from '../../lib/helpSearch'
import { MarkdownArticle } from '../shared/MarkdownArticle'

/**
 * La guía de uso: qué es cada cosa y cómo se hace, por temas, con buscador. El texto vive en src/help/*.md.
 */
export function HelpCenter() {
  const [slug, setSlug] = useState(HELP_TOPICS[0].slug)
  const [query, setQuery] = useState('')
  const topic = HELP_TOPICS.find(t => t.slug === slug) ?? HELP_TOPICS[0]
  const hits = useMemo(() => searchHelp(HELP_TOPICS, query), [query])
  const searching = query.trim().length >= 2

  const open = (next: string) => {
    setSlug(next); setQuery('')
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-bold">Ayuda</h1>
        <p className="text-sm text-muted mt-1">Cómo funciona todo y cómo se hace, paso a paso.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar en la ayuda… (por ejemplo: baja, peso, plantilla)" aria-label="Buscar en la ayuda"
          className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm" />
      </div>

      <div className="grid md:grid-cols-[14rem_1fr] gap-6 items-start">
        <nav aria-label="Temas de la ayuda" className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1 md:sticky md:top-24">
          {HELP_TOPICS.map(t => (
            <button key={t.slug} type="button" onClick={() => open(t.slug)} aria-current={!searching && t.slug === slug ? 'page' : undefined}
              className={`text-left whitespace-nowrap md:whitespace-normal px-3 py-2 rounded-xl text-sm transition-colors flex-shrink-0 ${
                !searching && t.slug === slug ? 'bg-accent/10 text-ink font-semibold' : 'text-muted hover:text-ink hover:bg-bg-alt/60'}`}>
              {t.title}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {searching ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">{hits.length === 0 ? 'No encuentro nada con eso. Prueba con otra palabra o mira los temas de la izquierda.' : `${hits.length} resultado${hits.length === 1 ? '' : 's'}`}</p>
              <ul className="space-y-2">
                {hits.map((h, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => open(h.slug)} className="w-full text-left card p-4 hover:bg-bg-alt/60 transition-colors">
                      <p className="text-xs text-muted">{h.topicTitle}</p>
                      <p className="font-semibold text-sm flex items-center gap-1">{h.heading} <ChevronRight className="w-4 h-4 text-accent" /></p>
                      {h.snippet && <p className="text-xs text-muted mt-1">{h.snippet}</p>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="card p-6">
              <MarkdownArticle source={topic.raw} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
